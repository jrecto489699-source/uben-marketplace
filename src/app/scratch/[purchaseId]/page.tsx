"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, RotateCcw, Download, Maximize, Minimize } from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { allProducts } from "@/data/products";

const CANVAS_W = 800;
const CANVAS_H = 600;
const SCRATCH_THRESHOLD = 65; // % revealed → auto-clear

// ── Brush sizes ───────────────────────────────────────────────────────────────
const BRUSH_PRESETS = [
  { label: "S", size: 18 },
  { label: "M", size: 36 },
  { label: "L", size: 64 },
];

// ── Confetti particle ─────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string; size: number;
  life: number; maxLife: number;
  rotation: number; rotSpeed: number;
}

// ── Rainbow theme drawers ─────────────────────────────────────────────────────
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.4;
    i === 0 ? ctx.moveTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle))
             : ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.3);
  ctx.bezierCurveTo(x - s, y + s * 0.7, x, y + s * 1.1, x, y + s * 1.3);
  ctx.bezierCurveTo(x, y + s * 1.1, x + s, y + s * 0.7, x + s, y + s * 0.3);
  ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.3);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSpiral(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 4; a += 0.15) {
    const radius = (r * a) / (Math.PI * 4);
    const px = x + radius * Math.cos(a);
    const py = y + radius * Math.sin(a);
    a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

type ThemeId = "rainbow" | "galaxy" | "tropical";

const THEMES: { id: ThemeId; name: string; emoji: string; draw: (ctx: CanvasRenderingContext2D) => void }[] = [
  {
    id: "rainbow",
    name: "Rainbow",
    emoji: "🌈",
    draw(ctx) {
      // Bold diagonal rainbow gradient
      const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
      const stops = ["#FF0040","#FF6600","#FFD700","#00DD44","#00AAFF","#AA44FF","#FF44AA"];
      stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // Gold stars
      const rng = mulberry32(42);
      for (let i = 0; i < 40; i++) drawStar(ctx, rng() * CANVAS_W, rng() * CANVAS_H, 8 + rng() * 14, "rgba(255,255,255,0.85)");
      // White hearts
      for (let i = 0; i < 20; i++) drawHeart(ctx, rng() * CANVAS_W, rng() * CANVAS_H, 8 + rng() * 10, "rgba(255,255,255,0.7)");
      // Bright confetti rectangles
      const confColors = ["#FF0040","#FFD700","#00AAFF","#FF6600","#AA44FF"];
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = confColors[Math.floor(rng() * confColors.length)] + "CC";
        ctx.save(); ctx.translate(rng() * CANVAS_W, rng() * CANVAS_H);
        ctx.rotate(rng() * Math.PI); ctx.fillRect(-6, -3, 12, 6); ctx.restore();
      }
    },
  },
  {
    id: "galaxy",
    name: "Galaxy",
    emoji: "✨",
    draw(ctx) {
      // Deep space radial gradient
      const grad = ctx.createRadialGradient(CANVAS_W/2, CANVAS_H/2, 0, CANVAS_W/2, CANVAS_H/2, CANVAS_W * 0.8);
      grad.addColorStop(0,   "#FF88FF");
      grad.addColorStop(0.3, "#8800FF");
      grad.addColorStop(0.6, "#2200AA");
      grad.addColorStop(1,   "#000022");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // Cyan accent gradient overlay
      const grad2 = ctx.createLinearGradient(0, CANVAS_H, CANVAS_W, 0);
      grad2.addColorStop(0, "rgba(0,255,255,0.25)");
      grad2.addColorStop(0.5, "rgba(0,0,0,0)");
      grad2.addColorStop(1, "rgba(255,0,255,0.25)");
      ctx.fillStyle = grad2; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const rng = mulberry32(77);
      // Many tiny white stars
      for (let i = 0; i < 150; i++) {
        const s = rng() * 3 + 1;
        ctx.fillStyle = `rgba(255,255,255,${0.4 + rng() * 0.6})`;
        ctx.beginPath(); ctx.arc(rng() * CANVAS_W, rng() * CANVAS_H, s, 0, Math.PI * 2); ctx.fill();
      }
      // Larger stars
      for (let i = 0; i < 25; i++) drawStar(ctx, rng() * CANVAS_W, rng() * CANVAS_H, 6 + rng() * 12, `hsl(${rng()*60+180},100%,85%)`);
      // Nebula spirals
      for (let i = 0; i < 8; i++) drawSpiral(ctx, rng() * CANVAS_W, rng() * CANVAS_H, 20 + rng() * 40, `hsla(${rng()*360},100%,75%,0.5)`);
      // Planets
      for (let i = 0; i < 4; i++) {
        const px = rng() * CANVAS_W, py = rng() * CANVAS_H, pr = 10 + rng() * 20;
        const pg = ctx.createRadialGradient(px-pr*0.3, py-pr*0.3, pr*0.1, px, py, pr);
        pg.addColorStop(0, "#FFFFFF88"); pg.addColorStop(1, `hsla(${rng()*360},80%,50%,0.9)`);
        ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2); ctx.fill();
      }
    },
  },
  {
    id: "tropical",
    name: "Tropical",
    emoji: "🌺",
    draw(ctx) {
      // Vibrant tropical gradient
      const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
      grad.addColorStop(0,    "#FF6B6B");
      grad.addColorStop(0.25, "#FFC300");
      grad.addColorStop(0.5,  "#2ECC71");
      grad.addColorStop(0.75, "#48DBFB");
      grad.addColorStop(1,    "#FF9FF3");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const rng = mulberry32(99);
      // Flower petals
      for (let i = 0; i < 25; i++) {
        const fx = rng() * CANVAS_W, fy = rng() * CANVAS_H, fr = 6 + rng() * 12;
        const petals = 5;
        const pColor = `hsla(${rng()*360},90%,70%,0.85)`;
        for (let p = 0; p < petals; p++) {
          const a = (p / petals) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr, fr * 0.6, fr * 0.35, a, 0, Math.PI * 2);
          ctx.fillStyle = pColor; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(fx, fy, fr * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,100,0.9)"; ctx.fill();
      }
      // Stars
      for (let i = 0; i < 30; i++) drawStar(ctx, rng() * CANVAS_W, rng() * CANVAS_H, 5 + rng() * 10, "rgba(255,255,255,0.8)");
      // Hearts
      for (let i = 0; i < 15; i++) drawHeart(ctx, rng() * CANVAS_W, rng() * CANVAS_H, 7 + rng() * 9, `hsla(${rng()*60+300},90%,75%,0.85)`);
    },
  },
];

