"use client";

import { use, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Maximize, Minimize,
  Play, Pause, BookOpen,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { allProducts } from "@/data/products";

// ── PDF.js (lazy) ──────────────────────────────────────────────────────────────
let _pdfjsLib: typeof import("pdfjs-dist") | null = null;
async function getPdfJs() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import("pdfjs-dist");
    _pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return _pdfjsLib;
}

const PAGE_RENDER_SCALE = 1.5;
const FLIP_DURATION    = 900;
const AUTO_PLAY_DELAY  = 5000;
const SWIPE_THRESHOLD  = 45;

// ── Palette ───────────────────────────────────────────────────────────────────
const NAVY_DEEP  = "#0f1735";
const NAVY_MID   = "#1e2a55";
const NAVY_SOFT  = "#2a3970";
const GOLD       = "#c8a44a";
const GOLD_SOFT  = "#d8b85e";
const GOLD_DEEP  = "#8a6a26";

// ── Decorative SVG layer (navy book panel with gold ornaments) ───────────────
// Renders the dark navy panel with stars, moon, castle, gold border, and the
// gold arch that surrounds the page content. The arched area itself is
// transparent so the PDF/title underneath shows through.
function BookPanel({ side = "single", randSeed = 1 }: {
  side?: "single" | "left" | "right";
  randSeed?: number;
}) {
  // The right page mirrors moon position to the upper-LEFT corner so the
  // castle stays on the right; the left page keeps moon top-right & castle
  // bottom-left. The "single" cover keeps moon top-right & castle bottom-left.
  const moonRight = side !== "right"; // moon on the right of the panel

  // Deterministic random star positions
  const rng = mulberry32(randSeed);
  const stars = Array.from({ length: 28 }, (_, i) => ({
    cx: 30 + rng() * 540,
    cy: 30 + rng() * 350,
    r:  i % 5 === 0 ? 2.4 : (i % 3 === 0 ? 1.6 : 1.1),
  }));

  return (
    <svg
      viewBox="0 0 600 800"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ background: `linear-gradient(180deg, ${NAVY_MID} 0%, ${NAVY_DEEP} 100%)` }}
    >
      <defs>
        <linearGradient id={`navy-bg-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={NAVY_MID} />
          <stop offset="100%" stopColor={NAVY_DEEP} />
        </linearGradient>
        <radialGradient id={`mountain-fog-${side}`} cx="50%" cy="100%" r="80%">
          <stop offset="0%"  stopColor="#e8d8a8" stopOpacity="0.35" />
          <stop offset="40%" stopColor={NAVY_SOFT} stopOpacity="0.3" />
          <stop offset="100%" stopColor={NAVY_DEEP} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width="600" height="800" fill={`url(#navy-bg-${side})`} />

      {/* Stars */}
      {stars.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r}
          fill={GOLD_SOFT} opacity={0.55 + rng() * 0.4} />
      ))}

      {/* Crescent moon */}
      <g transform={`translate(${moonRight ? 490 : 110}, 110)`}>
        <circle r="28" fill={GOLD} />
        <circle cx={moonRight ? -12 : 12} cy={-4} r="26" fill={NAVY_MID} />
      </g>

      {/* Distant mountain glow */}
      <rect x="0" y="500" width="600" height="300" fill={`url(#mountain-fog-${side})`} />

      {/* Mountain silhouettes (distant) */}
      <path
        d="M 0,650 L 80,580 L 160,620 L 240,560 L 330,610 L 420,560 L 510,605 L 600,560 L 600,800 L 0,800 Z"
        fill={NAVY_SOFT} opacity="0.55"
      />
      {/* Mountain silhouettes (closer) */}
      <path
        d="M 0,720 L 90,640 L 180,690 L 290,620 L 400,690 L 500,640 L 600,710 L 600,800 L 0,800 Z"
        fill={NAVY_DEEP}
      />

      {/* Pine trees on the right edge */}
      <g fill={NAVY_DEEP} opacity="0.95">
        <path d="M 540 720 L 555 660 L 570 720 Z" />
        <path d="M 520 740 L 533 680 L 546 740 Z" />
        <path d="M 565 745 L 578 695 L 592 745 Z" />
      </g>

      {/* Castle silhouette (bottom-left for cover & left page; bottom-right for right page) */}
      <g
        fill={NAVY_DEEP}
        transform={side === "right" ? "translate(600, 0) scale(-1, 1)" : ""}
      >
        {/* Hill */}
        <path d="M 40 700 Q 130 640 240 690 L 240 800 L 40 800 Z" />
        {/* Castle body */}
        <g>
          <rect x="100" y="600" width="60" height="100" />
          <rect x="115" y="585" width="30" height="20" />
          {/* Towers */}
          <rect x="85"  y="565" width="20" height="135" />
          <rect x="155" y="555" width="20" height="145" />
          <rect x="125" y="540" width="14" height="160" />
          {/* Spires */}
          <path d="M 85 565 L 95 545 L 105 565 Z" />
          <path d="M 155 555 L 165 530 L 175 555 Z" />
          <path d="M 125 540 L 132 515 L 139 540 Z" />
          {/* Windows (warm glow) */}
          <rect x="119" y="625" width="6" height="10" fill="#f0c66a" opacity="0.85" />
          <rect x="135" y="625" width="6" height="10" fill="#f0c66a" opacity="0.85" />
          <rect x="92"  y="610" width="6" height="9"  fill="#f0c66a" opacity="0.75" />
          <rect x="160" y="600" width="6" height="9"  fill="#f0c66a" opacity="0.75" />
        </g>
      </g>

      {/* Outer gold border */}
      <rect x="22" y="22" width="556" height="756" fill="none" stroke={GOLD} strokeWidth="2.5" />
      <rect x="30" y="30" width="540" height="740" fill="none" stroke={GOLD} strokeWidth="0.8" opacity="0.7" />

      {/* Border diamond ornaments */}
      {[
        { x: 300, y: 30 }, { x: 300, y: 770 },
        { x: 30,  y: 400 }, { x: 570, y: 400 },
      ].map((p, i) => (
        <g key={i} transform={`translate(${p.x}, ${p.y}) rotate(45)`}>
          <rect x="-5" y="-5" width="10" height="10" fill={GOLD} />
        </g>
      ))}

      {/* Corner flourishes — small ornate curves */}
      {([
        { x: 30,  y: 30,  flip: "" },
        { x: 570, y: 30,  flip: "scale(-1, 1) translate(-1140, 0)" },
        { x: 30,  y: 770, flip: "scale(1, -1) translate(0, -1540)" },
        { x: 570, y: 770, flip: "scale(-1, -1) translate(-1140, -1540)" },
      ]).map((c, i) => (
        <g key={i} transform={c.flip} stroke={GOLD} strokeWidth="1.3" fill="none">
          {/* L-shaped flourish near corner — curves */}
          <path d={`M ${c.x + 10} ${c.y + 50} q 5 -25 30 -28 q -8 -10 0 -22 q 10 -3 18 7`} />
          <path d={`M ${c.x + 14} ${c.y + 40} c 6 -6 14 -7 22 -3`} opacity="0.7" />
          {/* Little dots */}
          <circle cx={c.x + 42} cy={c.y + 22} r="1.6" fill={GOLD} />
          <circle cx={c.x + 22} cy={c.y + 60} r="1.6" fill={GOLD} />
        </g>
      ))}

      {/* The arched window — outlines the content area */}
      <path
        d="M 90 220 L 90 560 Q 90 605 135 605 L 465 605 Q 510 605 510 560 L 510 220 Q 510 90 300 90 Q 90 90 90 220 Z"
        fill="none"
        stroke={GOLD}
        strokeWidth="2"
      />
      <path
        d="M 96 220 L 96 558 Q 96 599 137 599 L 463 599 Q 504 599 504 558 L 504 220 Q 504 96 300 96 Q 96 96 96 220 Z"
        fill="none"
        stroke={GOLD_DEEP}
        strokeWidth="0.6"
        opacity="0.7"
      />

      {/* Small fleurs along the arch top */}
      <g fill={GOLD}>
        <circle cx="300" cy="92" r="4" />
        <path d="M 300 78 L 305 88 L 300 98 L 295 88 Z" />
      </g>

      {/* Inner vine flourishes on either side of the arch */}
      <g stroke={GOLD} strokeWidth="1.1" fill="none" opacity="0.85">
        <path d="M 120 540 q 0 -40 25 -40 q -10 -16 5 -28 q 12 -2 14 12" />
        <path d="M 480 540 q 0 -40 -25 -40 q 10 -16 -5 -28 q -12 -2 -14 12" />
        <circle cx="155" cy="490" r="2" fill={GOLD} />
        <circle cx="445" cy="490" r="2" fill={GOLD} />
      </g>
    </svg>
  );
}

