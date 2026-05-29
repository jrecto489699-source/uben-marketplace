"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft, RotateCcw, Download, Maximize, Minimize,
  Minus, Plus, ChevronLeft, ChevronRight, BookOpen, Sparkles,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { allProducts } from "@/data/products";

// ── Canvas ────────────────────────────────────────────────────────────────────
const CANVAS_W = 800;
const CANVAS_H = 1040;
const SCRATCH_THRESHOLD = 65; // % scratched → auto-reveal

// ── PDF.js (lazy, client-only) ────────────────────────────────────────────────
let _pdfjs: typeof import("pdfjs-dist") | null = null;
async function getPdfJs() {
  if (!_pdfjs) {
    _pdfjs = await import("pdfjs-dist");
    _pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return _pdfjs;
}

// ── Confetti particle ─────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; life: number;
  rotation: number; rotSpeed: number;
}

// ── Color themes applied over the revealed PDF page ──────────────────────────
type ThemeId = "rainbow" | "galaxy" | "sunset" | "ocean";
const THEMES: { id: ThemeId; name: string; emoji: string; stops: string[] }[] = [
  { id: "rainbow", name: "Rainbow",  emoji: "🌈", stops: ["#FF0040","#FF6600","#FFD700","#00DD44","#00AAFF","#AA44FF"] },
  { id: "galaxy",  name: "Galaxy",   emoji: "✨", stops: ["#FF88FF","#AA00FF","#4400CC","#0044FF","#00CCFF"] },
  { id: "sunset",  name: "Sunset",   emoji: "🌅", stops: ["#FF2D55","#FF6B35","#FFD700","#FF44AA","#AA00FF"] },
  { id: "ocean",   name: "Ocean",    emoji: "🌊", stops: ["#00FFCC","#00AAFF","#0055FF","#00DDAA","#44FFAA"] },
];

function applyThemeGradient(ctx: CanvasRenderingContext2D, themeId: ThemeId) {
  const t = THEMES.find(x => x.id === themeId)!;
  const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  t.stops.forEach((c, i) => grad.addColorStop(i / (t.stops.length - 1), c));
  // multiply blend: white PDF areas become colorful, black lines stay dark
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.globalCompositeOperation = "source-over";
}

