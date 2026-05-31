"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft, RotateCcw, Maximize, Minimize,
  ChevronLeft, ChevronRight, BookOpen, Puzzle, Shuffle,
  Eye, EyeOff,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { allProducts } from "@/data/products";

// ── Board dimensions ──────────────────────────────────────────────────────────
const BOARD_W = 480; // CSS px on desktop
const BOARD_H = 480;

// ── Difficulty presets (grid size) ────────────────────────────────────────────
const DIFFICULTIES = [
  { id: "easy",   label: "Easy",   n: 3, emoji: "🌟" },
  { id: "medium", label: "Medium", n: 4, emoji: "🔥" },
  { id: "hard",   label: "Hard",   n: 5, emoji: "🏆" },
] as const;
type DifficultyId = typeof DIFFICULTIES[number]["id"];

// ── Confetti particle ─────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; life: number;
  rotation: number; rotSpeed: number;
}

interface Piece {
  id: number;       // original position (0..N²-1)
  current: number;  // current slot (0..N²-1) or -1 if in tray
  inTray: boolean;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PuzzlePage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  const purchase = purchases.find(p => p.id === purchaseId);
  const product  = purchase ? allProducts.find(p => p.id === purchase.product_id) : null;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const boardRef    = useRef<HTMLDivElement>(null);
  const trayRef     = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const dragImgRef  = useRef<HTMLDivElement>(null);

  const animRef        = useRef<number | null>(null);
  const particles      = useRef<Particle[]>([]);
  const imageUrls      = useRef<string[]>([]);
  const loadedImages   = useRef<Record<number, HTMLImageElement>>({});
  const currentPageRef = useRef(0);
  // Picked-up piece tracking for click-to-place mode
  const selectedPiece  = useRef<number | null>(null);
  // Pointer drag tracking
  const draggingId     = useRef<number | null>(null);
  const dragOffset     = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [difficulty,     setDifficulty]     = useState<DifficultyId>("easy");
  const [pieces,         setPieces]         = useState<Piece[]>([]);
  const [imgLoading,     setImgLoading]     = useState(true);
  const [imgError,       setImgError]       = useState<string | null>(null);
  const [totalPages,     setTotalPages]     = useState(0);
  const [currentPage,    setCurrentPage]    = useState(0);
  const [pageLoading,    setPageLoading]    = useState(false);
  const [imageUrl,       setImageUrl]       = useState<string | null>(null);
  const [isFullscreen,   setIsFullscreen]   = useState(false);
  const [completed,      setCompleted]      = useState(false);
  const [showPreview,    setShowPreview]    = useState(true);
  const [thumbnails,     setThumbnails]     = useState<string[]>([]);
  const [moves,          setMoves]          = useState(0);
  const [draggingPos,    setDraggingPos]    = useState<{ x: number; y: number } | null>(null);

  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  const gridN = DIFFICULTIES.find(d => d.id === difficulty)!.n;
  const pieceCount = gridN * gridN;

  // ── Initialize pieces (shuffled, all in tray) ─────────────────────────────
  function resetPuzzle(n: number = gridN) {
    const ids = Array.from({ length: n * n }, (_, i) => i);
    const shuffled = shuffleArray(ids);
    setPieces(shuffled.map((id) => ({ id, current: -1, inTray: true })));
    setCompleted(false);
    setMoves(0);
    selectedPiece.current = null;
  }

  // ── Load image for current page ───────────────────────────────────────────
  async function getImage(pageIndex: number) {
    if (loadedImages.current[pageIndex]) return loadedImages.current[pageIndex];
    const url = imageUrls.current[pageIndex];
    if (!url) return null;
    try {
      const img = await loadImage(url);
      loadedImages.current[pageIndex] = img;
      return img;
    } catch { return null; }
  }