// Deterministic random
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export default function StoryPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  const purchase = purchases.find(p => p.id === purchaseId);
  const product  = purchase ? allProducts.find(p => p.id === purchase.product_id) : null;

  // ── PDF state ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError,   setPdfError]   = useState<string | null>(null);
  const [pageImages, setPageImages] = useState<Record<number, string>>({});

  // ── Layout ────────────────────────────────────────────────────────────────
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const check = () => setIsWide(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const [showCover,  setShowCover]  = useState(true);
  const [spread,     setSpread]     = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDir,    setFlipDir]    = useState<"next" | "prev">("next");
  const [flipMode,   setFlipMode]   = useState<"cover-open" | "cover-close" | "page" | null>(null);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoPlay,   setIsAutoPlay]   = useState(false);

  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const stateRef = useRef({ showCover, spread, isFlipping, totalPages, isWide });
  useEffect(() => {
    stateRef.current = { showCover, spread, isFlipping, totalPages, isWide };
  }, [showCover, spread, isFlipping, totalPages, isWide]);

  const pagesPerSpread = isWide ? 2 : 1;
  const totalSpreads   = Math.ceil(totalPages / pagesPerSpread);

  function pagesForSpread(s: number): { left: number | null; right: number | null } {
    if (isWide) return { left: s * 2, right: s * 2 + 1 };
    return { left: null, right: s };
  }

  useEffect(() => { getPdfJs(); }, []);

  async function renderPage(pageIndex: number) {
    const doc = pdfDocRef.current;
    if (!doc || pageIndex < 0 || pageIndex >= doc.numPages) return;
    if (pageImages[pageIndex]) return;
    try {
      const page = await doc.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: PAGE_RENDER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
      const url = canvas.toDataURL("image/jpeg", 0.85);
      setPageImages(prev => ({ ...prev, [pageIndex]: url }));
    } catch (err) {
      console.warn(`[story] page ${pageIndex + 1} render failed:`, err);
    }
  }

  useEffect(() => {
    if (!purchase?.id) return;
    async function load() {
      setPdfLoading(true); setPdfError(null);
      try {
        const [res, lib] = await Promise.all([
          fetch(`/api/story-pdf/${purchase!.id}`, { credentials: "include", cache: "no-store" }),
          getPdfJs(),
        ]);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setPdfError(body.error ?? "Storybook not available yet");
          setPdfLoading(false);
          return;
        }
        const { url } = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let doc: any;
        try {
          doc = await lib.getDocument({ url, rangeChunkSize: 65536, disableAutoFetch: true }).promise;
        } catch {
          doc = await lib.getDocument({ url, disableRange: true, disableStream: true }).promise;
        }
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        await renderPage(0);
        if (doc.numPages > 1) await renderPage(1);
        setPdfLoading(false);
      } catch (err) {
        console.error("[story] PDF load failed:", err);
        setPdfError(err instanceof Error ? err.message : "Failed to load storybook");
        setPdfLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase?.id]);

  useEffect(() => {
    if (pdfLoading || pdfError || showCover) return;
    const current = pagesForSpread(spread);
    const next    = pagesForSpread(spread + 1);
    const prev    = pagesForSpread(spread - 1);
    [current, next, prev].forEach(({ left, right }) => {
      if (left  !== null && left  >= 0 && left  < totalPages) renderPage(left);
      if (right !== null && right >= 0 && right < totalPages) renderPage(right);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spread, totalPages, showCover, pdfLoading, pdfError, isWide]);

  const localKey = `uben_story_${purchaseId}`;
  useEffect(() => {
    if (pdfLoading || pdfError) return;
    try { localStorage.setItem(localKey, JSON.stringify({ spread: showCover ? -1 : spread })); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCover, spread, pdfLoading, pdfError]);

  useEffect(() => {
    if (pdfLoading || pdfError) return;
    try {
      const raw = localStorage.getItem(localKey);
      if (!raw) return;
      const { spread: savedSpread } = JSON.parse(raw);
      if (typeof savedSpread === "number" && savedSpread >= 0 && savedSpread < totalSpreads) {
        setShowCover(false);
        setSpread(savedSpread);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfLoading]);

  function startFlip(direction: "next" | "prev", mode: "cover-open" | "cover-close" | "page", afterFlip: () => void) {
    setFlipDir(direction);
    setFlipMode(mode);
    setIsFlipping(true);
    if (flipTimer.current) clearTimeout(flipTimer.current);
    flipTimer.current = setTimeout(() => {
      afterFlip();
      setIsFlipping(false);
      setFlipMode(null);
    }, FLIP_DURATION);
  }

  function goNext() {
    const s = stateRef.current;
    if (s.isFlipping) return;
    if (s.showCover) {
      startFlip("next", "cover-open", () => { setShowCover(false); setSpread(0); });
      return;
    }
    if (s.spread >= totalSpreads - 1) return;
    startFlip("next", "page", () => setSpread(s.spread + 1));
  }

  function goPrev() {
    const s = stateRef.current;
    if (s.isFlipping) return;
    if (s.showCover) return;
    if (s.spread === 0) {
      startFlip("prev", "cover-close", () => setShowCover(true));
      return;
    }
    startFlip("prev", "page", () => setSpread(s.spread - 1));
  }

  useEffect(() => {
    if (!isAutoPlay || showCover || isFlipping || pdfLoading || pdfError) return;
    if (spread >= totalSpreads - 1) { setIsAutoPlay(false); return; }
    const timer = setTimeout(() => goNext(), AUTO_PLAY_DELAY);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoPlay, spread, showCover, isFlipping, pdfLoading, pdfError, totalSpreads]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.code === "ArrowRight" || e.code === "Space") { e.preventDefault(); goNext(); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); goPrev(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    if (!start) return;
    touchStartRef.current = null;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    if (dt > 700) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) goNext(); else goPrev();
  }

  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);
  function toggleFullscreen() {
    setIsFullscreen(prev => {
      const next = !prev;
      try {
        if (next && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (!next && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {}
      return next;
    });
  }

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

  // ── Page content placed INSIDE the arched panel area ─────────────────────
  // The arched area in the SVG runs roughly (90,90) → (510,605) in a 600×800
  // viewbox. We position the PDF page over that area using percentages.
  function ArchedContent({ children }: { children: React.ReactNode }) {
    return (
      <div
        className="absolute"
        style={{
          // Match the SVG arch interior
          top:    "11%",
          left:   "15%",
          right:  "15%",
          bottom: "24%",
          // Soft inner shadow to seat the content into the panel
          boxShadow: "inset 0 0 20px rgba(0,0,0,0.4)",
          overflow: "hidden",
          // Clip the content roughly to the arch outline
          borderRadius: "8px",
          // Subtle paper backdrop where content lives
          background: "#f6efe1",
        }}
      >
        {children}
      </div>
    );
  }

  function PageInPanel({ pageIndex, side }: { pageIndex: number | null; side: "left" | "right" | "single" }) {
    const url = pageIndex !== null ? pageImages[pageIndex] : null;
    const hasContent = pageIndex !== null && pageIndex >= 0 && pageIndex < totalPages;
    const seed = side === "left" ? 7 : side === "right" ? 11 : 5;
    return (
      <div className="relative w-full h-full overflow-hidden" style={{ background: NAVY_DEEP }}>
        <BookPanel side={side === "single" ? "single" : side} randSeed={seed} />
        <ArchedContent>
          {hasContent && url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Page ${pageIndex + 1}`}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ background: "#f6efe1" }}
              draggable={false} />
          ) : hasContent ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="absolute inset-0" style={{ background: "#f6efe1" }} />
          )}
        </ArchedContent>
        {hasContent && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] tabular-nums select-none"
            style={{ color: GOLD_SOFT }}>
            {pageIndex + 1}
          </div>
        )}
      </div>
    );
  }

  // ── Cover content (title in the arch) ────────────────────────────────────
  function Cover() {
    return (
      <div className="relative w-full h-full overflow-hidden" style={{ background: NAVY_DEEP }}>
        <BookPanel side="single" randSeed={3} />
        <ArchedContent>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
            style={{ background: "linear-gradient(180deg, #f6efe1 0%, #e9d9b3 100%)" }}>
            <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] mb-3" style={{ color: GOLD_DEEP }}>
              A Storybook
            </div>
            <h1 className="font-serif uppercase font-bold leading-tight px-2 mb-4" style={{
              color: NAVY_DEEP,
              fontSize: "clamp(22px, 4.5vw, 38px)",
              letterSpacing: "0.02em",
            }}>
              {product!.title}
            </h1>
            <div className="w-12 h-px mb-3" style={{ background: GOLD_DEEP }} />
            <div className="text-[10px] sm:text-[11px] uppercase tracking-widest" style={{ color: GOLD_DEEP }}>
              {product!.seller}
            </div>
          </div>
        </ArchedContent>
        {/* Cover lower decoration: title-style */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
          <div className="text-[10px] tracking-[0.45em]" style={{ color: GOLD }}>
            ✦ &nbsp; READ &amp; ENJOY &nbsp; ✦
          </div>
        </div>
      </div>
    );
  }

  const currentPages = showCover
    ? { left: null as number | null, right: null as number | null }
    : pagesForSpread(spread);

  const targetPages = (() => {
    if (!isFlipping) return currentPages;
    if (flipDir === "next") {
      if (showCover) return pagesForSpread(0);
      return pagesForSpread(spread + 1);
    } else {
      if (spread === 0) return { left: null, right: null };
      return pagesForSpread(spread - 1);
    }
  })();

  const pageUnitStyle = { width: "min(86vw, 400px)", aspectRatio: "3/4" };
  const spreadStyle   = isWide
    ? { width: "min(94vw, 820px)", aspectRatio: "3/2" }
    : pageUnitStyle;

  const containerStyle = (showCover && !isFlipping) || flipMode === "cover-open"
    ? pageUnitStyle
    : spreadStyle;

  return (
    <>
      <style>{`
        @keyframes flipForward {
          0%   { transform: rotateY(0deg);    box-shadow: -2px 0 8px rgba(0,0,0,0); }
          50%  {                              box-shadow: -10px 0 28px rgba(0,0,0,0.25); }
          100% { transform: rotateY(-180deg); box-shadow: -2px 0 8px rgba(0,0,0,0); }
        }
        @keyframes flipBackward {
          0%   { transform: rotateY(0deg);    box-shadow: 2px 0 8px rgba(0,0,0,0); }
          50%  {                              box-shadow: 10px 0 28px rgba(0,0,0,0.25); }
          100% { transform: rotateY(180deg);  box-shadow: 2px 0 8px rgba(0,0,0,0); }
        }
        @keyframes coverOpen {
          0%   { transform: rotateY(0deg);    box-shadow: -2px 0 12px rgba(0,0,0,0); }
          40%  {                              box-shadow: -14px 0 36px rgba(0,0,0,0.3); }
          100% { transform: rotateY(-160deg); box-shadow: -2px 0 12px rgba(0,0,0,0); }
        }
        @keyframes coverClose {
          0%   { transform: rotateY(-160deg); box-shadow: -2px 0 12px rgba(0,0,0,0); }
          60%  {                              box-shadow: -14px 0 36px rgba(0,0,0,0.3); }
          100% { transform: rotateY(0deg);    box-shadow: -2px 0 12px rgba(0,0,0,0); }
        }
        @keyframes fadeIn {
          0%   { opacity: 0; }
          50%  { opacity: 0; }
          100% { opacity: 1; }
        }
        .flip-face {
          position: absolute; inset: 0;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          overflow: hidden;
        }
        .flip-face.back { transform: rotateY(180deg); }
        @keyframes hintPulseLeft  { 0%,100% { transform: translateY(-50%) translateX(0); opacity: 0.6; } 50% { transform: translateY(-50%) translateX(-5px); opacity: 1; } }
        @keyframes hintPulseRight { 0%,100% { transform: translateY(-50%) translateX(0); opacity: 0.6; } 50% { transform: translateY(-50%) translateX(5px);  opacity: 1; } }
      `}</style>

      {!isFullscreen && <Navbar />}
      <main
        className="bg-cream flex flex-col"
        style={{
          height: isFullscreen ? "100dvh" : "calc(100dvh - 64px)",
          ...(isFullscreen ? { position: "fixed", inset: 0, zIndex: 50 } : {}),
        }}
      >
        {/* ── Top bar ───────────────────────────────────────────────────── */}
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

          {totalPages > 0 && !showCover && (
            <div className="hidden md:flex items-center gap-1.5 shrink-0">
              <BookOpen size={13} className="text-ink-muted" />
              <span className="text-xs text-ink-muted tabular-nums">
                {isWide
                  ? `Pages ${currentPages.left !== null && currentPages.left < totalPages ? currentPages.left + 1 : "—"}–${currentPages.right !== null && currentPages.right < totalPages ? currentPages.right + 1 : "—"}`
                  : `Page ${(currentPages.right ?? 0) + 1}`}
                <span className="text-ink-muted/70"> of {totalPages}</span>
              </span>
            </div>
          )}

          {!showCover && !pdfError && (
            <button onClick={() => setIsAutoPlay(v => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                isAutoPlay ? "bg-ink text-cream hover:bg-[#3a3a3a]" : "bg-[#EDEBE6] text-ink hover:bg-card-hover"
              }`}
              title={isAutoPlay ? "Stop auto-flip" : "Auto-flip pages"}>
              {isAutoPlay ? <Pause size={12} /> : <Play size={12} />}
              {isAutoPlay ? "Stop" : "Auto"}
            </button>
          )}

          <button onClick={toggleFullscreen}
            className="w-8 h-8 rounded-full bg-[#EDEBE6] flex items-center justify-center hover:bg-card-hover transition-colors shrink-0"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>

        {/* ── Book stage ─────────────────────────────────────────────────── */}
        <div
          className="flex-1 relative overflow-hidden min-h-0 flex items-center justify-center px-3 py-5"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            perspective: "2600px",
            background: "radial-gradient(ellipse at center, #EDEBE6 0%, #C8C2B5 100%)",
          }}
        >
          {pdfLoading && (
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-ink-muted">Opening storybook…</p>
            </div>
          )}

          {!pdfLoading && pdfError && (
            <div className="text-center max-w-sm px-6">
              <BookOpen size={40} strokeWidth={1.2} className="text-ink-muted mx-auto mb-4" />
              <p className="font-serif text-xl text-ink mb-2">Storybook coming soon</p>
              <p className="text-sm text-ink-muted mb-4">{pdfError}</p>
              <button onClick={() => window.location.reload()}
                className="px-5 py-2 rounded-full bg-ink text-cream text-xs font-medium hover:bg-[#3a3a3a] transition-colors">
                Retry
              </button>
            </div>
          )}

          {!pdfLoading && !pdfError && (
            <div
              className="relative select-none"
              style={{
                ...containerStyle,
                boxShadow: "0 30px 80px -20px rgba(0,0,0,0.5), 0 12px 24px -10px rgba(0,0,0,0.25)",
                borderRadius: 6,
                background: NAVY_DEEP,
                transformStyle: "preserve-3d",
                transition: "width 0.45s ease-in-out, aspect-ratio 0.45s ease-in-out",
              }}
            >
              {/* COVER closed */}
              {showCover && !isFlipping && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]"><Cover /></div>
              )}

              {/* COVER OPENING */}
              {flipMode === "cover-open" && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]" style={{ transformStyle: "preserve-3d" }}>
                  <div className="absolute inset-0" style={{ animation: `fadeIn ${FLIP_DURATION}ms ease-in-out forwards` }}>
                    {isWide ? (
                      <div className="flex h-full">
                        <div className="w-1/2 h-full"><PageInPanel pageIndex={targetPages.left}  side="left"  /></div>
                        <div className="w-1/2 h-full"><PageInPanel pageIndex={targetPages.right} side="right" /></div>
                      </div>
                    ) : (
                      <PageInPanel pageIndex={targetPages.right} side="single" />
                    )}
                  </div>
                  <div className="absolute inset-0"
                    style={{
                      transformOrigin: "left center",
                      transformStyle: "preserve-3d",
                      animation: `coverOpen ${FLIP_DURATION}ms ease-in-out forwards`,
                      willChange: "transform",
                    }}>
                    <div className="flip-face"><Cover /></div>
                    <div className="flip-face back" style={{ background: NAVY_DEEP }}>
                      <div className="w-full h-full" style={{ background: NAVY_DEEP }} />
                    </div>
                  </div>
                </div>
              )}

              {/* COVER CLOSING */}
              {flipMode === "cover-close" && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]" style={{ transformStyle: "preserve-3d" }}>
                  <div className="absolute inset-0" style={{ animation: `fadeIn ${FLIP_DURATION}ms ease-in-out forwards` }}>
                    <Cover />
                  </div>
                  <div className="absolute inset-0"
                    style={{
                      transformOrigin: "left center",
                      transformStyle: "preserve-3d",
                      animation: `coverClose ${FLIP_DURATION}ms ease-in-out forwards`,
                      willChange: "transform",
                    }}>
                    <div className="flip-face" style={{ background: NAVY_DEEP }} />
                    <div className="flip-face back"><Cover /></div>
                  </div>
                </div>
              )}

              {/* INSIDE — static */}
              {!showCover && !isFlipping && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]">
                  {isWide ? (
                    <>
                      <div className="flex h-full">
                        <div className="w-1/2 h-full"><PageInPanel pageIndex={currentPages.left}  side="left"  /></div>
                        <div className="w-1/2 h-full"><PageInPanel pageIndex={currentPages.right} side="right" /></div>
                      </div>
                      {/* Center spine — gold double line on navy */}
                      <div className="absolute top-0 bottom-0 pointer-events-none"
                        style={{
                          left: "50%", width: 16, transform: "translateX(-50%)",
                          background: `linear-gradient(to right, ${NAVY_MID} 0%, ${NAVY_DEEP} 50%, ${NAVY_MID} 100%)`,
                          boxShadow: `inset 1px 0 0 ${GOLD}, inset -1px 0 0 ${GOLD}`,
                          zIndex: 3,
                        }} />
                    </>
                  ) : (
                    <PageInPanel pageIndex={currentPages.right} side="single" />
                  )}
                </div>
              )}

              {/* INSIDE — flipping page */}
              {flipMode === "page" && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]" style={{ transformStyle: "preserve-3d" }}>
                  {/* Underneath: target spread */}
                  <div className="absolute inset-0">
                    {isWide ? (
                      <div className="flex h-full">
                        <div className="w-1/2 h-full"><PageInPanel pageIndex={targetPages.left}  side="left"  /></div>
                        <div className="w-1/2 h-full"><PageInPanel pageIndex={targetPages.right} side="right" /></div>
                      </div>
                    ) : (
                      <PageInPanel pageIndex={targetPages.right} side="single" />
                    )}
                  </div>

                  {flipDir === "next" ? (
                    <>
                      {isWide && (
                        <div className="absolute top-0 left-0 bottom-0 w-1/2 h-full">
                          <PageInPanel pageIndex={currentPages.left} side="left" />
                        </div>
                      )}
                      <div className={`absolute top-0 ${isWide ? "right-0 w-1/2" : "inset-x-0 w-full"} bottom-0 h-full`}>
                        <div className="absolute inset-0"
                          style={{
                            transformOrigin: "left center",
                            transformStyle: "preserve-3d",
                            animation: `flipForward ${FLIP_DURATION}ms ease-in-out forwards`,
                            willChange: "transform",
                          }}>
                          <div className="flip-face">
                            <PageInPanel pageIndex={currentPages.right} side={isWide ? "right" : "single"} />
                          </div>
                          <div className="flip-face back">
                            <PageInPanel pageIndex={isWide ? targetPages.left : targetPages.right} side="left" />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {isWide && (
                        <div className="absolute top-0 right-0 bottom-0 w-1/2 h-full">
                          <PageInPanel pageIndex={currentPages.right} side="right" />
                        </div>
                      )}
                      <div className={`absolute top-0 ${isWide ? "left-0 w-1/2" : "inset-x-0 w-full"} bottom-0 h-full`}>
                        <div className="absolute inset-0"
                          style={{
                            transformOrigin: "right center",
                            transformStyle: "preserve-3d",
                            animation: `flipBackward ${FLIP_DURATION}ms ease-in-out forwards`,
                            willChange: "transform",
                          }}>
                          <div className="flip-face">
                            <PageInPanel pageIndex={isWide ? currentPages.left : currentPages.right} side={isWide ? "left" : "single"} />
                          </div>
                          <div className="flip-face back">
                            <PageInPanel pageIndex={isWide ? targetPages.right : targetPages.right} side="right" />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {!pdfLoading && !pdfError && (
            <>
              <button onClick={goPrev} disabled={showCover}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-ink/85 hover:bg-ink text-cream flex items-center justify-center shadow-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                aria-label="Previous page">
                <ChevronLeft size={22} />
              </button>
              <button onClick={goNext} disabled={!showCover && spread >= totalSpreads - 1}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-ink/85 hover:bg-ink text-cream flex items-center justify-center shadow-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                aria-label="Next page">
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {!pdfLoading && !pdfError && !showCover && (
            <>
              <div className="sm:hidden absolute left-3 top-1/2 pointer-events-none text-ink/35"
                style={{ animation: "hintPulseLeft 1.6s ease-in-out infinite" }} aria-hidden>
                <ChevronLeft size={16} />
              </div>
              {spread < totalSpreads - 1 && (
                <div className="sm:hidden absolute right-3 top-1/2 pointer-events-none text-ink/35"
                  style={{ animation: "hintPulseRight 1.6s ease-in-out infinite" }} aria-hidden>
                  <ChevronRight size={16} />
                </div>
              )}
            </>
          )}
        </div>

        {totalPages > 0 && (
          <div className="md:hidden bg-cream border-t border-border-muted px-4 py-2 flex items-center justify-center gap-3 shrink-0">
            <BookOpen size={13} className="text-ink-muted" />
            <span className="text-xs text-ink-muted tabular-nums">
              {showCover ? "Cover" : `Page ${(currentPages.right ?? 0) + 1} of ${totalPages}`}
            </span>
          </div>
        )}
      </main>
    </>
  );
}
