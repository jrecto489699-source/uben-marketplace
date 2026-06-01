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
const ANIM_DURATION    = 600;
const AUTO_PLAY_DELAY  = 5000;
const SWIPE_THRESHOLD  = 50;

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

  // ── Navigation ────────────────────────────────────────────────────────────
  const [showCover,     setShowCover]     = useState(true);
  const [currentPage,   setCurrentPage]   = useState(0); // 0-indexed
  const [animDirection, setAnimDirection] = useState<"next" | "prev" | null>(null);
  const [isFlipping,    setIsFlipping]    = useState(false);
  const flipTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoPlay,   setIsAutoPlay]   = useState(false);

  // ── Touch swipe ───────────────────────────────────────────────────────────
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  // Track latest values for async callbacks
  const stateRef = useRef({ currentPage, totalPages, showCover, isFlipping });
  useEffect(() => {
    stateRef.current = { currentPage, totalPages, showCover, isFlipping };
  }, [currentPage, totalPages, showCover, isFlipping]);

  // Warm up PDF.js
  useEffect(() => { getPdfJs(); }, []);

  // ── Render a PDF page to a data URL ───────────────────────────────────────
  async function renderPage(pageIndex: number) {
    const doc = pdfDocRef.current;
    if (!doc || pageIndex < 0 || pageIndex >= doc.numPages) return;
    setPageImages(prev => {
      if (prev[pageIndex]) return prev;
      // Mark as in-progress with a placeholder so we don't double-render
      return prev;
    });
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
        // Pre-render the first page so it's ready when the user opens the cover
        await renderPage(0);
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

  // ── Pre-render nearby pages once we've left the cover ────────────────────
  useEffect(() => {
    if (pdfLoading || pdfError || showCover) return;
    renderPage(currentPage);
    if (currentPage + 1 < totalPages) renderPage(currentPage + 1);
    if (currentPage - 1 >= 0)         renderPage(currentPage - 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, totalPages, showCover, pdfLoading, pdfError]);

  // ── Save & restore reading position ───────────────────────────────────────
  const localKey = `uben_story_${purchaseId}`;
  useEffect(() => {
    if (pdfLoading || pdfError) return;
    try {
      localStorage.setItem(localKey, JSON.stringify({
        page: showCover ? -1 : currentPage,
      }));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCover, currentPage, pdfLoading, pdfError]);

  useEffect(() => {
    if (pdfLoading || pdfError) return;
    try {
      const raw = localStorage.getItem(localKey);
      if (!raw) return;
      const { page } = JSON.parse(raw);
      if (typeof page === "number" && page >= 0 && page < totalPages) {
        setShowCover(false);
        setCurrentPage(page);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfLoading]);

  // ── Page navigation ───────────────────────────────────────────────────────
  function startFlip(direction: "next" | "prev") {
    setAnimDirection(direction);
    setIsFlipping(true);
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    flipTimerRef.current = setTimeout(() => {
      setIsFlipping(false);
    }, ANIM_DURATION);
  }

  function openBook() {
    if (stateRef.current.isFlipping) return;
    setShowCover(false);
    setCurrentPage(0);
    startFlip("next");
  }

  function goNext() {
    const s = stateRef.current;
    if (s.isFlipping) return;
    if (s.showCover) { openBook(); return; }
    if (s.currentPage >= s.totalPages - 1) return;
    setCurrentPage(s.currentPage + 1);
    startFlip("next");
  }

  function goPrev() {
    const s = stateRef.current;
    if (s.isFlipping) return;
    if (s.showCover) return;
    if (s.currentPage === 0) {
      setShowCover(true);
      startFlip("prev");
      return;
    }
    setCurrentPage(s.currentPage - 1);
    startFlip("prev");
  }

  // ── Auto-play ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAutoPlay || showCover || isFlipping || pdfLoading || pdfError) return;
    if (currentPage >= totalPages - 1) {
      setIsAutoPlay(false);
      return;
    }
    const timer = setTimeout(() => goNext(), AUTO_PLAY_DELAY);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoPlay, currentPage, showCover, isFlipping, pdfLoading, pdfError, totalPages]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.code === "ArrowRight" || e.code === "Space") {
        e.preventDefault(); goNext();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault(); goPrev();
      }
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
    if (dx < 0) goNext();
    else goPrev();
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

  const pageImg = pageImages[currentPage];

  return (
    <>
      <style>{`
        @keyframes pageInRight {
          0%   { transform: translateX(45%) rotateY(40deg) scale(0.92); opacity: 0; }
          60%  { opacity: 1; }
          100% { transform: translateX(0) rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes pageInLeft {
          0%   { transform: translateX(-45%) rotateY(-40deg) scale(0.92); opacity: 0; }
          60%  { opacity: 1; }
          100% { transform: translateX(0) rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes coverOut {
          0%   { transform: translateX(0) rotateY(0deg) scale(1); opacity: 1; }
          100% { transform: translateX(-40%) rotateY(-50deg) scale(0.9); opacity: 0; }
        }
        @keyframes coverIn {
          0%   { transform: translateX(-40%) rotateY(-50deg) scale(0.9); opacity: 0; }
          100% { transform: translateX(0) rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes hintPulse {
          0%, 100% { transform: translateY(-50%) translateX(0); opacity: 0.55; }
          50%      { transform: translateY(-50%) translateX(-4px); opacity: 0.95; }
        }
        @keyframes hintPulseRight {
          0%, 100% { transform: translateY(-50%) translateX(0); opacity: 0.55; }
          50%      { transform: translateY(-50%) translateX(4px); opacity: 0.95; }
        }
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
                Page <span className="font-semibold text-ink">{currentPage + 1}</span> of {totalPages}
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

        {/* ── Book area ─────────────────────────────────────────────────── */}
        <div
          className="flex-1 relative overflow-hidden min-h-0 flex items-center justify-center px-4"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            perspective: "2400px",
            background:
              "radial-gradient(ellipse at center, #EDEBE6 0%, #DCD8CF 100%)",
          }}
        >
          {/* PDF loading */}
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

          {/* Cover */}
          {!pdfLoading && !pdfError && showCover && (
            <div
              key="cover"
              className="relative rounded-r-lg overflow-hidden select-none"
              style={{
                width: "min(85vw, 460px)",
                aspectRatio: "3/4",
                boxShadow:
                  "0 25px 60px -15px rgba(0,0,0,0.45), -2px 0 0 rgba(0,0,0,0.15)",
                background: "linear-gradient(135deg, #134A4F 0%, #0a2a2d 100%)",
                animation:
                  animDirection === "prev" ? "coverIn 0.6s ease-out" :
                  animDirection === "next" && isFlipping ? "coverOut 0.6s ease-out forwards" :
                  "none",
                transformStyle: "preserve-3d",
                transformOrigin: "left center",
              }}
            >
              {/* Cover image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.image}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.55 }}
                draggable={false}
              />
              {/* Decorative vignette */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.6) 100%), radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)",
                }}
              />
              {/* Binding stripe */}
              <div
                className="absolute top-0 bottom-0 left-0 w-3 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to right, rgba(0,0,0,0.55), rgba(0,0,0,0.15) 60%, transparent)",
                }}
              />
              {/* Top gold trim */}
              <div className="absolute top-0 inset-x-0 h-1" style={{ background: "linear-gradient(to right, transparent, rgba(212,175,55,0.5), transparent)" }} />
              <div className="absolute bottom-0 inset-x-0 h-1" style={{ background: "linear-gradient(to right, transparent, rgba(212,175,55,0.5), transparent)" }} />

              {/* Text */}
              <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 text-cream">
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] opacity-80 mb-2 sm:mb-3">A Storybook</div>
                <h2 className="font-serif text-2xl sm:text-4xl font-bold leading-tight mb-2 drop-shadow">
                  {product.title}
                </h2>
                <p className="text-xs sm:text-sm opacity-80 mb-5 sm:mb-6 italic">{product.seller}</p>
                <button
                  onClick={openBook}
                  className="self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cream text-ink text-sm font-semibold hover:bg-white transition-colors shadow-lg"
                >
                  <BookOpen size={14} />
                  Open Book
                </button>
              </div>
            </div>
          )}

          {/* Page */}
          {!pdfLoading && !pdfError && !showCover && (
            <div
              key={`page-${currentPage}`}
              className="relative bg-white rounded-r-lg overflow-hidden select-none"
              style={{
                width: "min(85vw, 460px)",
                aspectRatio: "3/4",
                boxShadow:
                  "0 25px 60px -15px rgba(0,0,0,0.4), -2px 0 0 rgba(0,0,0,0.12)",
                animation:
                  animDirection === "next" ? "pageInRight 0.6s ease-out" :
                  animDirection === "prev" ? "pageInLeft 0.6s ease-out" :
                  "none",
                transformStyle: "preserve-3d",
                transformOrigin: "left center",
              }}
            >
              {pageImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pageImg}
                  alt={`Page ${currentPage + 1}`}
                  className="absolute inset-0 w-full h-full object-contain bg-white"
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-white">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-ink-muted">Loading page…</p>
                  </div>
                </div>
              )}
              {/* Binding shadow on left */}
              <div
                className="absolute top-0 bottom-0 left-0 w-5 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to right, rgba(0,0,0,0.25), rgba(0,0,0,0.05) 50%, transparent)",
                }}
              />
              {/* Page-edge curl on right */}
              <div
                className="absolute top-0 bottom-0 right-0 w-2 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to left, rgba(0,0,0,0.10), transparent)",
                }}
              />
            </div>
          )}

          {/* Left arrow */}
          {!pdfLoading && !pdfError && (
            <button
              onClick={goPrev}
              disabled={showCover}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-ink/85 hover:bg-ink text-cream flex items-center justify-center shadow-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              title="Previous page"
              aria-label="Previous page"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {/* Right arrow */}
          {!pdfLoading && !pdfError && (
            <button
              onClick={goNext}
              disabled={!showCover && currentPage >= totalPages - 1}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-ink/85 hover:bg-ink text-cream flex items-center justify-center shadow-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              title="Next page"
              aria-label="Next page"
            >
              <ChevronRight size={22} />
            </button>
          )}

          {/* Swipe hints — subtle pulsing chevrons near book edges (touch only) */}
          {!pdfLoading && !pdfError && !showCover && (
            <>
              {currentPage > 0 && (
                <div
                  className="sm:hidden absolute left-1 top-1/2 pointer-events-none text-ink/40"
                  style={{ animation: "hintPulse 1.6s ease-in-out infinite" }}
                  aria-hidden
                >
                  <ChevronLeft size={18} />
                </div>
              )}
              {currentPage < totalPages - 1 && (
                <div
                  className="sm:hidden absolute right-1 top-1/2 pointer-events-none text-ink/40"
                  style={{ animation: "hintPulseRight 1.6s ease-in-out infinite" }}
                  aria-hidden
                >
                  <ChevronRight size={18} />
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Mobile page indicator ─────────────────────────────────────── */}
        {totalPages > 0 && !showCover && (
          <div className="md:hidden bg-cream border-t border-border-muted px-4 py-2 flex items-center justify-center gap-3 shrink-0">
            <BookOpen size={13} className="text-ink-muted" />
            <span className="text-xs text-ink-muted tabular-nums">
              Page <span className="font-semibold text-ink">{currentPage + 1}</span> of {totalPages}
            </span>
          </div>
        )}
      </main>
    </>
  );
}
