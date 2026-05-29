"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft, RotateCcw, Download, Maximize, Minimize,
  ChevronLeft, ChevronRight, BookOpen, Sparkles,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { allProducts } from "@/data/products";

const CANVAS_W = 800;
const CANVAS_H = 1040;

// ── Confetti particle ─────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; life: number;
  rotation: number; rotSpeed: number;
}

// ── Color themes ──────────────────────────────────────────────────────────────
// Each theme paints a vivid neon gradient on top of the reveal canvas.
// We then use a "multiply" blend so white lines pick up the color and black
// background stays black — exactly like real scratch-art foil.
type ThemeId = "rainbow" | "galaxy" | "sunset" | "ocean";

interface Theme {
  id: ThemeId;
  name: string;
  emoji: string;
  paint: (ctx: CanvasRenderingContext2D) => void;
}

const THEMES: Theme[] = [
  {
    id: "rainbow", name: "Rainbow", emoji: "🌈",
    paint(ctx) {
      // Base diagonal rainbow (top-left → bottom-right)
      const g1 = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
      g1.addColorStop(0.00, "#FF1493"); // hot pink
      g1.addColorStop(0.15, "#FF0080"); // magenta
      g1.addColorStop(0.30, "#9400FF"); // violet
      g1.addColorStop(0.45, "#3D00FF"); // deep blue
      g1.addColorStop(0.55, "#00BFFF"); // cyan-blue
      g1.addColorStop(0.70, "#00FF7F"); // spring green
      g1.addColorStop(0.82, "#FFFF00"); // pure yellow
      g1.addColorStop(0.92, "#FF6B00"); // orange
      g1.addColorStop(1.00, "#FF0000"); // red
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Second radial overlay from upper-center to add the glowing
      // "centered hot spot" look from real scratch art
      const g2 = ctx.createRadialGradient(
        CANVAS_W * 0.55, CANVAS_H * 0.35, CANVAS_W * 0.05,
        CANVAS_W * 0.55, CANVAS_H * 0.35, CANVAS_W * 0.8
      );
      g2.addColorStop(0.00, "rgba(255, 0, 200, 0.55)"); // magenta core
      g2.addColorStop(0.30, "rgba(180, 0, 255, 0.30)"); // purple mid
      g2.addColorStop(1.00, "rgba(0, 200, 255, 0.00)"); // fade
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalCompositeOperation = "source-over";
    },
  },
  {
    id: "galaxy", name: "Galaxy", emoji: "✨",
    paint(ctx) {
      const g = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
      g.addColorStop(0.00, "#FF00FF"); // magenta
      g.addColorStop(0.25, "#9D00FF"); // violet
      g.addColorStop(0.50, "#3D00FF"); // deep blue
      g.addColorStop(0.75, "#00BFFF"); // cyan
      g.addColorStop(1.00, "#FF1493"); // hot pink
      ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const r = ctx.createRadialGradient(CANVAS_W*0.5, CANVAS_H*0.45, 50, CANVAS_W*0.5, CANVAS_H*0.45, CANVAS_W*0.7);
      r.addColorStop(0, "rgba(255,255,255,0.35)");
      r.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = r; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalCompositeOperation = "source-over";
    },
  },
  {
    id: "sunset", name: "Sunset", emoji: "🌅",
    paint(ctx) {
      const g = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
      g.addColorStop(0.00, "#FF006E"); // hot pink
      g.addColorStop(0.25, "#FB5607"); // orange
      g.addColorStop(0.50, "#FFBE0B"); // yellow
      g.addColorStop(0.75, "#FF006E"); // pink
      g.addColorStop(1.00, "#8338EC"); // purple
      ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    },
  },
  {
    id: "ocean", name: "Ocean", emoji: "🌊",
    paint(ctx) {
      const g = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
      g.addColorStop(0.00, "#00FFE0"); // bright cyan
      g.addColorStop(0.25, "#00BFFF"); // azure
      g.addColorStop(0.50, "#0066FF"); // electric blue
      g.addColorStop(0.75, "#7B00FF"); // purple
      g.addColorStop(1.00, "#00FFAA"); // mint
      ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    },
  },
];

