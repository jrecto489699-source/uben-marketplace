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

  // ── Layout — single page on mobile, two-page spread on desktop ──────────
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

  // ── Touch swipe ───────────────────────────────────────────────────────────
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  // Latest values for async callbacks
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

  // ── Render a PDF page to a data URL (cached) ─────────────────────────────
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

  // ── Load PDF ──────────────────────────────────────────────────────────────
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

  // ── Pre-render nearby pages ──────────────────────────────────────────────
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

  // ── Save & restore reading position ───────────────────────────────────────
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

  // ── Page navigation ───────────────────────────────────────────────────────
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

  // ── Auto-play ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAutoPlay || showCover || isFlipping || pdfLoading || pdfError) return;
    if (spread >= totalSpreads - 1) { setIsAutoPlay(false); return; }
    const timer = setTimeout(() => goNext(), AUTO_PLAY_DELAY);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoPlay, spread, showCover, isFlipping, pdfLoading, pdfError, totalSpreads]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
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

  // ── Touch swipe ───────────────────────────────────────────────────────────
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

  // ── Fullscreen ────────────────────────────────────────────────────────────
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

  // ── PageSlot ─────────────────────────────────────────────────────────────
  function PageSlot({ pageIndex, side, halfShadow = true }: {
    pageIndex: number | null;
    side: "left" | "right";
    halfShadow?: boolean;
  }) {
    const url = pageIndex !== null ? pageImages[pageIndex] : null;
    const hasContent = pageIndex !== null && pageIndex >= 0 && pageIndex < totalPages;
    return (
      <div className="relative w-full h-full bg-white overflow-hidden">
        {hasContent && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Page ${pageIndex + 1}`}
            className="absolute inset-0 w-full h-full object-contain bg-white" draggable={false} />
        ) : hasContent ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-white" />
        )}
        {hasContent && (
          <div className={`absolute bottom-2 ${side === "left" ? "left-3" : "right-3"} text-[10px] text-ink/40 tabular-nums select-none`}>
            {pageIndex + 1}
          </div>
        )}
        {halfShadow && (
          <div className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              [side === "left" ? "right" : "left"]: 0,
              width: "14%",
              background: side === "left"
                ? "linear-gradient(to right, transparent 50%, rgba(0,0,0,0.13))"
                : "linear-gradient(to left, transparent 50%, rgba(0,0,0,0.13))",
            } as React.CSSProperties} />
        )}
      </div>
    );
  }

  // ── Cover content ────────────────────────────────────────────────────────
  function Cover() {
    return (
      <div className="relative w-full h-full overflow-hidden bg-cream">
        <div className="absolute top-6 left-6 w-24 h-20 opacity-30 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(rgba(34,34,34,0.6) 1px, transparent 1px)", backgroundSize: "9px 9px" }} />
        <div className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] tracking-[0.45em] text-ink/65 select-none"
          style={{ writingMode: "vertical-rl", transform: "translateY(-50%) rotate(180deg)" }}>
          A&nbsp;&nbsp;STORYBOOK
        </div>
        <div className="absolute top-[7%] left-[20%] right-[6%] bottom-[24%] rounded-sm overflow-hidden shadow-sm bg-card-hover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product!.image} alt={product!.title}
            className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        </div>
        <div className="absolute left-6 bottom-[30%] w-20 h-32 opacity-40 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(rgba(34,34,34,0.7) 1px, transparent 1px)", backgroundSize: "8px 8px" }} />
        <div className="absolute bottom-[7%] left-[8%] right-[8%]">
          <h1 className="font-serif text-[#1F4842] uppercase font-semibold tracking-wide"
            style={{ fontSize: "clamp(24px, 5.5vw, 48px)", lineHeight: 1, letterSpacing: "0.02em" }}>
            {product!.title}
          </h1>
          <div className="mt-3 border-t border-ink/30 pt-2 flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-muted">{product!.seller}</span>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-muted">Read &amp; Enjoy</span>
          </div>
        </div>
        {/* Binding shadow on the right edge — the side that will lift when opening */}
        <div className="absolute top-0 bottom-0 right-0 w-3 pointer-events-none"
          style={{ background: "linear-gradient(to left, rgba(0,0,0,0.18), transparent)" }} />
      </div>
    );
  }

  // ── Compute current and target pages for animation ───────────────────────
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

  // ── Dimensions ───────────────────────────────────────────────────────────
  // The "page unit" is what we use for cover and single-page views.
  // Two-page spreads are twice as wide.
  const pageUnitStyle = { width: "min(86vw, 400px)", aspectRatio: "3/4" };
  const spreadStyle   = isWide
    ? { width: "min(94vw, 820px)", aspectRatio: "3/2" }
    : pageUnitStyle;

  // Container holds whichever layout is currently active.
  const containerStyle = (showCover && !isFlipping) || flipMode === "cover-open"
    ? pageUnitStyle
    : spreadStyle;

  // Spread or single page: the "right" half displays the leaf the user is
  // looking at. The cover always occupies the full page-unit.

  return (
    <>
      <style>{`
        /* ── Page flip keyframes ───────────────────────────────────── */
        @keyframes flipForward {
          0%   { transform: rotateY(0deg);    box-shadow: -2px 0 8px rgba(0,0,0,0); }
          50%  {                              box-shadow: -8px 0 24px rgba(0,0,0,0.18); }
          100% { transform: rotateY(-180deg); box-shadow: -2px 0 8px rgba(0,0,0,0); }
        }
        @keyframes flipBackward {
          0%   { transform: rotateY(0deg);    box-shadow: 2px 0 8px rgba(0,0,0,0); }
          50%  {                              box-shadow: 8px 0 24px rgba(0,0,0,0.18); }
          100% { transform: rotateY(180deg);  box-shadow: 2px 0 8px rgba(0,0,0,0); }
        }
        @keyframes coverOpen {
          0%   { transform: rotateY(0deg);    box-shadow: -2px 0 12px rgba(0,0,0,0); }
          40%  {                              box-shadow: -12px 0 32px rgba(0,0,0,0.22); }
          100% { transform: rotateY(-160deg); box-shadow: -2px 0 12px rgba(0,0,0,0); }
        }
        @keyframes coverClose {
          0%   { transform: rotateY(-160deg); box-shadow: -2px 0 12px rgba(0,0,0,0); }
          60%  {                              box-shadow: -12px 0 32px rgba(0,0,0,0.22); }
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
            <button
              onClick={() => setIsAutoPlay(v => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                isAutoPlay ? "bg-ink text-cream hover:bg-[#3a3a3a]" : "bg-[#EDEBE6] text-ink hover:bg-card-hover"
              }`}
              title={isAutoPlay ? "Stop auto-flip" : "Auto-flip pages"}
            >
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
            background: "radial-gradient(ellipse at center, #EDEBE6 0%, #DCD8CF 100%)",
          }}
        >
          {/* Loading */}
          {pdfLoading && (
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-ink-muted">Opening storybook…</p>
            </div>
          )}

          {/* Error */}
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

          {/* Book container */}
          {!pdfLoading && !pdfError && (
            <div
              className="relative select-none"
              style={{
                ...containerStyle,
                boxShadow: "0 30px 80px -20px rgba(0,0,0,0.45), 0 10px 20px -10px rgba(0,0,0,0.2)",
                borderRadius: 6,
                background: "#ffffff",
                transformStyle: "preserve-3d",
                transition: "width 0.45s ease-in-out, aspect-ratio 0.45s ease-in-out",
              }}
            >
              {/* ─── COVER (closed) — single page centered ─── */}
              {showCover && !isFlipping && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]">
                  <Cover />
                </div>
              )}

              {/* ─── COVER OPENING — cover flips left, spread fades in behind ─── */}
              {flipMode === "cover-open" && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]" style={{ transformStyle: "preserve-3d" }}>
                  {/* Underneath: the first spread, fades in */}
                  <div
                    className="absolute inset-0"
                    style={{
                      animation: `fadeIn ${FLIP_DURATION}ms ease-in-out forwards`,
                    }}
                  >
                    {isWide ? (
                      <div className="flex h-full">
                        <div className="w-1/2 h-full bg-white"><PageSlot pageIndex={targetPages.left} side="left" /></div>
                        <div className="w-1/2 h-full bg-white"><PageSlot pageIndex={targetPages.right} side="right" /></div>
                      </div>
                    ) : (
                      <div className="h-full bg-white"><PageSlot pageIndex={targetPages.right} side="right" /></div>
                    )}
                  </div>

                  {/* Top: cover flipping around its LEFT edge */}
                  <div
                    className="absolute inset-0"
                    style={{
                      transformOrigin: "left center",
                      transformStyle: "preserve-3d",
                      animation: `coverOpen ${FLIP_DURATION}ms ease-in-out forwards`,
                      willChange: "transform",
                    }}
                  >
                    <div className="flip-face"><Cover /></div>
                    <div className="flip-face back bg-white">
                      {/* The interior of the front cover — keep it blank/cream */}
                      <div className="w-full h-full bg-cream" />
                    </div>
                  </div>
                </div>
              )}

              {/* ─── COVER CLOSING — first spread closes back into cover ─── */}
              {flipMode === "cover-close" && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]" style={{ transformStyle: "preserve-3d" }}>
                  {/* Underneath: the cover, fades in */}
                  <div
                    className="absolute inset-0"
                    style={{ animation: `fadeIn ${FLIP_DURATION}ms ease-in-out forwards` }}
                  >
                    <Cover />
                  </div>
                  {/* Top: cover element closing (reverse of open) */}
                  <div
                    className="absolute inset-0"
                    style={{
                      transformOrigin: "left center",
                      transformStyle: "preserve-3d",
                      animation: `coverClose ${FLIP_DURATION}ms ease-in-out forwards`,
                      willChange: "transform",
                    }}
                  >
                    <div className="flip-face bg-cream" />
                    <div className="flip-face back"><Cover /></div>
                  </div>
                </div>
              )}

              {/* ─── INSIDE — spread visible (no flip in progress) ─── */}
              {!showCover && !isFlipping && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]">
                  {isWide ? (
                    <>
                      <div className="flex h-full">
                        <div className="w-1/2 h-full bg-white"><PageSlot pageIndex={currentPages.left}  side="left"  /></div>
                        <div className="w-1/2 h-full bg-white"><PageSlot pageIndex={currentPages.right} side="right" /></div>
                      </div>
                      {/* Center binding shadow */}
                      <div className="absolute top-0 bottom-0 pointer-events-none"
                        style={{ left: "50%", width: 18, transform: "translateX(-50%)",
                          background: "linear-gradient(to right, transparent, rgba(0,0,0,0.18) 50%, transparent)", zIndex: 3 }} />
                    </>
                  ) : (
                    <div className="h-full bg-white"><PageSlot pageIndex={currentPages.right} side="right" /></div>
                  )}
                </div>
              )}

              {/* ─── INSIDE — flipping a page ─── */}
              {flipMode === "page" && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]" style={{ transformStyle: "preserve-3d" }}>
                  {/* Underneath: target spread (visible after flip) */}
                  <div className="absolute inset-0">
                    {isWide ? (
                      <div className="flex h-full">
                        <div className="w-1/2 h-full bg-white"><PageSlot pageIndex={targetPages.left}  side="left"  /></div>
                        <div className="w-1/2 h-full bg-white"><PageSlot pageIndex={targetPages.right} side="right" /></div>
                      </div>
                    ) : (
                      <div className="h-full bg-white"><PageSlot pageIndex={flipDir === "next" ? targetPages.right : targetPages.right} side="right" /></div>
                    )}
                  </div>

                  {/* Top: current spread with the flipping page on one side */}
                  {flipDir === "next" ? (
                    <>
                      {/* Left page stays during forward flip (desktop only) */}
                      {isWide && (
                        <div className="absolute top-0 left-0 bottom-0 w-1/2 h-full bg-white">
                          <PageSlot pageIndex={currentPages.left} side="left" />
                        </div>
                      )}
                      {/* Right page flips around its LEFT edge */}
                      <div className={`absolute top-0 ${isWide ? "right-0 w-1/2" : "inset-x-0 w-full"} bottom-0 h-full`}>
                        <div className="absolute inset-0"
                          style={{
                            transformOrigin: "left center",
                            transformStyle: "preserve-3d",
                            animation: `flipForward ${FLIP_DURATION}ms ease-in-out forwards`,
                            willChange: "transform",
                          }}>
                          <div className="flip-face bg-white">
                            <PageSlot pageIndex={currentPages.right} side="right" />
                          </div>
                          <div className="flip-face back bg-white">
                            <PageSlot pageIndex={isWide ? targetPages.left : targetPages.right} side="left" />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Right page stays during backward flip (desktop only) */}
                      {isWide && (
                        <div className="absolute top-0 right-0 bottom-0 w-1/2 h-full bg-white">
                          <PageSlot pageIndex={currentPages.right} side="right" />
                        </div>
                      )}
                      {/* Left page flips around its RIGHT edge */}
                      <div className={`absolute top-0 ${isWide ? "left-0 w-1/2" : "inset-x-0 w-full"} bottom-0 h-full`}>
                        <div className="absolute inset-0"
                          style={{
                            transformOrigin: "right center",
                            transformStyle: "preserve-3d",
                            animation: `flipBackward ${FLIP_DURATION}ms ease-in-out forwards`,
                            willChange: "transform",
                          }}>
                          <div className="flip-face bg-white">
                            <PageSlot pageIndex={isWide ? currentPages.left : currentPages.right} side="left" />
                          </div>
                          <div className="flip-face back bg-white">
                            <PageSlot pageIndex={isWide ? targetPages.right : targetPages.right} side="right" />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Arrow buttons ─────────────────────────────────────────── */}
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

          {/* Swipe hint chevrons (mobile only) */}
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

        {/* ── Mobile bottom strip ───────────────────────────────────────── */}
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