// Deterministic pseudo-random (seeded) so pattern is consistent
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export default function ScratchPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  const purchase = purchases.find(p => p.id === purchaseId);
  const product  = purchase ? allProducts.find(p => p.id === purchase.product_id) : null;

  const rainbowRef   = useRef<HTMLCanvasElement>(null);
  const scratchRef   = useRef<HTMLCanvasElement>(null);
  const confettiRef  = useRef<HTMLCanvasElement>(null);
  const wrapperRef   = useRef<HTMLDivElement>(null);
  const lastPos      = useRef<{ x: number; y: number } | null>(null);
  const isDrawing    = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  const particles    = useRef<Particle[]>([]);

  const [theme,         setTheme]         = useState<ThemeId>("rainbow");
  const [brushSize,     setBrushSize]     = useState(36);
  const [scratchPct,    setScratchPct]    = useState(0);
  const [isRevealed,    setIsRevealed]    = useState(false);
  const [isAutoClearing,setIsAutoClearing]= useState(false);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [saved,         setSaved]         = useState(false);

  // ── Draw rainbow layer ─────────────────────────────────────────────────────
  function drawRainbow(themeId: ThemeId) {
    const canvas = rainbowRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const t = THEMES.find(t => t.id === themeId)!;
    t.draw(ctx);
  }

  // ── Coat with black scratch layer ─────────────────────────────────────────
  function drawBlackCoating() {
    const canvas = scratchRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    // Rich black with slight shimmer texture
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Subtle shimmer dots
    const rng = mulberry32(13);
    for (let i = 0; i < 300; i++) {
      const alpha = rng() * 0.07;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(rng() * CANVAS_W, rng() * CANVAS_H, rng() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Init / reset ───────────────────────────────────────────────────────────
  function init(themeId: ThemeId = theme) {
    drawRainbow(themeId);
    drawBlackCoating();
    setIsRevealed(false);
    setIsAutoClearing(false);
    setScratchPct(0);
    lastPos.current = null;
    isDrawing.current = false;
    if (scratchRef.current) scratchRef.current.style.opacity = "1";
  }

  useEffect(() => { init(); }, []);

  // Fullscreen listener
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ── Coordinate helper ──────────────────────────────────────────────────────
  function getPos(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
    const canvas = scratchRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = CANVAS_W / rect.width;
    const sy = CANVAS_H / rect.height;
    if ("touches" in e) {
      const t = (e as TouchEvent).touches[0] || (e as TouchEvent).changedTouches[0];
      if (!t) return null;
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }
    const m = e as MouseEvent;
    return { x: (m.clientX - rect.left) * sx, y: (m.clientY - rect.top) * sy };
  }

  // ── Scratch a point ────────────────────────────────────────────────────────
  function scratchAt(x: number, y: number) {
    const ctx = scratchRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    const radial = ctx.createRadialGradient(x, y, 0, x, y, brushSize);
    radial.addColorStop(0,   "rgba(0,0,0,1)");
    radial.addColorStop(0.6, "rgba(0,0,0,0.95)");
    radial.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // Interpolate between two points so fast swipes leave no gaps
  function scratchLine(from: { x: number; y: number }, to: { x: number; y: number }) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.floor(dist / (brushSize * 0.4)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      scratchAt(from.x + dx * t, from.y + dy * t);
    }
  }

  // ── Check scratch percentage (sampled for performance) ────────────────────
  function checkScratchPct() {
    const ctx = scratchRef.current?.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H).data;
    let transparent = 0;
    const sample = 4; // check every 4th pixel
    const total = (CANVAS_W * CANVAS_H) / sample;
    for (let i = 3; i < data.length; i += 4 * sample) {
      if (data[i] < 128) transparent++;
    }
    const pct = Math.round((transparent / total) * 100);
    setScratchPct(Math.min(pct, 100));
    if (pct >= SCRATCH_THRESHOLD && !isRevealed && !isAutoClearing) {
      autoClear();
    }
  }

  // ── Auto-clear animation ───────────────────────────────────────────────────
  async function autoClear() {
    setIsAutoClearing(true);
    navigator.vibrate?.([80, 40, 160, 40, 300]);
    const canvas = scratchRef.current;
    if (!canvas) return;
    canvas.style.transition = "opacity 0.9s ease-out";
    canvas.style.opacity = "0";
    await new Promise(r => setTimeout(r, 900));
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    canvas.style.transition = "";
    canvas.style.opacity = "1";
    setIsRevealed(true);
    setIsAutoClearing(false);
    setScratchPct(100);
    launchConfetti();
  }

  // ── Confetti particle system ───────────────────────────────────────────────
  function launchConfetti() {
    const colors = ["#FF0040","#FF6600","#FFD700","#00DD44","#00AAFF","#AA44FF","#FF44AA","#FF88FF"];
    particles.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * CANVAS_W,
      y: -20,
      vx: (Math.random() - 0.5) * 6,
      vy: 2 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 8,
      life: 1,
      maxLife: 1,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
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
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.15; // gravity
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      p.life -= 0.008;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (particles.current.length > 0) {
      animFrameRef.current = requestAnimationFrame(animateConfetti);
    } else {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  // ── Pointer events ─────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isRevealed || isAutoClearing) return;
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent);
    if (!pos) return;
    scratchAt(pos.x, pos.y);
    lastPos.current = pos;
    navigator.vibrate?.(10);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing, brushSize]);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || isRevealed || isAutoClearing) return;
    e.preventDefault();
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent);
    if (!pos) return;
    if (lastPos.current) scratchLine(lastPos.current, pos);
    lastPos.current = pos;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing, brushSize]);

  const onPointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPos.current = null;
    checkScratchPct();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing]);

  // ── Theme change ───────────────────────────────────────────────────────────
  function changeTheme(t: ThemeId) {
    setTheme(t);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    particles.current = [];
    const cc = confettiRef.current?.getContext("2d");
    cc?.clearRect(0, 0, CANVAS_W, CANVAS_H);
    init(t);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function reset() {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    particles.current = [];
    const cc = confettiRef.current?.getContext("2d");
    cc?.clearRect(0, 0, CANVAS_W, CANVAS_H);
    init(theme);
  }

  // ── Save PNG ──────────────────────────────────────────────────────────────
  function savePNG() {
    const out = document.createElement("canvas");
    out.width = CANVAS_W; out.height = CANVAS_H;
    const ctx = out.getContext("2d")!;
    if (rainbowRef.current) ctx.drawImage(rainbowRef.current, 0, 0);
    if (scratchRef.current) ctx.drawImage(scratchRef.current, 0, 0);
    const a = document.createElement("a");
    a.download = `${product?.title ?? "scratch-art"}.png`;
    a.href = out.toDataURL("image/png");
    a.click();
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }

  // ── Guards ─────────────────────────────────────────────────────────────────
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

  const currentTheme = THEMES.find(t => t.id === theme)!;

  return (
    <>
      {!isFullscreen && <Navbar />}
      <main className="flex flex-col bg-[#1a1a2e]" style={{ height: isFullscreen ? "100vh" : "calc(100vh - 64px)" }}>

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="relative z-20 bg-[#12122a] border-b border-white/10 px-4 py-2.5 flex items-center gap-3 shrink-0">
          {!isFullscreen && (
            <>
              <a href="/downloads" className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors shrink-0">
                <ArrowLeft size={13} /> My Library
              </a>
              <span className="text-white/20 text-xs shrink-0">·</span>
              <p className="text-sm font-medium text-white truncate flex-1">{product.title}</p>
            </>
          )}
          {isFullscreen && <p className="text-sm font-medium text-white truncate flex-1">{product.title}</p>}

          {/* Scratch progress */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-pink-500 transition-all duration-300"
                style={{ width: `${scratchPct}%` }} />
            </div>
            <span className="text-xs text-white/50 tabular-nums w-8">{scratchPct}%</span>
          </div>

          <span className={`text-[11px] shrink-0 text-green-400 transition-opacity duration-300 ${saved ? "opacity-100" : "opacity-0"}`}>Saved</span>

          <button onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors shrink-0">
            <RotateCcw size={12} /> Reset
          </button>
          <button onClick={savePNG}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#1a1a2e] text-xs font-semibold hover:bg-white/90 transition-colors shrink-0">
            <Download size={12} /> Save PNG
          </button>
          <button onClick={toggleFullscreen}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-white transition-colors shrink-0">
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* Sidebar — desktop */}
          <aside className="hidden md:flex flex-col gap-6 w-52 bg-[#12122a] border-r border-white/10 p-4 shrink-0 overflow-y-auto">

            {/* Themes */}
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Theme</p>
              <div className="flex flex-col gap-1.5">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => changeTheme(t.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      theme === t.id ? "bg-white text-[#1a1a2e]" : "text-white/70 hover:bg-white/10"
                    }`}>
                    <span>{t.emoji}</span> {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Brush size */}
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Brush — {brushSize}px</p>
              <div className="flex gap-2 mb-3">
                {BRUSH_PRESETS.map(b => (
                  <button key={b.label} onClick={() => setBrushSize(b.size)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      brushSize === b.size ? "bg-white text-[#1a1a2e]" : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}>
                    {b.label}
                  </button>
                ))}
              </div>
              <input type="range" min={8} max={80} value={brushSize}
                onChange={e => setBrushSize(Number(e.target.value))}
                className="w-full cursor-pointer" style={{ accentColor: "#FFD700" }} />
            </div>

            {/* Progress */}
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Revealed</p>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-1">
                <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${scratchPct}%` }} />
              </div>
              <p className="text-xs text-white/40 text-right">{scratchPct}%</p>
            </div>

            {/* Tip */}
            <div className="mt-auto p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[11px] text-white/50 leading-relaxed">
                {isRevealed
                  ? `🎉 Fully revealed! Hit Reset to play again.`
                  : `Scratch ${SCRATCH_THRESHOLD - scratchPct > 0 ? SCRATCH_THRESHOLD - scratchPct : 0}% more to auto-reveal!`}
              </p>
            </div>
          </aside>

          {/* ── Canvas area ──────────────────────────────────────────────── */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0 min-w-0" ref={wrapperRef}>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl select-none"
              style={{ width: "100%", maxWidth: 800, aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}>

              {/* Layer 1: Rainbow */}
              <canvas ref={rainbowRef} width={CANVAS_W} height={CANVAS_H}
                className="absolute inset-0 w-full h-full" />

              {/* Layer 2: Black scratch coating */}
              <canvas ref={scratchRef} width={CANVAS_W} height={CANVAS_H}
                className="absolute inset-0 w-full h-full"
                style={{ cursor: isRevealed ? "default" : "none", touchAction: "none" }}
                onMouseDown={onPointerDown} onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}    onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown} onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp} />

              {/* Layer 3: Confetti */}
              <canvas ref={confettiRef} width={CANVAS_W} height={CANVAS_H}
                className="absolute inset-0 w-full h-full pointer-events-none" />

              {/* Celebration overlay */}
              {isRevealed && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center animate-bounce">
                    <p className="text-5xl mb-2">🎉</p>
                    <p className="text-white font-bold text-xl drop-shadow-lg">Amazing!</p>
                  </div>
                </div>
              )}

              {/* Scratch hint on first load */}
              {scratchPct === 0 && !isRevealed && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-4xl mb-2 animate-pulse">✨</p>
                    <p className="text-white/60 text-sm font-medium">Scratch to reveal!</p>
                  </div>
                </div>
              )}

              {/* Custom cursor ring */}
              {!isRevealed && (
                <div className="absolute pointer-events-none"
                  style={{
                    width: brushSize * 2 * (wrapperRef.current ? Math.min(wrapperRef.current.clientWidth - 32, 800) / CANVAS_W : 1),
                    height: brushSize * 2 * (wrapperRef.current ? Math.min(wrapperRef.current.clientWidth - 32, 800) / CANVAS_W : 1),
                    border: "2px solid rgba(255,255,255,0.5)",
                    borderRadius: "50%",
                    transform: "translate(-50%,-50%)",
                    display: "none", // hidden; we use native cursor:none + no overlay needed at this scale
                  }} />
              )}
            </div>
          </div>
        </div>

        {/* ── Mobile bottom toolbar ─────────────────────────────────────── */}
        <div className="md:hidden bg-[#12122a] border-t border-white/10 px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
          {/* Themes */}
          {THEMES.map(t => (
            <button key={t.id} onClick={() => changeTheme(t.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                theme === t.id ? "bg-white text-[#1a1a2e]" : "bg-white/10 text-white"
              }`}>
              {t.emoji} {t.name}
            </button>
          ))}

          <div className="w-px h-6 bg-white/10 shrink-0 mx-1" />

          {/* Brush presets */}
          {BRUSH_PRESETS.map(b => (
            <button key={b.label} onClick={() => setBrushSize(b.size)}
              className={`w-9 h-9 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                brushSize === b.size ? "bg-white text-[#1a1a2e]" : "bg-white/10 text-white"
              }`}>{b.label}
            </button>
          ))}

          <div className="w-px h-6 bg-white/10 shrink-0 mx-1" />

          {/* Progress */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-pink-500 transition-all"
                style={{ width: `${scratchPct}%` }} />
            </div>
            <span className="text-[11px] text-white/40 tabular-nums">{scratchPct}%</span>
          </div>

          <button onClick={reset}
            className="ml-auto w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
            <RotateCcw size={15} />
          </button>
        </div>
      </main>
    </>
  );
}