  // ── Load page list ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!purchase?.id) return;
    async function load() {
      setImgLoading(true); setImgError(null);
      try {
        const res = await fetch(`/api/puzzle-images/${purchase!.id}`, { credentials: "include", cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setImgError(body.error ?? "Puzzle images not available yet");
          setImgLoading(false); return;
        }
        const { urls, total } = await res.json();
        imageUrls.current = urls;
        setTotalPages(total);
        setImageUrl(urls[0]);
        await getImage(0);
        setImgLoading(false);
        resetPuzzle();
        buildThumbnails();
      } catch {
        setImgError("Failed to load puzzles");
        setImgLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase?.id]);

  // ── Build thumbnails ──────────────────────────────────────────────────────
  async function buildThumbnails() {
    const result: string[] = [];
    for (let i = 0; i < imageUrls.current.length; i++) {
      try {
        const img = await getImage(i);
        if (!img) { result.push(""); setThumbnails([...result]); continue; }
        const c = document.createElement("canvas");
        const scale = 120 / img.naturalWidth;
        c.width  = Math.round(img.naturalWidth  * scale);
        c.height = Math.round(img.naturalHeight * scale);
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        result.push(c.toDataURL("image/jpeg", 0.7));
      } catch { result.push(""); }
      setThumbnails([...result]);
    }
  }

  // ── Switch page ───────────────────────────────────────────────────────────
  async function switchPage(newPage: number) {
    if (newPage < 0 || newPage >= totalPages || newPage === currentPageRef.current) return;
    setPageLoading(true);
    setCurrentPage(newPage);
    setImageUrl(imageUrls.current[newPage]);
    await getImage(newPage);
    setPageLoading(false);
    resetPuzzle();
  }
  function nextPage() { switchPage(currentPage + 1); }
  function prevPage() { switchPage(currentPage - 1); }

  // Fullscreen
  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }

  // Arrow keys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "ArrowRight") { e.preventDefault(); nextPage(); }
      if (e.code === "ArrowLeft")  { e.preventDefault(); prevPage(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, totalPages]);

  // ── Reset puzzle when difficulty changes ──────────────────────────────────
  useEffect(() => {
    if (totalPages > 0) resetPuzzle(gridN);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty]);

  // ── Win check ─────────────────────────────────────────────────────────────
  function checkWin(updated: Piece[]) {
    const allPlaced = updated.every(p => !p.inTray);
    const allCorrect = updated.every(p => p.id === p.current);
    if (allPlaced && allCorrect && !completed) {
      setCompleted(true);
      navigator.vibrate?.([60, 30, 100, 30, 200]);
      launchConfetti();
    }
  }

  // ── Move a piece to a slot or back to tray ────────────────────────────────
  function placePiece(pieceIdx: number, slot: number | null) {
    setPieces(prev => {
      const next = [...prev];
      // If slot occupied, swap that piece back to tray
      if (slot !== null) {
        const occupier = next.findIndex(p => p.current === slot && !p.inTray);
        if (occupier !== -1 && occupier !== pieceIdx) {
          next[occupier] = { ...next[occupier], current: -1, inTray: true };
        }
      }
      next[pieceIdx] = {
        ...next[pieceIdx],
        current: slot ?? -1,
        inTray: slot === null,
      };
      setMoves(m => m + 1);
      checkWin(next);
      return next;
    });
  }

  // ── Click/tap-to-place ────────────────────────────────────────────────────
  function selectPiece(pieceIdx: number) {
    if (completed) return;
    selectedPiece.current = pieceIdx;
  }
  function placeIntoSlot(slot: number) {
    if (selectedPiece.current === null || completed) return;
    placePiece(selectedPiece.current, slot);
    selectedPiece.current = null;
  }
  function returnToTray() {
    if (selectedPiece.current === null || completed) return;
    placePiece(selectedPiece.current, null);
    selectedPiece.current = null;
  }

  // ── Pointer drag (mouse + touch) ──────────────────────────────────────────
  function getClient(e: React.PointerEvent | PointerEvent) {
    return { x: e.clientX, y: e.clientY };
  }

