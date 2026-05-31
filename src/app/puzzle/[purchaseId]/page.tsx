"use client";

import { use, useEffect, useRef, useState } from "react";
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
  { id: "easy",   label: "Easy",   n: 3, emoji: "🐣" },
  { id: "medium", label: "Medium", n: 4, emoji: "🦊" },
  { id: "hard",   label: "Hard",   n: 5, emoji: "🦁" },
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

// Deterministic pseudo-random — gives the same edge layout per page/difficulty
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Edge type: 0 = flat (border), +1 = tab pointing out, −1 = blank cut in
type Edge = 0 | 1 | -1;
interface PieceEdges { top: Edge; right: Edge; bottom: Edge; left: Edge }

// Build interlocking edge layout for every piece. Adjacent pieces always
// share opposite edges (one has a tab, the other has a blank).
function buildEdgeMap(n: number, seed: number): PieceEdges[][] {
  const rng = mulberry32(seed);
  const grid: PieceEdges[][] = [];
  for (let r = 0; r < n; r++) {
    grid[r] = [];
    for (let c = 0; c < n; c++) {
      const top:    Edge = r === 0   ? 0 : (-grid[r - 1][c].bottom as Edge);
      const left:   Edge = c === 0   ? 0 : (-grid[r][c - 1].right as Edge);
      const bottom: Edge = r === n-1 ? 0 : (rng() > 0.5 ? 1 : -1);
      const right:  Edge = c === n-1 ? 0 : (rng() > 0.5 ? 1 : -1);
      grid[r][c] = { top, right, bottom, left };
    }
  }
  return grid;
}