// ── Load an image URL into an HTMLImageElement ────────────────────────────────
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// ── Draw image centered + scaled on canvas ────────────────────────────────────
function drawImageCentered(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const scale = Math.min(CANVAS_W / img.naturalWidth, CANVAS_H / img.naturalHeight);
  const dw = img.naturalWidth  * scale;
  const dh = img.naturalHeight * scale;
  const dx = Math.round((CANVAS_W - dw) / 2);
  const dy = Math.round((CANVAS_H - dh) / 2);
  ctx.drawImage(img, dx, dy, dw, dh);
}

export default function ScratchPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  const purchase = purchases.find(p => p.id === purchaseId);
  const product  = purchase ? allProducts.find(p => p.id === purchase.product_id) : null;

  // ── Canvas refs ───────────────────────────────────────────────────────────
  // revealRef  = bottom: image + rainbow colors (what gets uncovered)
  // scratchRef = top:    image normally (white lines on black — gets scratched)
  const revealRef    = useRef<HTMLCanvasElement>(null);
  const scratchRef   = useRef<HTMLCanvasElement>(null);
  const confettiRef  = useRef<HTMLCanvasElement>(null);
  const cursorRef    = useRef<HTMLDivElement>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const lastPos        = useRef<{ x: number; y: number } | null>(null);
  const isDrawing      = useRef(false);
  const animRef        = useRef<number | null>(null);
  const particles      = useRef<Particle[]>([]);
  const imageUrls      = useRef<string[]>([]);
  const loadedImages   = useRef<Record<number, HTMLImageElement>>({});
  const currentPageRef = useRef(0);

  const [theme,          setTheme]          = useState<ThemeId>("rainbow");
  const [brushSize,      setBrushSize]      = useState(4); // thin default — precision scratching
  const [scratchPct,     setScratchPct]     = useState(0);
  const [isRevealed,     setIsRevealed]     = useState(false);
  const [isAutoClearing, setIsAutoClearing] = useState(false);
  const [isFullscreen,   setIsFullscreen]   = useState(false);
  const [imgLoading,     setImgLoading]     = useState(true);
  const [imgError,       setImgError]       = useState<string | null>(null);
  const [totalPages,     setTotalPages]     = useState(0);
  const [currentPage,    setCurrentPage]    = useState(0);
  const [thumbnails,     setThumbnails]     = useState<string[]>([]);
  const [pageLoading,    setPageLoading]    = useState(false);
  const [saved,          setSaved]          = useState(false);

  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // ── Get or load image for a page ──────────────────────────────────────────
  async function getImage(pageIndex: number): Promise<HTMLImageElement | null> {
    if (loadedImages.current[pageIndex]) return loadedImages.current[pageIndex];
    const url = imageUrls.current[pageIndex];
    if (!url) return null;
    try {
      const img = await loadImage(url);
      loadedImages.current[pageIndex] = img;
      return img;
    } catch { return null; }
  }

  // ── Reveal layer: image + neon rainbow (multiply blend) ──────────────────
  // Black background × any color = black, so the bg stays pure black.
  // White lines × theme color = the color, so lines turn neon rainbow.
  async function renderRevealLayer(pageIndex: number, themeId: ThemeId) {
    const canvas = revealRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const img = await getImage(pageIndex);
    if (!img) return;
    drawImageCentered(ctx, img);
    ctx.globalCompositeOperation = "multiply";
    const theme = THEMES.find(t => t.id === themeId)!;
    theme.paint(ctx);
    ctx.globalCompositeOperation = "source-over";
  }

  // ── Scratch layer: image normally (white lines on black) ──────────────────
  async function renderScratchLayer(pageIndex: number) {
    const canvas = scratchRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const img = await getImage(pageIndex);
    if (!img) return;
    ctx.globalCompositeOperation = "source-over";
    drawImageCentered(ctx, img);
    canvas.style.opacity = "1";
  }

  // ── Load all image URLs from API ──────────────────────────────────────────
  useEffect(() => {
    if (!purchase?.id) return;
    async function load() {
      setImgLoading(true); setImgError(null);
      try {
        const res = await fetch(`/api/scratch-images/${purchase!.id}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setImgError(body.error ?? "Scratch images not available yet");
          setImgLoading(false); return;
        }
        const { urls, total } = await res.json();
        imageUrls.current = urls;
        setTotalPages(total);
        // Render first page
        await Promise.all([
          renderRevealLayer(0, theme),
          renderScratchLayer(0),
        ]);
        setImgLoading(false);
        setScratchPct(0); setIsRevealed(false);
        // Build thumbnails from already-loaded image for page 0
        buildThumbnails(urls);
      } catch {
        setImgError("Failed to load scratch images");
        setImgLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase?.id]);

  // ── Build thumbnail data URLs ─────────────────────────────────────────────
  async function buildThumbnails(urls: string[]) {
    const result: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      try {
        const img = await getImage(i);
        if (!img) { result.push(""); setThumbnails([...result]); continue; }
        const c = document.createElement("canvas");
        const scale = 120 / img.naturalWidth;
        c.width  = Math.round(img.naturalWidth  * scale);
        c.height = Math.round(img.naturalHeight * scale);
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, c.width, c.height);
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
    setCurrentPage(newPage); setIsRevealed(false); setScratchPct(0);
    await Promise.all([
      renderRevealLayer(newPage, theme),
      renderScratchLayer(newPage),
    ]);
    setPageLoading(false);
    setTimeout(() => {
      const strip = thumbStripRef.current;
      if (!strip) return;
      (strip.children[newPage] as HTMLElement)?.scrollIntoView({ inline: "center", behavior: "smooth" });
    }, 50);
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

  // Arrow key navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "ArrowRight") { e.preventDefault(); nextPage(); }
      if (e.code === "ArrowLeft")  { e.preventDefault(); prevPage(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, totalPages]);

  // ── Coordinate helper ─────────────────────────────────────────────────────
  function getPos(e: MouseEvent | TouchEvent) {
    const canvas = scratchRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = CANVAS_W / rect.width, sy = CANVAS_H / rect.height;
    if ("touches" in e) {
      const t = (e as TouchEvent).touches[0] || (e as TouchEvent).changedTouches[0];
      if (!t) return null;
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }
    const m = e as MouseEvent;
    return { x: (m.clientX - rect.left) * sx, y: (m.clientY - rect.top) * sy };
  }

  // ── Scratch stroke (hard-edged line like a coin/stylus) ───────────────────
  function scratchStroke(from: { x: number; y: number }, to: { x: number; y: number }, size: number) {
    const ctx = scratchRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = size * 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke();
  }

  function scratchDot(pos: { x: number; y: number }, size: number) {
    const ctx = scratchRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,1)"; ctx.fill();
  }

  // ── Check scratch % ───────────────────────────────────────────────────────
  function checkPercent() {
    const ctx = scratchRef.current?.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H).data;
    let transparent = 0;
    const step = 4, total = (CANVAS_W * CANVAS_H) / step;
    for (let i = 3; i < data.length; i += 4 * step) { if (data[i] < 128) transparent++; }
    const pct = Math.min(Math.round((transparent / total) * 100), 100);
    setScratchPct(pct);
    if (pct >= 70 && !isRevealed && !isAutoClearing) autoClear();
  }

  // ── Auto-clear ────────────────────────────────────────────────────────────
  async function autoClear() {
    setIsAutoClearing(true);
    navigator.vibrate?.([80, 40, 160, 40, 300]);
    const canvas = scratchRef.current;
    if (!canvas) return;
    canvas.style.transition = "opacity 0.85s ease-out";
    canvas.style.opacity = "0";
    await new Promise(r => setTimeout(r, 900));
    canvas.getContext("2d")?.clearRect(0, 0, CANVAS_W, CANVAS_H);
    canvas.style.transition = ""; canvas.style.opacity = "1";
    setIsRevealed(true); setIsAutoClearing(false); setScratchPct(100);
    launchConfetti();
  }

  // ── Confetti ──────────────────────────────────────────────────────────────
  function launchConfetti() {
    const colors = ["#FF0040","#FF6600","#FFD700","#00DD44","#00AAFF","#AA44FF","#FF44AA"];
    particles.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * CANVAS_W, y: -20,
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
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
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
    } else { ctx.clearRect(0, 0, CANVAS_W, CANVAS_H); }
  }

  // ── Pointer handlers ──────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isRevealed || isAutoClearing || imgLoading || !!imgError) return;
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent);
    if (!pos) return;
    scratchDot(pos, brushSize);
    lastPos.current = pos;
    navigator.vibrate?.(5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing, imgLoading, imgError, brushSize]);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isRevealed || isAutoClearing) return;
    e.preventDefault();

    // Update cursor ring position (mouse only — touch doesn't need it)
    if (!("touches" in e) && cursorRef.current && scratchRef.current) {
      const rect = scratchRef.current.getBoundingClientRect();
      cursorRef.current.style.display = "block";
      cursorRef.current.style.left = (e.clientX - rect.left) + "px";
      cursorRef.current.style.top  = (e.clientY - rect.top)  + "px";
    }

    if (!isDrawing.current) return;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent);
    if (!pos) return;
    if (lastPos.current) scratchStroke(lastPos.current, pos, brushSize);
    lastPos.current = pos;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing, brushSize]);

  const onPointerEnter = useCallback(() => {
    if (cursorRef.current) cursorRef.current.style.display = "block";
  }, []);

  const onPointerLeave = useCallback(() => {
    if (cursorRef.current) cursorRef.current.style.display = "none";
    if (isDrawing.current) {
      isDrawing.current = false; lastPos.current = null;
      checkPercent();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing]);

  const onPointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false; lastPos.current = null;
    checkPercent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing]);

  // ── Change theme ──────────────────────────────────────────────────────────
  async function changeTheme(t: ThemeId) {
    setTheme(t);
    await renderRevealLayer(currentPageRef.current, t);
  }

  // ── Reset current page ────────────────────────────────────────────────────
  async function reset() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    particles.current = [];
    confettiRef.current?.getContext("2d")?.clearRect(0, 0, CANVAS_W, CANVAS_H);
    await renderScratchLayer(currentPageRef.current);
    setScratchPct(0); setIsRevealed(false); setIsAutoClearing(false);
  }

  // ── Save PNG ──────────────────────────────────────────────────────────────
  function savePNG() {
    const out = document.createElement("canvas");
    out.width = CANVAS_W; out.height = CANVAS_H;
    const ctx = out.getContext("2d")!;
    if (revealRef.current)  ctx.drawImage(revealRef.current, 0, 0);
    if (scratchRef.current) ctx.drawImage(scratchRef.current, 0, 0);
    const a = document.createElement("a");
    a.download = `${product?.title ?? "scratch"}-page${currentPage + 1}.png`;
    a.href = out.toDataURL("image/png"); a.click();
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

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
              <div className="w-20 h-1.5 rounded-full bg-card-hover overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${scratchPct}%`, background: "linear-gradient(90deg,#FF6600,#FFD700,#AA44FF)" }} />
              </div>
              <span className="text-[11px] text-ink-muted tabular-nums">{scratchPct}%</span>
            </div>
          )}

          <span className={`text-[11px] shrink-0 transition-opacity duration-300 ${saved ? "opacity-100 text-[#258635]" : "opacity-0"}`}>Saved</span>

          {!imgError && (
            <button onClick={reset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EDEBE6] hover:bg-card-hover text-ink text-xs font-medium transition-colors shrink-0">
              <RotateCcw size={12} />Reset
            </button>
          )}

          <button onClick={toggleFullscreen}
            className="w-8 h-8 rounded-full bg-[#EDEBE6] flex items-center justify-center hover:bg-card-hover transition-colors shrink-0">
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>

          <button onClick={savePNG}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink text-cream text-xs font-medium hover:bg-[#3a3a3a] transition-colors shrink-0">
            <Download size={12} />Save PNG
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* Sidebar — desktop */}
          <aside className="hidden md:flex flex-col gap-5 w-56 bg-cream border-r border-border-muted p-4 overflow-y-auto shrink-0">

            <div>
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Reveal Color</p>
              <div className="flex flex-col gap-1">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => changeTheme(t.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                      theme === t.id ? "bg-ink text-cream" : "text-ink hover:bg-[#EDEBE6]"
                    }`}>
                    <span>{t.emoji}</span>{t.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">
                Scratch Size — {brushSize}px
              </p>
              <input type="range" min={2} max={20} value={brushSize}
                onChange={e => setBrushSize(Number(e.target.value))}
                className="w-full cursor-pointer mb-3" style={{ accentColor: "#222" }} />
              <div className="flex gap-2">
                {[{ label: "Fine", size: 3 }, { label: "Med", size: 6 }, { label: "Wide", size: 12 }].map(b => (
                  <button key={b.size} onClick={() => setBrushSize(b.size)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      brushSize === b.size ? "bg-ink text-cream" : "bg-[#EDEBE6] text-ink hover:bg-card-hover"
                    }`}>{b.label}
                  </button>
                ))}
              </div>
            </div>

            {!imgLoading && !imgError && (
              <div>
                <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Revealed</p>
                <div className="w-full h-2 rounded-full bg-card-hover overflow-hidden mb-1">
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${scratchPct}%`, background: "linear-gradient(90deg,#FF6600,#FFD700,#AA44FF)" }} />
                </div>
                <p className="text-xs text-ink-muted text-right tabular-nums">{scratchPct}%</p>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-border-muted">
              <p className="text-[11px] text-ink-muted leading-relaxed">
                {isRevealed
                  ? "🎉 Fully revealed! Hit Reset to scratch again."
                  : "Scratch the white lines to reveal hidden rainbow colors underneath!"}
              </p>
            </div>
          </aside>

          {/* ── Canvas area ──────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">

            {/* Loading overlay */}
            {imgLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: "#EDEBE6" }}>
                {product?.image && (
                  <img src={product.image} alt="" className="absolute inset-0 w-full h-full object-contain opacity-20 blur-md pointer-events-none select-none" />
                )}
                <div className="relative z-10 text-center">
                  <div className="w-10 h-10 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-ink-muted">Loading scratch book…</p>
                </div>
              </div>
            )}

            {/* Error */}
            {!imgLoading && imgError && (
              <div className="absolute inset-0 z-20 flex items-center justify-center px-6" style={{ background: "#EDEBE6" }}>
                <div className="text-center max-w-sm">
                  <Sparkles size={40} strokeWidth={1.2} className="text-ink-muted mx-auto mb-4" />
                  <p className="font-serif text-xl text-ink mb-2">Scratch pages coming soon</p>
                  <p className="text-sm text-ink-muted">The interactive scratch book for this product is being prepared. Check back soon!</p>
                </div>
              </div>
            )}

            {/* Canvas always mounted */}
            <div className="flex-1 relative overflow-hidden min-h-0">
              <div className="absolute inset-0 overflow-auto flex items-center justify-center" style={{ background: "#EDEBE6" }}>
                <div className="relative rounded-2xl overflow-hidden shadow-lg select-none"
                  style={{ width: 680, height: Math.round(680 * (CANVAS_H / CANVAS_W)) }}>

                  {pageLoading && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 rounded-2xl">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {/* Layer 1 — Reveal: image + rainbow colors */}
                  <canvas ref={revealRef} width={CANVAS_W} height={CANVAS_H}
                    className="absolute inset-0 w-full h-full" />

                  {/* Layer 2 — Scratch: image normally (white lines on black) */}
                  <canvas ref={scratchRef} width={CANVAS_W} height={CANVAS_H}
                    className="absolute inset-0 w-full h-full"
                    style={{ cursor: isRevealed ? "default" : "none", touchAction: "none" }}
                    onMouseDown={onPointerDown} onMouseMove={onPointerMove}
                    onMouseUp={onPointerUp}    onMouseLeave={onPointerLeave}
                    onMouseEnter={onPointerEnter}
                    onTouchStart={onPointerDown} onTouchMove={onPointerMove}
                    onTouchEnd={onPointerUp} />

                  {/* Layer 3 — Confetti */}
                  <canvas ref={confettiRef} width={CANVAS_W} height={CANVAS_H}
                    className="absolute inset-0 w-full h-full pointer-events-none" />

                  {/* Custom cursor ring — shows exact scratch radius */}
                  {!isRevealed && !imgLoading && !imgError && (
                    <div ref={cursorRef}
                      className="absolute pointer-events-none rounded-full -translate-x-1/2 -translate-y-1/2"
                      style={{
                        width:  brushSize * 2 * (680 / CANVAS_W),
                        height: brushSize * 2 * (680 / CANVAS_W),
                        border: "1.5px solid rgba(255,255,255,0.85)",
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.5)",
                        display: "none", // shown by pointer handler
                        zIndex: 5,
                      }} />
                  )}

                  {/* Hint */}
                  {!imgLoading && !imgError && scratchPct === 0 && !isRevealed && (
                    <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none">
                      <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                        <Sparkles size={13} className="text-white/70" />
                        <p className="text-white/70 text-xs font-medium">Scratch to reveal rainbow colors!</p>
                      </div>
                    </div>
                  )}

                  {/* Celebration */}
                  {isRevealed && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center bg-white/85 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-lg">
                        <p className="text-4xl mb-2 animate-bounce">🎉</p>
                        <p className="font-serif text-xl text-ink font-semibold">Amazing!</p>
                        <p className="text-sm text-ink-muted mt-1">Hit Reset to scratch again</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {currentPage > 0 && (
                <button onClick={prevPage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-ink/80 hover:bg-ink text-cream flex items-center justify-center shadow-lg transition-colors">
                  <ChevronLeft size={20} />
                </button>
              )}
              {currentPage < totalPages - 1 && (
                <button onClick={nextPage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-ink/80 hover:bg-ink text-cream flex items-center justify-center shadow-lg transition-colors">
                  <ChevronRight size={20} />
                </button>
              )}
            </div>

            {/* Thumbnail strip */}
            {!imgLoading && !imgError && totalPages > 0 && (
              <div className="bg-[#E8E4DC] border-t border-border-muted shrink-0">
                <div ref={thumbStripRef} className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button key={i} onClick={() => switchPage(i)}
                      className={`flex-shrink-0 flex flex-col items-center gap-1 transition-opacity ${currentPage === i ? "opacity-100" : "opacity-50 hover:opacity-75"}`}>
                      <div className={`rounded-lg overflow-hidden border-2 bg-black transition-all ${currentPage === i ? "border-ink shadow-md" : "border-transparent"}`}
                        style={{ width: 60 }}>
                        {thumbnails[i]
                          ? <img src={thumbnails[i]} alt={`Page ${i + 1}`} className="w-full h-auto block" />
                          : <div className="w-full bg-[#222] animate-pulse" style={{ height: 78 }} />}
                      </div>
                      <span className={`text-[10px] tabular-nums ${currentPage === i ? "text-ink font-semibold" : "text-ink-muted"}`}>{i + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Mobile bottom toolbar ─────────────────────────────────────── */}
        <div className="md:hidden bg-cream border-t border-border-muted px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
          {THEMES.map(t => (
            <button key={t.id} onClick={() => changeTheme(t.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                theme === t.id ? "bg-ink text-cream" : "bg-[#EDEBE6] text-ink"
              }`}>
              {t.emoji} {t.name}
            </button>
          ))}
          <div className="w-px h-6 bg-border-muted shrink-0 mx-1" />
          {[{ l: "Fine", s: 3 }, { l: "Med", s: 6 }, { l: "Wide", s: 12 }].map(b => (
            <button key={b.s} onClick={() => setBrushSize(b.s)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-colors ${
                brushSize === b.s ? "bg-ink text-cream" : "bg-[#EDEBE6] text-ink"
              }`}>{b.l}
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
          <button onClick={reset} className="ml-auto w-9 h-9 rounded-xl bg-[#EDEBE6] flex items-center justify-center shrink-0">
            <RotateCcw size={15} />
          </button>
        </div>
      </main>
    </>
  );
}
