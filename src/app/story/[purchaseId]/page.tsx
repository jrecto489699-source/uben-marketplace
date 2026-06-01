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
const FLIP_DURATION    = 850;   // ms — slightly longer for nice feel
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
  // We navigate by "spread": cover is spread 0; subsequent spreads show
  // a pair of pages on wide screens and a single page on narrow ones.
  const [showCover, setShowCover] = useState(true);
  const [spread,    setSpread]    = useState(0); // 0 = first inside spread
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDir,    setFlipDir]    = useState<"next" | "prev">("next");
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoPlay,   setIsAutoPlay]   = useState(false);

  // ── Touch swipe ───────────────────────────────────────────────────────────
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  // Latest state for async callbacks
  const stateRef = useRef({ showCover, spread, isFlipping, totalPages, isWide });
  useEffect(() => {
    stateRef.current = { showCover, spread, isFlipping, totalPages, isWide };
  }, [showCover, spread, isFlipping, totalPages, isWide]);

  // Total number of spreads (inside the book, excluding cover)
  const pagesPerSpread = isWide ? 2 : 1;
  const totalSpreads   = Math.ceil(totalPages / pagesPerSpread);

  // Get the page indices for a given spread
  function pagesForSpread(s: number): { left: number | null; right: number | null } {
    if (isWide) {
      return { left: s * 2, right: s * 2 + 1 };
    }
    // mobile — only "right" slot is used
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
          doc = await lib.getDocument({
            url, rangeChunkSize: 65536, disableAutoFetch: true,
          }).promise;
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

  // ── Pre-render the current + next spread's pages ────────────────────────
  useEffect(() => {
    if (pdfLoading || pdfError || showCover) return;
    const current  = pagesForSpread(spread);
    const next     = pagesForSpread(spread + 1);
    const prev     = pagesForSpread(spread - 1);
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
    try {
      localStorage.setItem(localKey, JSON.stringify({
        spread: showCover ? -1 : spread,
      }));
    } catch {}
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
  function startFlip(direction: "next" | "prev", afterFlip: () => void) {
    setFlipDir(direction);
    setIsFlipping(true);
    if (flipTimer.current) clearTimeout(flipTimer.current);
    flipTimer.current = setTimeout(() => {
      afterFlip();
      setIsFlipping(false);
    }, FLIP_DURATION);
  }

  function goNext() {
    const s = stateRef.current;
    if (s.isFlipping) return;
    if (s.showCover) {
      // Open the book → first spread
      startFlip("next", () => { setShowCover(false); setSpread(0); });
      return;
    }
    if (s.spread >= totalSpreads - 1) return;
    startFlip("next", () => setSpread(s.spread + 1));
  }

  function goPrev() {
    const s = stateRef.current;
    if (s.isFlipping) return;
    if (s.showCover) return;
    if (s.spread === 0) {
      // Close back to cover
      startFlip("prev", () => setShowCover(true));
      return;
    }
    startFlip("prev", () => setSpread(s.spread - 1));
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

  // ── Page slot rendering ──────────────────────────────────────────────────
  // A "page slot" displays a PDF page image, with subtle book-page styling.
  function PageSlot({ pageIndex, side, halfShadow = true }: {
    pageIndex: number | null;
    side: "left" | "right";
    halfShadow?: boolean;
  }) {
    const url = pageIndex !== null ? pageImages[pageIndex] : null;
    const hasContent = pageIndex !== null && pageIndex >= 0 && pageIndex < totalPages;
    return (
      <div className="relative w-full h-full bg-white overflow-hidden">
        {/* PDF image or loading state */}
        {hasContent && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`Page ${pageIndex + 1}`}
            className="absolute inset-0 w-full h-full object-contain bg-white"
            draggable={false}
          />
        ) : hasContent ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          // Empty page (when total pages is odd)
          <div className="absolute inset-0 bg-white" />
        )}
        {/* Tiny page number footer */}
        {hasContent && (
          <div className={`absolute bottom-2 ${side === "left" ? "left-3" : "right-3"} text-[10px] text-ink/40 tabular-nums select-none`}>
            {pageIndex + 1}
          </div>
        )}
        {/* Inner binding shadow */}
        {halfShadow && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              [side === "left" ? "right" : "left"]: 0,
              width: "14%",
              background:
                side === "left"
                  ? "linear-gradient(to right, transparent 50%, rgba(0,0,0,0.13))"
                  : "linear-gradient(to left, transparent 50%, rgba(0,0,0,0.13))",
            } as React.CSSProperties}
          />
        )}
      </div>
    );
  }

  // ── Cover page (kid-storybook style) ─────────────────────────────────────
  function Cover() {
    return (
      <div className="relative w-full h-full overflow-hidden bg-cream">
        {/* Decorative dot pattern, top-left */}
        <div
          className="absolute top-6 left-6 w-24 h-20 opacity-30 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(rgba(34,34,34,0.6) 1px, transparent 1px)",
            backgroundSize: "9px 9px",
          }}
        />
        {/* Vertical label */}
        <div className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] tracking-[0.45em] text-ink/65 select-none"
          style={{ writingMode: "vertical-rl", transform: "translateY(-50%) rotate(180deg)" }}>
          A&nbsp;&nbsp;STORYBOOK
        </div>

        {/* Hero image */}
        <div className="absolute top-[7%] left-[20%] right-[6%] bottom-[24%] rounded-sm overflow-hidden shadow-sm bg-card-hover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product!.image}
            alt={product!.title}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        </div>

        {/* Decorative dot pattern, mid-left */}
        <div
          className="absolute left-6 bottom-[30%] w-20 h-32 opacity-40 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(rgba(34,34,34,0.7) 1px, transparent 1px)",
            backgroundSize: "8px 8px",
          }}
        />

        {/* Title at bottom */}
        <div className="absolute bottom-[7%] left-[8%] right-[8%]">
          <h1 className="font-serif text-[#1F4842] uppercase font-semibold tracking-wide"
            style={{ fontSize: "clamp(28px, 7vw, 56px)", lineHeight: 1, letterSpacing: "0.02em" }}>
            {product!.title}
          </h1>
          <div className="mt-3 border-t border-ink/30 pt-2 flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-muted">{product!.seller}</span>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-muted">Read &amp; Enjoy</span>
          </div>
        </div>

        {/* Faint reflection sliver suggesting another page */}
        <div className="absolute top-0 bottom-0 right-0 w-1.5 bg-black/8 pointer-events-none" />
      </div>
    );
  }

  // ── Compute current and target spread page indices for animation ────────
  const currentPages = showCover
    ? { left: null as number | null, right: null as number | null }
    : pagesForSpread(spread);

  const targetPages = (() => {
    if (!isFlipping) return currentPages;
    if (flipDir === "next") {
      if (showCover) return pagesForSpread(0);
      return pagesForSpread(spread + 1);
    } else {
      if (spread === 0) return { left: null, right: null }; // cover
      return pagesForSpread(spread - 1);
    }
  })();

  const isClosingToCover = isFlipping && flipDir === "prev" && spread === 0;

  // ── Book wrapper sizing ──────────────────────────────────────────────────
  const bookStyle = isWide
    ? { width: "min(94vw, 900px)", aspectRatio: "3/2" }   // two-page spread
    : { width: "min(90vw, 460px)", aspectRatio: "3/4" };  // single page

  return (
    <>
      <style>{`
        /* ── Two-page spread book flip ──────────────────────────────── */
        .flip-page {
          transform-origin: left center;
          transform-style: preserve-3d;
          will-change: transform;
        }
        .flip-page.is-flipping-next  { transform: rotateY(-180deg); }
        .flip-page.is-flipping-prev  { transform: rotateY(0deg); }
        .flip-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          overflow: hidden;
        }
        .flip-face.back { transform: rotateY(180deg); }

        /* Page-flip for prev: left page rotates around its right edge */
        .flip-page-prev {
          transform-origin: right center;
          transform-style: preserve-3d;
          will-change: transform;
        }
        .flip-page-prev.is-flipping-prev { transform: rotateY(180deg); }

        /* Cover flip — same as right-page flip */
        .cover-flip {
          transform-origin: left center;
          transform-style: preserve-3d;
          will-change: transform;
        }
        .cover-flip.is-flipping { transform: rotateY(-180deg); }
        .cover-back {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: rotateY(180deg);
          background: #ffffff;
        }

        /* Single-page (mobile) page flip — slide + rotate */
        @keyframes mobilePageInRight {
          0%   { transform: translateX(40%) rotateY(35deg) scale(0.92); opacity: 0; }
          60%  { opacity: 1; }
          100% { transform: translateX(0) rotateY(0) scale(1); opacity: 1; }
        }
        @keyframes mobilePageInLeft {
          0%   { transform: translateX(-40%) rotateY(-35deg) scale(0.92); opacity: 0; }
          60%  { opacity: 1; }
          100% { transform: translateX(0) rotateY(0) scale(1); opacity: 1; }
        }

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
        {/* ── Top bar ────────────────────────────────────────────────────── */}
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
                isAutoPlay
                  ? "bg-ink text-cream hover:bg-[#3a3a3a]"
                  : "bg-[#EDEBE6] text-ink hover:bg-card-hover"
              }`}
              title={isAutoPlay ? "Stop auto-flip" : "Auto-flip pages"}
            >
              {isAutoPlay ? <Pause size={12} /> : <Play size={12} />}
              {isAutoPlay ? "Stop" : "Auto"}
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-full bg-[#EDEBE6] flex items-center justify-center hover:bg-card-hover transition-colors shrink-0"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
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
            background:
              "radial-gradient(ellipse at center, #EDEBE6 0%, #DCD8CF 100%)",
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
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2 rounded-full bg-ink text-cream text-xs font-medium hover:bg-[#3a3a3a] transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Book */}
          {!pdfLoading && !pdfError && (
            <div
              className="relative select-none"
              style={{
                ...bookStyle,
                boxShadow:
                  "0 30px 80px -20px rgba(0,0,0,0.45), 0 10px 20px -10px rgba(0,0,0,0.2)",
                borderRadius: 6,
                background: "#ffffff",
                transformStyle: "preserve-3d",
              }}
            >
              {/* Center binding shadow (desktop two-page spread only) */}
              {isWide && !showCover && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left: "50%",
                    width: 18,
                    transform: "translateX(-50%)",
                    background:
                      "linear-gradient(to right, transparent, rgba(0,0,0,0.18) 50%, transparent)",
                    zIndex: 3,
                  }}
                />
              )}

              {/* ── Cover state ────────────────────────────────────────── */}
              {showCover && !isFlipping && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]">
                  {isWide ? (
                    /* Desktop: cover on right half, blank reflection on left */
                    <div className="flex h-full">
                      <div className="w-1/2 h-full bg-cream/60" />
                      <div className="w-1/2 h-full"><Cover /></div>
                    </div>
                  ) : (
                    <Cover />
                  )}
                </div>
              )}

              {/* ── Cover → first spread flip animation ───────────────── */}
              {showCover && isFlipping && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]">
                  {/* Underneath: first spread (revealed after flip) */}
                  <div className="absolute inset-0 flex">
                    {isWide && (
                      <div className="w-1/2 h-full bg-white">
                        <PageSlot pageIndex={targetPages.left} side="left" />
                      </div>
                    )}
                    <div className={`${isWide ? "w-1/2" : "w-full"} h-full bg-white`}>
                      <PageSlot pageIndex={targetPages.right} side="right" />
                    </div>
                  </div>
                  {/* Top: cover flipping (right-side cover only) */}
                  <div className={`absolute top-0 right-0 bottom-0 ${isWide ? "w-1/2" : "w-full"}`}>
                    <div
                      className={`absolute inset-0 cover-flip is-flipping`}
                      style={{
                        transition: `transform ${FLIP_DURATION}ms ease-in-out`,
                      }}
                    >
                      <div className="flip-face">
                        <Cover />
                      </div>
                      <div className="cover-back">
                        <PageSlot pageIndex={targetPages.left ?? targetPages.right} side="left" halfShadow={false} />
                      </div>
                    </div>
                  </div>
                  {/* The left side stays empty during cover flip */}
                </div>
              )}

              {/* ── Inside spreads ─────────────────────────────────────── */}
              {!showCover && !isFlipping && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]">
                  <div className="flex h-full">
                    {isWide && (
                      <div className="w-1/2 h-full bg-white relative">
                        <PageSlot pageIndex={currentPages.left} side="left" />
                      </div>
                    )}
                    <div className={`${isWide ? "w-1/2" : "w-full"} h-full bg-white relative`}>
                      <PageSlot pageIndex={currentPages.right} side="right" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Inside spread flipping ─────────────────────────────── */}
              {!showCover && isFlipping && (
                <div className="absolute inset-0 overflow-hidden rounded-[6px]">
                  {/* Underneath layer: TARGET spread (or cover if closing back) */}
                  <div className="absolute inset-0 flex">
                    {isWide && (
                      <div className="w-1/2 h-full bg-white">
                        {isClosingToCover
                          ? <div className="w-full h-full bg-cream/60" />
                          : <PageSlot pageIndex={targetPages.left} side="left" />}
                      </div>
                    )}
                    <div className={`${isWide ? "w-1/2" : "w-full"} h-full bg-white`}>
                      {isClosingToCover
                        ? <Cover />
                        : <PageSlot pageIndex={targetPages.right} side="right" />}
                    </div>
                  </div>

                  {/* Top layer: CURRENT spread, with one side flipping */}
                  {flipDir === "next" ? (
                    <>
                      {/* Left page stays static during forward flip */}
                      {isWide && (
                        <div className="absolute top-0 left-0 bottom-0 w-1/2 h-full bg-white">
                          <PageSlot pageIndex={currentPages.left} side="left" />
                        </div>
                      )}
                      {/* Right page flips */}
                      <div className={`absolute top-0 ${isWide ? "right-0 w-1/2" : "inset-x-0 w-full"} bottom-0 h-full`}>
                        <div
                          className="flip-page is-flipping-next absolute inset-0"
                          style={{ transition: `transform ${FLIP_DURATION}ms ease-in-out` }}
                        >
                          <div className="flip-face bg-white">
                            <PageSlot pageIndex={currentPages.right} side="right" />
                          </div>
                          <div className="flip-face back bg-white">
                            <PageSlot pageIndex={targetPages.left ?? targetPages.right} side="left" />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Right page stays static during backward flip */}
                      {isWide && !isClosingToCover && (
                        <div className="absolute top-0 right-0 bottom-0 w-1/2 h-full bg-white">
                          <PageSlot pageIndex={currentPages.right} side="right" />
                        </div>
                      )}
                      {/* Left page flips back to the right (on desktop)
                          On mobile: single page flips right */}
                      <div className={`absolute top-0 ${isWide ? "left-0 w-1/2" : "inset-x-0 w-full"} bottom-0 h-full`}>
                        <div
                          className="flip-page-prev is-flipping-prev absolute inset-0"
                          style={{ transition: `transform ${FLIP_DURATION}ms ease-in-out` }}
                        >
                          <div className="flip-face bg-white">
                            {isWide
                              ? <PageSlot pageIndex={currentPages.left} side="left" />
                              : <PageSlot pageIndex={currentPages.right} side="right" />}
                          </div>
                          <div className="flip-face back bg-white">
                            {isClosingToCover
                              ? <Cover />
                              : <PageSlot pageIndex={targetPages.right ?? targetPages.left} side="right" />}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Arrow buttons (overlay) ─────────────────────────────────── */}
          {!pdfLoading && !pdfError && (
            <>
              <button
                onClick={goPrev}
                disabled={showCover}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-ink/85 hover:bg-ink text-cream flex items-center justify-center shadow-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={goNext}
                disabled={!showCover && spread >= totalSpreads - 1}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-ink/85 hover:bg-ink text-cream flex items-center justify-center shadow-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {/* Swipe-area hint chevrons (mobile only, inside book area) */}
          {!pdfLoading && !pdfError && !showCover && (
            <>
              {(spread > 0 || !showCover) && (
                <div
                  className="sm:hidden absolute left-3 top-1/2 pointer-events-none text-ink/35"
                  style={{ animation: "hintPulseLeft 1.6s ease-in-out infinite" }}
                  aria-hidden
                >
                  <ChevronLeft size={16} />
                </div>
              )}
              {spread < totalSpreads - 1 && (
                <div
                  className="sm:hidden absolute right-3 top-1/2 pointer-events-none text-ink/35"
                  style={{ animation: "hintPulseRight 1.6s ease-in-out infinite" }}
                  aria-hidden
                >
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
              {showCover
                ? "Cover"
                : `Page ${(currentPages.right ?? 0) + 1} of ${totalPages}`}
            </span>
          </div>
        )}
      </main>
    </>
  );
}