// Generate the SVG path string for one piece. The path occupies a
// (size × size) cell, but tabs extend tabSize beyond that, so the SVG
// viewBox needs (-tabSize, -tabSize, size+2tabSize, size+2tabSize).
function piecePath(edges: PieceEdges, size: number, tab: number): string {
  const ear = size * 0.18;                   // neck width
  const tabH = tab;                          // tab/blank height
  const c = size / 2;                        // center of edge

  // helper: side function returns path commands for one edge.
  // Each edge goes from current point at start to (size, 0) in local coords
  // before any transform is applied.
  function edgeSide(eType: Edge): string {
    if (eType === 0) return ` L ${size},0`;
    // tab=+1 (curve OUT, away from center), blank=-1 (curve IN, toward center)
    const dir = eType;
    return [
      ` L ${c - ear},0`,
      // neck
      ` c ${ear * 0.3},0 ${ear * 0.6},${-dir * tabH * 0.4} ${ear * 0.6},${-dir * tabH * 0.4}`,
      // bulb
      ` c 0,${-dir * tabH * 0.55} ${ear * 0.8 - 0},${-dir * tabH * 0.95} ${ear * 1.4},${-dir * tabH * 0.95}`,
      ` c ${ear * 0.6},0 ${ear * 1.4},${dir * tabH * 0.4} ${ear * 1.4},${dir * tabH * 0.95}`.replace(/(\.[0-9]+)([+-])/g, "$1 $2"),
      // back to neck
      ` c 0,${dir * tabH * 0.55} ${ear * 0.3},${dir * tabH * 0.55} ${ear * 0.6},${dir * tabH * 0.4}`,
      ` L ${size},0`,
    ].join("");
  }

  // Build the four sides in counter-clockwise order, rotating via SVG
  // transforms. Instead we'll emit absolute commands by composing.
  // Simpler: emit commands relative to current point, rotating mental model.
  // We use a chained path by constructing each side oriented along +x then
  // applying virtual rotation by computing rotated endpoints.

  // To keep things readable, build each side with absolute coords:
  function topEdge(): string {
    const e = edges.top;
    if (e === 0) return `M 0,0 L ${size},0`;
    const dir = e; // tab=+1: bulb goes UP (-y direction)
    return [
      `M 0,0`,
      `L ${c - ear},0`,
      `C ${c - ear * 0.7},0 ${c - ear * 0.4},${-dir * tabH * 0.4} ${c - ear * 0.4},${-dir * tabH * 0.4}`,
      `C ${c - ear * 0.4},${-dir * tabH * 0.95} ${c - ear * 0.9},${-dir * tabH * 1.15} ${c},${-dir * tabH * 1.15}`,
      `C ${c + ear * 0.9},${-dir * tabH * 1.15} ${c + ear * 0.4},${-dir * tabH * 0.95} ${c + ear * 0.4},${-dir * tabH * 0.4}`,
      `C ${c + ear * 0.4},${-dir * tabH * 0.4} ${c + ear * 0.7},0 ${c + ear},0`,
      `L ${size},0`,
    ].join(" ");
  }
  function rightEdge(): string {
    const e = edges.right;
    if (e === 0) return ` L ${size},${size}`;
    const dir = e;
    return [
      ` L ${size},${c - ear}`,
      `C ${size},${c - ear * 0.7} ${size + dir * tabH * 0.4},${c - ear * 0.4} ${size + dir * tabH * 0.4},${c - ear * 0.4}`,
      `C ${size + dir * tabH * 0.95},${c - ear * 0.4} ${size + dir * tabH * 1.15},${c - ear * 0.9} ${size + dir * tabH * 1.15},${c}`,
      `C ${size + dir * tabH * 1.15},${c + ear * 0.9} ${size + dir * tabH * 0.95},${c + ear * 0.4} ${size + dir * tabH * 0.4},${c + ear * 0.4}`,
      `C ${size + dir * tabH * 0.4},${c + ear * 0.4} ${size},${c + ear * 0.7} ${size},${c + ear}`,
      `L ${size},${size}`,
    ].join(" ");
  }
  function bottomEdge(): string {
    const e = edges.bottom;
    if (e === 0) return ` L 0,${size}`;
    const dir = e; // tab=+1 → bulb goes DOWN (+y)
    return [
      ` L ${c + ear},${size}`,
      `C ${c + ear * 0.7},${size} ${c + ear * 0.4},${size + dir * tabH * 0.4} ${c + ear * 0.4},${size + dir * tabH * 0.4}`,
      `C ${c + ear * 0.4},${size + dir * tabH * 0.95} ${c + ear * 0.9},${size + dir * tabH * 1.15} ${c},${size + dir * tabH * 1.15}`,
      `C ${c - ear * 0.9},${size + dir * tabH * 1.15} ${c - ear * 0.4},${size + dir * tabH * 0.95} ${c - ear * 0.4},${size + dir * tabH * 0.4}`,
      `C ${c - ear * 0.4},${size + dir * tabH * 0.4} ${c - ear * 0.7},${size} ${c - ear},${size}`,
      `L 0,${size}`,
    ].join(" ");
  }
  function leftEdge(): string {
    const e = edges.left;
    if (e === 0) return ` L 0,0 Z`;
    const dir = e;
    return [
      ` L 0,${c + ear}`,
      `C 0,${c + ear * 0.7} ${-dir * tabH * 0.4},${c + ear * 0.4} ${-dir * tabH * 0.4},${c + ear * 0.4}`,
      `C ${-dir * tabH * 0.95},${c + ear * 0.4} ${-dir * tabH * 1.15},${c + ear * 0.9} ${-dir * tabH * 1.15},${c}`,
      `C ${-dir * tabH * 1.15},${c - ear * 0.9} ${-dir * tabH * 0.95},${c - ear * 0.4} ${-dir * tabH * 0.4},${c - ear * 0.4}`,
      `C ${-dir * tabH * 0.4},${c - ear * 0.4} 0,${c - ear * 0.7} 0,${c - ear}`,
      `L 0,0 Z`,
    ].join(" ");
  }

  return topEdge() + rightEdge() + bottomEdge() + leftEdge();
}