  function onPiecePointerDown(e: React.PointerEvent, pieceIdx: number) {
    if (completed) return;
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left - rect.width / 2, y: e.clientY - rect.top - rect.height / 2 };
    draggingId.current = pieceIdx;
    selectedPiece.current = pieceIdx;
    setDraggingPos({ x: e.clientX, y: e.clientY });
    target.setPointerCapture(e.pointerId);
  }

  function onPiecePointerMove(e: React.PointerEvent) {
    if (draggingId.current === null) return;
    e.preventDefault();
    setDraggingPos({ x: e.clientX, y: e.clientY });
  }

  function onPiecePointerUp(e: React.PointerEvent) {
    if (draggingId.current === null) return;
    e.preventDefault();
    const pieceIdx = draggingId.current;
    draggingId.current = null;
    setDraggingPos(null);

    // Determine drop target: a board slot, or back to tray
    const dropEl = document.elementFromPoint(e.clientX, e.clientY);
    if (!dropEl) { selectedPiece.current = null; return; }
    const slotEl = dropEl.closest("[data-slot-index]");
    if (slotEl) {
      const slot = Number(slotEl.getAttribute("data-slot-index"));
      if (!Number.isNaN(slot)) {
        placePiece(pieceIdx, slot);
        selectedPiece.current = null;
        return;
      }
    }
    // Drop into tray (or anywhere else) → back to tray
    const trayEl = dropEl.closest("[data-tray]");
    if (trayEl) {
      placePiece(pieceIdx, null);
    }
    selectedPiece.current = null;
  }

  // ── Confetti ──────────────────────────────────────────────────────────────
  function launchConfetti() {
    const colors = ["#FF0040","#FF6600","#FFD700","#00DD44","#00AAFF","#AA44FF","#FF44AA"];
    particles.current = Array.from({ length: 140 }, () => ({
      x: Math.random() * BOARD_W, y: -20,
      vx: (Math.random() - 0.5) * 7, vy: 2 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 8, life: 1,
      rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.22,
    }));
    animateConfetti();
  }

  function animateConfetti() {
    const canvas = confettiRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.current = particles.current.filter(p => p.life > 0);
    for (const p of particles.current) {
      p.x += p.vx; p.vy += 0.15; p.y += p.vy;
      p.vx *= 0.99; p.rotation += p.rotSpeed; p.life -= 0.007;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (particles.current.length > 0) {
      animRef.current = requestAnimationFrame(animateConfetti);
    } else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  // ── Helper: piece style returns background-image position ────────────────
  function pieceBg(pieceId: number, size: number) {
    if (!imageUrl) return {};
    const row = Math.floor(pieceId / gridN);
    const col = pieceId % gridN;
    return {
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: `${size * gridN}px ${size * gridN}px`,
      backgroundPosition: `-${col * size}px -${row * size}px`,
      backgroundRepeat: "no-repeat",
    };
  }

  // ── Tray pieces (in shuffled order, not by id) ────────────────────────────
  const trayPieces = pieces.filter(p => p.inTray);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <><Navbar />
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <p className="text-sm text-ink-muted">Loading…</p>
        </div>
      </>
    );
  }
  if (!purchase || !product) {
    return (
      <><Navbar />
        <div className="min-h-screen bg-cream flex items-center justify-center px-6 text-center">
          <div>
            <p className="font-serif text-2xl text-ink mb-2">Purchase not found</p>
            <a href="/downloads" className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-medium">My Library</a>
          </div>
        </div>
      </>
    );
  }

  const placedCount = pieces.filter(p => !p.inTray).length;
  const correctCount = pieces.filter(p => p.id === p.current && !p.inTray).length;

  return (
    <>
      {!isFullscreen && <Navbar />}
      <main className="bg-[#EDEBE6] flex flex-col" style={{ height: isFullscreen ? "100vh" : "calc(100vh - 64px)" }}>

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="relative z-20 bg-cream border-b border-border-muted px-4 py-2.5 flex items-center gap-3 shrink-0">
          {!isFullscreen && (
            <>
              <a href="/downloads" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors shrink-0">
                <ArrowLeft size={13} />My Library
              </a>
              <span className="text-border-muted text-xs shrink-0">·</span>
              <p className="text-sm font-medium text-ink truncate flex-1">{product.title}</p>
            </>
          )}
          {isFullscreen && <p className="text-sm font-medium text-ink truncate flex-1">{product.title}</p>}

          {totalPages > 0 && (
            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              <BookOpen size={13} className="text-ink-muted" />
              <span className="text-xs text-ink-muted tabular-nums">
                Page <span className="font-semibold text-ink">{currentPage + 1}</span> of {totalPages}
              </span>
            </div>
          )}

          {!imgLoading && !imgError && (
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-ink-muted tabular-nums">
                {correctCount} / {pieceCount} correct · {moves} moves
              </span>
            </div>
          )}

          {!imgError && (
            <button onClick={() => resetPuzzle()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EDEBE6] hover:bg-card-hover text-ink text-xs font-medium transition-colors shrink-0">
              <Shuffle size={12} />Shuffle
            </button>
          )}

          <button onClick={toggleFullscreen}
            className="w-8 h-8 rounded-full bg-[#EDEBE6] flex items-center justify-center hover:bg-card-hover transition-colors shrink-0">
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* Sidebar — desktop */}
          <aside className="hidden md:flex flex-col gap-5 w-56 bg-cream border-r border-border-muted p-4 overflow-y-auto shrink-0">

            {/* Reference image */}
            {!imgLoading && !imgError && imageUrl && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Reference</p>
                  <button onClick={() => setShowPreview(s => !s)}
                    className="text-ink-muted hover:text-ink transition-colors p-0.5"
                    title={showPreview ? "Hide reference" : "Show reference"}>
                    {showPreview ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                </div>
                {showPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-border-muted bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Reference" className="w-full h-auto block" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border-muted bg-card-hover/30 py-6 text-center">
                    <p className="text-[10px] text-ink-muted">Hidden</p>
                  </div>
                )}
                <p className="text-[10px] text-ink-muted mt-1.5 text-center">What you&apos;re building</p>
              </div>
            )}

            {/* Difficulty */}
            <div>
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Difficulty</p>
              <div className="flex flex-col gap-1">
                {DIFFICULTIES.map(d => (
                  <button key={d.id} onClick={() => setDifficulty(d.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      difficulty === d.id ? "bg-ink text-cream" : "text-ink hover:bg-[#EDEBE6]"
                    }`}>
                    <span className="flex items-center gap-2">
                      <span>{d.emoji}</span>{d.label}
                    </span>
                    <span className={`text-[10px] ${difficulty === d.id ? "text-cream/60" : "text-ink-muted"}`}>
                      {d.n}×{d.n}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Progress */}
            {!imgLoading && !imgError && (
              <div>
                <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Progress</p>
                <div className="w-full h-2 rounded-full bg-card-hover overflow-hidden mb-1">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-300"
                    style={{ width: `${pieceCount ? Math.round((correctCount / pieceCount) * 100) : 0}%` }} />
                </div>
                <p className="text-xs text-ink-muted text-right tabular-nums">{correctCount}/{pieceCount}</p>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-border-muted">
              <p className="text-[11px] text-ink-muted leading-relaxed">
                {completed
                  ? "🎉 Puzzle solved! Try a harder difficulty."
                  : "Drag a piece from the tray to the matching spot on the board."}
              </p>
            </div>
          </aside>

          {/* ── Game area ────────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">

            {/* Loading */}
            {imgLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: "#EDEBE6" }}>
                {product?.image && (
                  <img src={product.image} alt="" className="absolute inset-0 w-full h-full object-contain opacity-20 blur-md pointer-events-none select-none" />
                )}
                <div className="relative z-10 text-center">
                  <div className="w-10 h-10 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-ink-muted">Loading puzzle…</p>
                </div>
              </div>
            )}

            {/* Error */}
            {!imgLoading && imgError && (
              <div className="absolute inset-0 z-20 flex items-center justify-center px-6" style={{ background: "#EDEBE6" }}>
                <div className="text-center max-w-sm">
                  <Puzzle size={40} strokeWidth={1.2} className="text-ink-muted mx-auto mb-4" />
                  <p className="font-serif text-xl text-ink mb-2">Couldn&apos;t load the puzzle</p>
                  <p className="text-sm text-ink-muted mb-4">{imgError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-5 py-2 rounded-full bg-ink text-cream text-xs font-medium hover:bg-[#3a3a3a] transition-colors">
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Game */}
            {!imgLoading && !imgError && (
              <div className="flex-1 flex flex-col min-h-0">

                {/* Board area */}
                <div className="flex-1 flex items-center justify-center p-3 min-h-0 overflow-auto" style={{ background: "#EDEBE6" }}>
                  <div className="relative select-none"
                    style={{
                      width:  "min(90vw, 480px)",
                      height: "min(90vw, 480px)",
                      maxWidth:  BOARD_W,
                      maxHeight: BOARD_H,
                    }}>

                    {pageLoading && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 rounded-2xl">
                        <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}

                    {/* Faded reference behind the board (visual guide) */}
                    {imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt=""
                        className="absolute inset-0 w-full h-full object-cover rounded-2xl pointer-events-none"
                        style={{ opacity: 0.12 }} />
                    )}

                    {/* The N×N board grid */}
                    <div ref={boardRef}
                      className="absolute inset-0 grid rounded-2xl border-2 border-ink/30 overflow-hidden"
                      style={{ gridTemplateColumns: `repeat(${gridN}, 1fr)`, gridTemplateRows: `repeat(${gridN}, 1fr)` }}>
                      {Array.from({ length: pieceCount }).map((_, slot) => {
                        const placed = pieces.find(p => p.current === slot && !p.inTray);
                        const correct = placed && placed.id === slot;
                        return (
                          <div key={slot} data-slot-index={slot}
                            onClick={() => placeIntoSlot(slot)}
                            className={`relative border border-ink/15 transition-colors ${
                              correct ? "border-emerald-500/60" : ""
                            }`}>
                            {placed && (
                              <div
                                onPointerDown={e => onPiecePointerDown(e, pieces.indexOf(placed))}
                                onPointerMove={onPiecePointerMove}
                                onPointerUp={onPiecePointerUp}
                                style={{
                                  ...pieceBg(placed.id, (BOARD_W) / gridN),
                                  width: "100%", height: "100%",
                                  cursor: completed ? "default" : "grab",
                                  touchAction: "none",
                                  visibility: draggingId.current === pieces.indexOf(placed) ? "hidden" : "visible",
                                }}
                                className={`${correct ? "ring-2 ring-emerald-500/70" : ""}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Confetti */}
                    <canvas ref={confettiRef} width={480} height={480}
                      className="absolute inset-0 w-full h-full pointer-events-none rounded-2xl" />

                    {/* Completion banner — text only, no card */}
                    {completed && (
                      <div className="absolute inset-x-0 -top-2 flex justify-center pointer-events-none">
                        <p className="font-serif text-lg sm:text-xl font-bold text-emerald-700 animate-bounce"
                          style={{ textShadow: "0 2px 8px rgba(255,255,255,0.9)" }}>
                          🎉 You solved it in {moves} moves!
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tray — shuffled pieces */}
                <div data-tray
                  className="bg-[#E8E4DC] border-t border-border-muted shrink-0">
                  <div ref={trayRef}
                    className="flex gap-2 px-3 py-3 overflow-x-auto items-center"
                    style={{ scrollbarWidth: "thin", minHeight: 80 }}>
                    {trayPieces.length === 0 ? (
                      <p className="text-xs text-ink-muted px-2">
                        {completed ? "All placed!" : "Drag pieces from here onto the board"}
                      </p>
                    ) : trayPieces.map((p) => {
                      const idx = pieces.indexOf(p);
                      return (
                        <div key={p.id} data-piece-id={p.id}
                          onPointerDown={e => onPiecePointerDown(e, idx)}
                          onPointerMove={onPiecePointerMove}
                          onPointerUp={onPiecePointerUp}
                          onClick={() => selectPiece(idx)}
                          style={{
                            ...pieceBg(p.id, 64),
                            width: 64, height: 64,
                            cursor: "grab", touchAction: "none",
                            visibility: draggingId.current === idx ? "hidden" : "visible",
                          }}
                          className="shrink-0 rounded-lg border-2 border-white shadow-md hover:scale-105 active:scale-95 transition-transform"
                          title={`Piece ${p.id + 1}`}
                        />
                      );
                    })}
                    <div className="ml-auto shrink-0 flex items-center gap-2 pr-2">
                      <button onClick={returnToTray}
                        title="Return selected piece"
                        className="text-[10px] text-ink-muted px-2 py-1 rounded hover:bg-cream transition-colors">
                        {selectedPiece.current !== null ? "Tap board" : ""}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Floating drag image — follows the pointer */}
            {draggingPos && draggingId.current !== null && imageUrl && (
              <div ref={dragImgRef}
                className="fixed pointer-events-none z-50 rounded-lg shadow-xl border-2 border-white"
                style={{
                  ...pieceBg(pieces[draggingId.current].id, 64),
                  width: 64, height: 64,
                  left: draggingPos.x - 32 - dragOffset.current.x,
                  top:  draggingPos.y - 32 - dragOffset.current.y,
                  transform: "rotate(-3deg)",
                }} />
            )}

            {/* Thumbnail strip */}
            {!imgLoading && !imgError && totalPages > 0 && (
              <div className="bg-[#E8E4DC] border-t border-border-muted shrink-0">
                <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button key={i} onClick={() => switchPage(i)}
                      className={`flex-shrink-0 flex flex-col items-center gap-1 transition-opacity ${currentPage === i ? "opacity-100" : "opacity-50 hover:opacity-75"}`}>
                      <div className={`rounded-lg overflow-hidden border-2 bg-white transition-all ${currentPage === i ? "border-ink shadow-md" : "border-transparent"}`}
                        style={{ width: 60 }}>
                        {thumbnails[i]
                          ? <img src={thumbnails[i]} alt={`Page ${i + 1}`} className="w-full h-auto block" />
                          : <div className="w-full bg-card-hover animate-pulse" style={{ height: 60 }} />}
                      </div>
                      <span className={`text-[10px] tabular-nums ${currentPage === i ? "text-ink font-semibold" : "text-ink-muted"}`}>{i + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile bottom toolbar */}
        <div className="md:hidden bg-cream border-t border-border-muted px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
          {DIFFICULTIES.map(d => (
            <button key={d.id} onClick={() => setDifficulty(d.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                difficulty === d.id ? "bg-ink text-cream" : "bg-[#EDEBE6] text-ink"
              }`}>
              {d.emoji} {d.label}
            </button>
          ))}
          <div className="w-px h-6 bg-border-muted shrink-0 mx-1" />
          <button onClick={prevPage} disabled={currentPage === 0}
            className="w-9 h-9 rounded-xl bg-[#EDEBE6] flex items-center justify-center shrink-0 disabled:opacity-40">
            <ChevronLeft size={15} />
          </button>
          <span className="text-[11px] font-semibold text-ink shrink-0 tabular-nums">{currentPage + 1}/{totalPages}</span>
          <button onClick={nextPage} disabled={currentPage >= totalPages - 1}
            className="w-9 h-9 rounded-xl bg-[#EDEBE6] flex items-center justify-center shrink-0 disabled:opacity-40">
            <ChevronRight size={15} />
          </button>
          <button onClick={() => resetPuzzle()}
            className="ml-auto w-9 h-9 rounded-xl bg-[#EDEBE6] flex items-center justify-center shrink-0">
            <RotateCcw size={15} />
          </button>
        </div>
      </main>
    </>
  );
}