export default function ScratchPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();
  const { user } = useAuth();
  const supabase = createClient();

  const purchase = purchases.find(p => p.id === purchaseId);
  const product  = purchase ? allProducts.find(p => p.id === purchase.product_id) : null;

  // ── Canvas refs ───────────────────────────────────────────────────────────
  const revealRef    = useRef<HTMLCanvasElement>(null); // PDF + color gradient
  const scratchRef   = useRef<HTMLCanvasElement>(null); // black coating
  const confettiRef  = useRef<HTMLCanvasElement>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  // ── Drawing refs ──────────────────────────────────────────────────────────
  const lastPos    = useRef<{ x: number; y: number } | null>(null);
  const isDrawing  = useRef(false);
  const animRef    = useRef<number | null>(null);
  const particles  = useRef<Particle[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef  = useRef<any>(null);
  const pageDataRef = useRef<Record<number, string>>({}); // page → scratch dataURL
  const currentPageRef = useRef(0);

  // ── State ─────────────────────────────────────────────────────────────────
  const [theme,          setTheme]          = useState<ThemeId>("rainbow");
  const [brushSize,      setBrushSize]      = useState(40);
  const [scratchPct,     setScratchPct]     = useState(0);
  const [isRevealed,     setIsRevealed]     = useState(false);
  const [isAutoClearing, setIsAutoClearing] = useState(false);
  const [isFullscreen,   setIsFullscreen]   = useState(false);
  const [pdfLoading,     setPdfLoading]     = useState(true);
  const [pdfError,       setPdfError]       = useState<string | null>(null);
  const [totalPages,     setTotalPages]     = useState(0);
  const [currentPage,    setCurrentPage]    = useState(0);
  const [thumbnails,     setThumbnails]     = useState<string[]>([]);
  const [pageLoading,    setPageLoading]    = useState(false);
  const [saved,          setSaved]          = useState(false);

  useEffect(() => { getPdfJs(); }, []);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // ── Render PDF page to reveal canvas (PDF + color theme) ─────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function renderRevealPage(doc: any, pageIndex: number, themeId: ThemeId) {
    const canvas = revealRef.current;
    if (!canvas) return;
    const page = await doc.getPage(pageIndex + 1);
    const natural = page.getViewport({ scale: 1 });
    const scale = Math.min(CANVAS_W / natural.width, CANVAS_H / natural.height);
    const vp = page.getViewport({ scale });
    const tmp = document.createElement("canvas");
    tmp.width = Math.round(vp.width); tmp.height = Math.round(vp.height);
    await page.render({ canvasContext: tmp.getContext("2d")!, viewport: vp }).promise;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const x = Math.round((CANVAS_W - tmp.width) / 2);
    const y = Math.round((CANVAS_H - tmp.height) / 2);
    ctx.drawImage(tmp, x, y);
    // Apply color theme gradient via multiply blend
    applyThemeGradient(ctx, themeId);
  }

  // ── Draw black coating ────────────────────────────────────────────────────
  function drawCoating() {
    const canvas = scratchRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    canvas.style.opacity = "1";
  }

  // ── Render thumbnails ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function renderThumbnails(doc: any) {
    const result: string[] = [];
    for (let i = 0; i < doc.numPages; i++) {
      const page = await doc.getPage(i + 1);
      const natural = page.getViewport({ scale: 1 });
      const scale = 120 / natural.width;
      const vp = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      result.push(c.toDataURL("image/jpeg", 0.7));
      setThumbnails([...result]);
    }
  }

  // ── Load PDF ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!purchase?.id) return;
    async function loadPdf() {
      setPdfLoading(true); setPdfError(null);
      try {
        const [res, lib] = await Promise.all([
          fetch(`/api/scratch-pdf/${purchase!.id}`),
          getPdfJs(),
        ]);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setPdfError(body.error ?? "Scratch PDF not available yet");
          setPdfLoading(false); return;
        }
        const { url } = await res.json();
        const doc = await lib.getDocument({ url, rangeChunkSize: 65536, disableAutoFetch: true }).promise;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        await renderRevealPage(doc, 0, theme);
        drawCoating();
        setPdfLoading(false);
        setScratchPct(0); setIsRevealed(false);
        renderThumbnails(doc);
      } catch {
        setPdfError("Failed to load scratch book");
        setPdfLoading(false);
      }
    }
    loadPdf();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase?.id, user?.id]);

  // ── Switch page ───────────────────────────────────────────────────────────
  async function switchPage(newPage: number) {
    const doc = pdfDocRef.current;
    if (!doc || newPage < 0 || newPage >= totalPages || newPage === currentPageRef.current) return;
    setPageLoading(true);
    // Save current scratch state
    if (scratchRef.current) pageDataRef.current[currentPageRef.current] = scratchRef.current.toDataURL();
    setCurrentPage(newPage);
    setIsRevealed(false); setScratchPct(0);
    await renderRevealPage(doc, newPage, theme);
    // Restore or draw fresh coating
    const saved = pageDataRef.current[newPage];
    if (saved) {
      const ctx = scratchRef.current?.getContext("2d");
      if (ctx) {
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        const img = new Image(); img.src = saved;
        await new Promise<void>(r => { img.onload = () => { ctx.drawImage(img, 0, 0); r(); }; });
      }
    } else {
      drawCoating();
    }
    setPageLoading(false);
    setTimeout(() => {
      const strip = thumbStripRef.current;
      if (!strip) return;
      const thumb = strip.children[newPage] as HTMLElement;
      if (thumb) thumb.scrollIntoView({ inline: "center", behavior: "smooth" });
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

  // Keyboard arrows
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

  // ── Scratch brush (soft radial gradient) ─────────────────────────────────
  function scratchAt(x: number, y: number, size: number) {
    const ctx = scratchRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    const r = ctx.createRadialGradient(x, y, 0, x, y, size);
    r.addColorStop(0,    "rgba(0,0,0,1)");
    r.addColorStop(0.65, "rgba(0,0,0,0.95)");
    r.addColorStop(1,    "rgba(0,0,0,0)");
    ctx.fillStyle = r;
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
  }

  function scratchLine(from: { x: number; y: number }, to: { x: number; y: number }, size: number) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.floor(dist / (size * 0.35)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      scratchAt(from.x + dx * t, from.y + dy * t, size);
    }
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
    if (pct >= SCRATCH_THRESHOLD && !isRevealed && !isAutoClearing) autoClear();
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
    if (isRevealed || isAutoClearing || pdfLoading) return;
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent);
    if (!pos) return;
    scratchAt(pos.x, pos.y, brushSize);
    lastPos.current = pos;
    navigator.vibrate?.(8);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing, pdfLoading, brushSize]);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || isRevealed || isAutoClearing) return;
    e.preventDefault();
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent);
    if (!pos) return;
    if (lastPos.current) scratchLine(lastPos.current, pos, brushSize);
    lastPos.current = pos;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing, brushSize]);

  const onPointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false; lastPos.current = null;
    checkPercent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing]);

  // ── Change theme ──────────────────────────────────────────────────────────
  async function changeTheme(t: ThemeId) {
    setTheme(t);
    const doc = pdfDocRef.current;
    if (!doc) return;
    // Save current scratch state, re-render reveal with new theme, restore
    const savedData = scratchRef.current?.toDataURL();
    await renderRevealPage(doc, currentPageRef.current, t);
    if (savedData) {
      const ctx = scratchRef.current?.getContext("2d");
      if (ctx) {
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        const img = new Image(); img.src = savedData;
        await new Promise<void>(r => { img.onload = () => { ctx.drawImage(img, 0, 0); r(); }; });
      }
    }
  }

  // ── Reset current page ────────────────────────────────────────────────────
  function reset() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    particles.current = [];
    confettiRef.current?.getContext("2d")?.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawCoating();
    setScratchPct(0); setIsRevealed(false); setIsAutoClearing(false);
    delete pageDataRef.current[currentPageRef.current];
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

  const adjustBrush = (d: number) => setBrushSize(s => Math.max(10, Math.min(80, s + d)));

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

          {/* Page indicator */}
          {totalPages > 0 && (
            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              <BookOpen size={13} className="text-ink-muted" />
              <span className="text-xs text-ink-muted tabular-nums">
                Page <span className="font-semibold text-ink">{currentPage + 1}</span> of {totalPages}
              </span>
            </div>
          )}

          {/* Scratch progress */}
          {!pdfLoading && !pdfError && (
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <div className="w-20 h-1.5 rounded-full bg-card-hover overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${scratchPct}%`, background: "linear-gradient(90deg,#FF6600,#FFD700,#AA44FF)" }} />
              </div>
              <span className="text-[11px] text-ink-muted tabular-nums">{scratchPct}%</span>
            </div>
          )}

          <span className={`text-[11px] shrink-0 transition-opacity duration-300 ${saved ? "opacity-100 text-[#258635]" : "opacity-0"}`}>Saved</span>

          {!pdfError && (
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

            {/* Color theme */}
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

            {/* Brush size */}
            <div>
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Scratch Size — {brushSize}px</p>
              <div className="flex items-center gap-2">
                <button onClick={() => adjustBrush(-5)} className="w-7 h-7 rounded-full bg-[#EDEBE6] hover:bg-card-hover flex items-center justify-center transition-colors shrink-0">
                  <Minus size={12} />
                </button>
                <input type="range" min={10} max={80} value={brushSize}
                  onChange={e => setBrushSize(Number(e.target.value))}
                  className="flex-1 cursor-pointer" style={{ accentColor: "#222" }} />
                <button onClick={() => adjustBrush(5)} className="w-7 h-7 rounded-full bg-[#EDEBE6] hover:bg-card-hover flex items-center justify-center transition-colors shrink-0">
                  <Plus size={12} />
                </button>
              </div>
              <div className="flex justify-between mt-2">
                {[15, 30, 50, 70].map(s => (
                  <button key={s} onClick={() => setBrushSize(s)} className="flex items-center justify-center w-8 h-8">
                    <div className={`rounded-full transition-colors ${brushSize === s ? "bg-ink" : "bg-[#C5C0B8] hover:bg-ink/60"}`}
                      style={{ width: s / 5 + 6, height: s / 5 + 6 }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Progress */}
            {!pdfLoading && !pdfError && (
              <div>
                <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Revealed</p>
                <div className="w-full h-2 rounded-full bg-card-hover overflow-hidden mb-1">
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${scratchPct}%`, background: "linear-gradient(90deg,#FF6600,#FFD700,#AA44FF)" }} />
                </div>
                <p className="text-xs text-ink-muted text-right tabular-nums">{scratchPct}%</p>
              </div>
            )}

            {/* Tip */}
            <div className="mt-auto pt-4 border-t border-border-muted">
              <p className="text-[11px] text-ink-muted leading-relaxed">
                {isRevealed
                  ? "🎉 Fully revealed! Hit Reset to scratch again."
                  : `Scratch the black surface to reveal the hidden ${THEMES.find(t => t.id === theme)?.name.toLowerCase()} art!`}
              </p>
            </div>
          </aside>

          {/* ── Canvas area ──────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">

            {/* Loading overlay */}
            {pdfLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: "#EDEBE6" }}>
                {product?.image && (
                  <img src={product.image} alt="" className="absolute inset-0 w-full h-full object-contain opacity-20 blur-md pointer-events-none select-none" />
                )}
                <div className="relative text-center z-10">
                  <div className="w-10 h-10 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-ink-muted">Loading scratch book…</p>
                </div>
              </div>
            )}

            {/* Error */}
            {!pdfLoading && pdfError && (
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
              {/* Scroll viewport */}
              <div className="absolute inset-0 overflow-auto flex items-center justify-center" style={{ background: "#EDEBE6" }}>
                <div style={{ transform: "scale(1)", transformOrigin: "center center" }}>
                  <div className="relative select-none rounded-2xl overflow-hidden shadow-lg"
                    style={{ width: 680, height: Math.round(680 * (CANVAS_H / CANVAS_W)) }}>

                    {/* Page loading overlay */}
                    {pageLoading && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 rounded-2xl">
                        <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}

                    {/* Layer 1 — Reveal (PDF + color) */}
                    <canvas ref={revealRef} width={CANVAS_W} height={CANVAS_H}
                      className="absolute inset-0 w-full h-full" />

                    {/* Layer 2 — Black scratch coating */}
                    <canvas ref={scratchRef} width={CANVAS_W} height={CANVAS_H}
                      className="absolute inset-0 w-full h-full"
                      style={{ cursor: isRevealed ? "default" : "crosshair", touchAction: "none" }}
                      onMouseDown={onPointerDown} onMouseMove={onPointerMove}
                      onMouseUp={onPointerUp}    onMouseLeave={onPointerUp}
                      onTouchStart={onPointerDown} onTouchMove={onPointerMove}
                      onTouchEnd={onPointerUp} />

                    {/* Layer 3 — Confetti */}
                    <canvas ref={confettiRef} width={CANVAS_W} height={CANVAS_H}
                      className="absolute inset-0 w-full h-full pointer-events-none" />

                    {/* Scratch hint */}
                    {!pdfLoading && !pdfError && scratchPct === 0 && !isRevealed && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <Sparkles size={32} strokeWidth={1.5} className="text-white/50 mx-auto mb-2 animate-pulse" />
                          <p className="text-white/50 text-sm font-medium">Scratch to reveal!</p>
                        </div>
                      </div>
                    )}

                    {/* Celebration */}
                    {isRevealed && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-lg">
                          <p className="text-4xl mb-2 animate-bounce">🎉</p>
                          <p className="font-serif text-xl text-ink font-semibold">Amazing reveal!</p>
                          <p className="text-sm text-ink-muted mt-1">Hit Reset to scratch again</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Page arrows */}
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
            {!pdfLoading && !pdfError && totalPages > 0 && (
              <div className="bg-[#E8E4DC] border-t border-border-muted shrink-0">
                <div ref={thumbStripRef} className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button key={i} onClick={() => switchPage(i)}
                      className={`flex-shrink-0 flex flex-col items-center gap-1 transition-opacity ${currentPage === i ? "opacity-100" : "opacity-50 hover:opacity-75"}`}>
                      <div className={`rounded-lg overflow-hidden border-2 bg-white transition-all ${currentPage === i ? "border-ink shadow-md" : "border-transparent"}`}
                        style={{ width: 60 }}>
                        {thumbnails[i]
                          ? <img src={thumbnails[i]} alt={`Page ${i + 1}`} className="w-full h-auto block" />
                          : <div className="w-full bg-[#E8E4DC] animate-pulse" style={{ height: 78 }} />}
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
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                theme === t.id ? "bg-ink text-cream" : "bg-[#EDEBE6] text-ink"
              }`}>
              {t.emoji} {t.name}
            </button>
          ))}
          <div className="w-px h-6 bg-border-muted shrink-0 mx-1" />
          {[15, 35, 60].map(s => (
            <button key={s} onClick={() => setBrushSize(s)}
              className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors ${brushSize === s ? "bg-ink" : "bg-[#EDEBE6]"}`}>
              <div className={`rounded-full ${brushSize === s ? "bg-cream" : "bg-ink"}`} style={{ width: s / 8 + 6, height: s / 8 + 6 }} />
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