export default function PuzzlePage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  const purchase = purchases.find(p => p.id === purchaseId);
  const product  = purchase ? allProducts.find(p => p.id === purchase.product_id) : null;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const boardWrapperRef = useRef<HTMLDivElement>(null);
  const trayRef     = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);

  const animRef        = useRef<number | null>(null);
  const particles      = useRef<Particle[]>([]);
  const imageUrls      = useRef<string[]>([]);
  const loadedImages   = useRef<Record<number, HTMLImageElement>>({});
  const currentPageRef = useRef(0);

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
  const [draggingId,     setDraggingId]     = useState<number | null>(null);
  const [selectedId,     setSelectedId]     = useState<number | null>(null);
  const [edgeMap,        setEdgeMap]        = useState<PieceEdges[][]>([]);

  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  const gridN = DIFFICULTIES.find(d => d.id === difficulty)!.n;
  const pieceCount = gridN * gridN;

  // Rebuild jigsaw edge layout when difficulty or page changes
  useEffect(() => {
    setEdgeMap(buildEdgeMap(gridN, currentPage * 1000 + gridN * 17));
  }, [difficulty, currentPage, gridN]);

  // ── Initialize pieces (shuffled, all in tray) ─────────────────────────────
  function resetPuzzle(n: number = gridN) {
    const ids = Array.from({ length: n * n }, (_, i) => i);
    const shuffled = shuffleArray(ids);
    setPieces(shuffled.map((id) => ({ id, current: -1, inTray: true })));
    setCompleted(false);
    setMoves(0);
    setSelectedId(null);
    setDraggingId(null);
    setDraggingPos(null);
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
    // Toggle off if same piece, otherwise select
    setSelectedId(prev => (prev === pieceIdx ? null : pieceIdx));
  }
  function placeIntoSlot(slot: number) {
    if (selectedId === null || completed) return;
    placePiece(selectedId, slot);
    setSelectedId(null);
  }

  // Tracks whether the most recent pointer interaction became a drag —
  // used to suppress the click handler that fires after pointerup so a
  // drag doesn't also trigger selectPiece.
  const justDraggedRef = useRef(false);

  // ── Drag (unified mouse + touch via window listeners) ────────────────────
  // We start the drag only after the pointer moves past a small threshold,
  // and only if the movement is more vertical than horizontal. This lets
  // the user swipe horizontally to scroll the tray on mobile, while
  // vertical drags pick the piece up.
  function startDrag(e: React.PointerEvent, pieceIdx: number) {
    if (completed) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let committed = false;
    const THRESHOLD = 6; // px before we commit to anything

    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (!committed) {
        if (absDx < THRESHOLD && absDy < THRESHOLD) return;
        // Horizontal-dominant → user is scrolling the tray; abort drag
        if (absDx > absDy * 1.3) {
          window.removeEventListener("pointermove",   handleMove);
          window.removeEventListener("pointerup",     handleUp);
          window.removeEventListener("pointercancel", handleUp);
          return;
        }
        // Vertical-dominant → commit to drag
        committed = true;
        justDraggedRef.current = true;
        setDraggingId(pieceIdx);
        setSelectedId(pieceIdx);
      }
      ev.preventDefault();
      setDraggingPos({ x: ev.clientX, y: ev.clientY });
    };
    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove",   handleMove);
      window.removeEventListener("pointerup",     handleUp);
      window.removeEventListener("pointercancel", handleUp);
      if (committed) {
        finishDrag(pieceIdx, ev.clientX, ev.clientY);
      }
      // If not committed, the gesture is a tap; the click handler runs
      // and fires selectPiece.
    };
    window.addEventListener("pointermove",   handleMove);
    window.addEventListener("pointerup",     handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  function finishDrag(pieceIdx: number, clientX: number, clientY: number) {
    setDraggingId(null);
    setDraggingPos(null);

    // 1. Geometric hit-test on the board wrapper. If pointer is inside,
    //    compute which cell it's over and place the piece there.
    const board = boardWrapperRef.current;
    if (board) {
      const rect = board.getBoundingClientRect();
      if (
        clientX >= rect.left && clientX <= rect.right &&
        clientY >= rect.top  && clientY <= rect.bottom
      ) {
        const col = Math.floor(((clientX - rect.left) / rect.width)  * gridN);
        const row = Math.floor(((clientY - rect.top)  / rect.height) * gridN);
        if (col >= 0 && col < gridN && row >= 0 && row < gridN) {
          const slot = row * gridN + col;
          placePiece(pieceIdx, slot);
          setSelectedId(null);
          return;
        }
      }
    }

    // 2. Otherwise, if released anywhere outside the board, send back to tray.
    placePiece(pieceIdx, null);
    setSelectedId(null);
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
                    {/* Jigsaw pattern overlay — same shapes as the board so kids
                        can map each piece to its location on the reference. */}
                    {(() => {
                      const refSize = 100;
                      const cell = refSize / gridN;
                      const tab = cell * 0.18;
                      return (
                        <svg
                          viewBox={`${-tab} ${-tab} ${refSize + 2 * tab} ${refSize + 2 * tab}`}
                          preserveAspectRatio="none"
                          className="absolute inset-0 w-full h-full pointer-events-none"
                          style={{ overflow: "visible" }}
                        >
                          {edgeMap.map((row, r) => row.map((edges, c) => (
                            <g key={`ref-${r}-${c}`} transform={`translate(${c * cell} ${r * cell})`}>
                              <path
                                d={piecePath(edges, cell, tab)}
                                fill="none"
                                stroke="rgba(255,255,255,0.9)"
                                strokeWidth={0.6}
                              />
                              <path
                                d={piecePath(edges, cell, tab)}
                                fill="none"
                                stroke="rgba(0,0,0,0.6)"
                                strokeWidth={0.3}
                              />
                            </g>
                          )))}
                        </svg>
                      );
                    })()}
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
                  <div ref={boardWrapperRef} className="relative select-none"
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

                    {(() => {
                      // ── Board: jigsaw slot outlines + placed pieces ───
                      const cell = BOARD_W / gridN;
                      const tab  = cell * 0.18;
                      return (
                        <svg
                          viewBox={`${-tab} ${-tab} ${BOARD_W + 2 * tab} ${BOARD_H + 2 * tab}`}
                          className="absolute inset-0 w-full h-full"
                          style={{ overflow: "visible", pointerEvents: "none" }}
                        >
                          {/* Slot outlines (the "pattern shape" backdrop) */}
                          {edgeMap.map((row, r) => row.map((edges, c) => {
                            const slot = r * gridN + c;
                            const placed = pieces.find(p => p.current === slot && !p.inTray);
                            return (
                              <g key={`slot-${slot}`} transform={`translate(${c * cell} ${r * cell})`}>
                                <path
                                  d={piecePath(edges, cell, tab)}
                                  fill={placed ? "transparent" : "rgba(34,34,34,0.04)"}
                                  stroke={placed ? "transparent" : "rgba(34,34,34,0.28)"}
                                  strokeWidth={1.5}
                                  strokeDasharray="4,3"
                                />
                              </g>
                            );
                          }))}

                          {/* Placed pieces — drawn last so they sit above the slot pattern */}
                          {pieces.map((p, idx) => {
                            if (p.inTray) return null;
                            if (draggingId === idx) return null;
                            const slotR = Math.floor(p.current / gridN);
                            const slotC = p.current % gridN;
                            const origR = Math.floor(p.id / gridN);
                            const origC = p.id % gridN;
                            const edges = edgeMap[origR]?.[origC];
                            if (!edges) return null;
                            const correct = p.id === p.current;
                            return (
                              <g key={`piece-${idx}`}
                                transform={`translate(${slotC * cell} ${slotR * cell})`}
                                style={{ pointerEvents: "auto", cursor: completed ? "default" : "grab", touchAction: "none" }}
                                onPointerDown={(e) => startDrag(e as unknown as React.PointerEvent, idx)}>
                                <defs>
                                  <clipPath id={`clip-board-${idx}-${gridN}`}>
                                    <path d={piecePath(edges, cell, tab)} />
                                  </clipPath>
                                </defs>
                                <image href={imageUrl ?? ""}
                                  x={-origC * cell} y={-origR * cell}
                                  width={gridN * cell} height={gridN * cell}
                                  preserveAspectRatio="xMidYMid slice"
                                  clipPath={`url(#clip-board-${idx}-${gridN})`}
                                />
                                <path
                                  d={piecePath(edges, cell, tab)}
                                  fill="none"
                                  stroke={correct ? "rgb(16,185,129)" : "rgba(0,0,0,0.5)"}
                                  strokeWidth={correct ? 2.5 : 1.2}
                                  pointerEvents="none"
                                />
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}

                    {/* Click-to-place overlay: a transparent N×N grid of buttons.
                        Used for tap-to-place after selecting a tray piece.
                        Pointer events ignored when nothing is selected. */}
                    {selectedId !== null && !completed && (
                      <div className="absolute inset-0 grid"
                        style={{
                          gridTemplateColumns: `repeat(${gridN}, 1fr)`,
                          gridTemplateRows:    `repeat(${gridN}, 1fr)`,
                        }}>
                        {Array.from({ length: pieceCount }).map((_, slot) => (
                          <button key={`hit-${slot}`}
                            onClick={() => placeIntoSlot(slot)}
                            className="bg-emerald-400/0 hover:bg-emerald-400/20 transition-colors"
                            style={{ cursor: "pointer" }}
                            aria-label={`Place piece at slot ${slot + 1}`} />
                        ))}
                      </div>
                    )}

                    {/* Confetti */}
                    <canvas ref={confettiRef} width={480} height={480}
                      className="absolute inset-0 w-full h-full pointer-events-none rounded-2xl" />

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
                      const traySize = 72;
                      const trayTab = traySize * 0.18;
                      const origR = Math.floor(p.id / gridN);
                      const origC = p.id % gridN;
                      const edges = edgeMap[origR]?.[origC];
                      if (!edges) return null;
                      const isSelected = selectedId === idx;
                      return (
                        <div key={p.id} data-piece-id={p.id}
                          onPointerDown={e => startDrag(e, idx)}
                          onClick={(e) => {
                            if (justDraggedRef.current) {
                              justDraggedRef.current = false;
                              e.preventDefault();
                              return;
                            }
                            selectPiece(idx);
                            e.preventDefault();
                          }}
                          style={{
                            width:  traySize + 2 * trayTab,
                            height: traySize + 2 * trayTab,
                            cursor: "grab",
                            // pan-x lets the browser scroll the tray horizontally
                            // when the user swipes sideways; vertical movement is
                            // intercepted by our drag handler.
                            touchAction: "pan-x",
                            visibility: draggingId === idx ? "hidden" : "visible",
                          }}
                          className={`shrink-0 hover:scale-110 active:scale-95 transition-transform rounded-lg ${isSelected ? "ring-4 ring-emerald-500" : ""}`}
                          title={`Piece ${p.id + 1}`}
                        >
                          <svg width="100%" height="100%"
                            viewBox={`${-trayTab} ${-trayTab} ${traySize + 2 * trayTab} ${traySize + 2 * trayTab}`}
                            style={{ filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.25))" }}>
                            <defs>
                              <clipPath id={`clip-tray-${p.id}-${gridN}`}>
                                <path d={piecePath(edges, traySize, trayTab)} />
                              </clipPath>
                            </defs>
                            <image href={imageUrl ?? ""}
                              x={-origC * traySize} y={-origR * traySize}
                              width={gridN * traySize} height={gridN * traySize}
                              preserveAspectRatio="xMidYMid slice"
                              clipPath={`url(#clip-tray-${p.id}-${gridN})`} />
                            <path d={piecePath(edges, traySize, trayTab)}
                              fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth={2} />
                            <path d={piecePath(edges, traySize, trayTab)}
                              fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={0.8} />
                          </svg>
                        </div>
                      );
                    })}
                    {selectedId !== null && !completed && (
                      <p className="ml-auto shrink-0 text-[11px] font-medium text-emerald-700 pr-2">
                        Tap a board slot to place
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Floating drag piece — follows the pointer */}
            {draggingPos && draggingId !== null && imageUrl && (() => {
              const p = pieces[draggingId];
              if (!p) return null;
              const origR = Math.floor(p.id / gridN);
              const origC = p.id % gridN;
              const edges = edgeMap[origR]?.[origC];
              if (!edges) return null;
              const ds = 84, dt = ds * 0.18;
              const full = ds + 2 * dt;
              return (
                <div
                  className="fixed pointer-events-none z-50"
                  style={{
                    width:  full,
                    height: full,
                    left: draggingPos.x - full / 2,
                    top:  draggingPos.y - full / 2,
                    transform: "rotate(-4deg) scale(1.05)",
                  }}>
                  <svg width="100%" height="100%"
                    viewBox={`${-dt} ${-dt} ${full} ${full}`}
                    style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.4))" }}>
                    <defs>
                      <clipPath id={`clip-drag-${p.id}`}>
                        <path d={piecePath(edges, ds, dt)} />
                      </clipPath>
                    </defs>
                    <image href={imageUrl}
                      x={-origC * ds} y={-origR * ds}
                      width={gridN * ds} height={gridN * ds}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#clip-drag-${p.id})`} />
                    <path d={piecePath(edges, ds, dt)}
                      fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth={2.5} />
                  </svg>
                </div>
              );
            })()}

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
