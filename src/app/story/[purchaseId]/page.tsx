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
const FLIP_DURATION    = 1100; // a touch longer so the wave reads naturally
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
        // Block on the first two pages — they appear immediately when the
        // cover opens. Kick off the next four in the background so they
        // are ready by the time the reader gets to them.
        await renderPage(0);
        if (doc.numPages > 1) await renderPage(1);
        setPdfLoading(false);
        for (let i = 2; i < Math.min(8, doc.numPages); i++) renderPage(i);
      } catch (err) {
        console.error("[story] PDF load failed:", err);
        setPdfError(err instanceof Error ? err.message : "Failed to load storybook");
        setPdfLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase?.id]);

  // Pre-render a wider window of spreads (current ±2) so rapid taps
  // never reveal an unrendered page underneath the swiping page.
  useEffect(() => {
    if (pdfLoading || pdfError || showCover) return;
    for (let offset = -2; offset <= 2; offset++) {
      const { left, right } = pagesForSpread(spread + offset);
      if (left  !== null && left  >= 0 && left  < totalPages) renderPage(left);
      if (right !== null && right >= 0 && right < totalPages) renderPage(right);
    }
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
    // Kick off rendering of the target spread's pages BEFORE the animation
    // starts so they're ready (or rendering in parallel with the swipe)
    // and the spread underneath is immediately visible.
    const s = stateRef.current;
    let targetSpread: number | null = null;
    if (mode === "cover-open")      targetSpread = 0;
    else if (mode === "cover-close")targetSpread = null; // closing reveals the cover, no PDF needed
    else if (direction === "next")  targetSpread = s.spread + 1;
    else                            targetSpread = s.spread - 1;
    if (targetSpread !== null && targetSpread >= 0 && targetSpread < totalSpreads) {
      const target = pagesForSpread(targetSpread);
      if (target.left  !== null && target.left  >= 0 && target.left  < s.totalPages) renderPage(target.left);
      if (target.right !== null && target.right >= 0 && target.right < s.totalPages) renderPage(target.right);
    }

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

  // ── Cover — uses the product image as the actual book cover ─────────────
  function Cover() {
    return (
      <div className="relative w-full h-full overflow-hidden rounded-[6px]"
        style={{ background: "linear-gradient(135deg, #FFE7C4 0%, #FFC2A6 60%, #FF9DA8 100%)" }}>
        {/* Soft sky gradient */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, #B8E6FF 0%, transparent 55%)",
        }} />
        {/* Sun */}
        <div className="absolute top-6 right-6 w-16 h-16 rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 35%, #FFE17A 0%, #FFB94A 70%, #FF9A2D 100%)",
            boxShadow: "0 0 30px rgba(255, 200, 80, 0.55), 0 0 60px rgba(255, 180, 50, 0.3)",
          }} />
        {/* Clouds */}
        <Clouds />
        {/* Hero image area — actual PDF cover lives here */}
        <div className="absolute" style={{
          top: "12%", left: "10%", right: "10%", bottom: "26%",
        }}>
          <div className="relative w-full h-full rounded-2xl overflow-hidden"
            style={{
              background: "#fff",
              boxShadow:
                "0 12px 28px -10px rgba(0,0,0,0.28), 0 4px 10px -4px rgba(0,0,0,0.18), inset 0 0 0 4px #fff, inset 0 0 0 6px rgba(0,0,0,0.06)",
            }}>
            {pageImages[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pageImages[0]} alt={product!.title}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product!.image} alt={product!.title}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false} />
            )}
          </div>
        </div>
        {/* Title strip */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-4 text-center">
          <div className="inline-block px-4 py-2 rounded-full"
            style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(4px)" }}>
            <div className="text-[9px] sm:text-[10px] font-bold tracking-[0.3em] uppercase mb-0.5" style={{ color: "#D4734A" }}>
              ✦ A Storybook ✦
            </div>
            <div className="text-[14px] sm:text-[16px] font-bold uppercase leading-tight" style={{ color: "#46322B", fontFamily: "Georgia, serif" }}>
              {product!.title}
            </div>
            <div className="text-[9px] sm:text-[10px] mt-0.5 italic" style={{ color: "#8B6F62" }}>
              by {product!.seller}
            </div>
          </div>
        </div>
        {/* Grass at the bottom */}
        <svg className="absolute bottom-0 left-0 right-0" viewBox="0 0 600 60" preserveAspectRatio="none" style={{ height: "8%" }}>
          <path d="M 0 40 Q 50 20 100 35 T 200 35 T 300 30 T 400 35 T 500 30 T 600 35 L 600 60 L 0 60 Z" fill="#8FBF6E" />
          <path d="M 0 48 Q 50 35 100 45 T 200 45 T 300 42 T 400 45 T 500 42 T 600 45 L 600 60 L 0 60 Z" fill="#6FA84E" opacity="0.9" />
        </svg>
        {/* Tiny corner stars */}
        <div className="absolute top-3 left-3" style={{ color: "#FFCB52" }}>
          <StarShape size={14} />
        </div>
        <div className="absolute top-12 left-16" style={{ color: "#FFCB52" }}>
          <StarShape size={9} />
        </div>
      </div>
    );
  }

  // ── Inside page — clean kid-friendly frame ───────────────────────────────
  function PageInPanel({ pageIndex, side }: { pageIndex: number | null; side: "left" | "right" | "single" }) {
    const url = pageIndex !== null ? pageImages[pageIndex] : null;
    const hasContent = pageIndex !== null && pageIndex >= 0 && pageIndex < totalPages;
    return (
      <div className="relative w-full h-full overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #FFFAF0 0%, #FFF3DB 100%)",
        }}>
        {/* Subtle dotted texture */}
        <div className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(rgba(150,110,80,0.25) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }} />
        {/* Decorative corner accent */}
        {side !== "right" && (
          <div className="absolute top-3 left-3 opacity-60" style={{ color: "#F4A78A" }}>
            <StarShape size={12} />
          </div>
        )}
        {side !== "left" && (
          <div className="absolute top-3 right-3 opacity-60" style={{ color: "#F4A78A" }}>
            <HeartShape size={12} />
          </div>
        )}
        {/* Inner page frame */}
        <div className="absolute inset-3 sm:inset-4 rounded-xl overflow-hidden"
          style={{
            background: "#fff",
            boxShadow: "inset 0 0 0 1px rgba(180,140,100,0.25), 0 2px 4px rgba(0,0,0,0.04)",
          }}>
          {hasContent && url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Page ${pageIndex + 1}`}
              className="absolute inset-0 w-full h-full object-contain bg-white"
              draggable={false} />
          ) : hasContent ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-white" />
          )}
        </div>
        {/* Inside-binding shadow */}
        {side === "left" && (
          <div className="absolute top-0 bottom-0 right-0 w-3 pointer-events-none"
            style={{ background: "linear-gradient(to left, rgba(0,0,0,0.10), transparent)" }} />
        )}
        {side === "right" && (
          <div className="absolute top-0 bottom-0 left-0 w-3 pointer-events-none"
            style={{ background: "linear-gradient(to right, rgba(0,0,0,0.10), transparent)" }} />
        )}
        {/* Cute page number badge */}
        {hasContent && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums select-none"
            style={{ background: "#FFE2C2", color: "#A66B41" }}>
            {pageIndex + 1}
          </div>
        )}
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
        /* ─── Floppy page-flip — pure rotateY around the binding with
           a multi-stop dynamic shadow that follows the page, plus a
           small overshoot at the end to settle like real paper.
           The shadow translates across the page as it rotates, which
           gives a "floppy / waving" feel even though the page itself
           is a single flat element — your eye reads the moving shadow
           as the page bending and lifting.                          */
        @keyframes pageBendForward {
          0%   { transform: rotateY(0deg);    box-shadow: 0 3px 8px rgba(0,0,0,0.10); }
          18%  { transform: rotateY(-30deg);  box-shadow: -8px 14px 22px rgba(0,0,0,0.20); }
          40%  { transform: rotateY(-70deg);  box-shadow: -18px 26px 36px rgba(0,0,0,0.28); }
          50%  { transform: rotateY(-90deg);  box-shadow: 0 30px 48px rgba(0,0,0,0.34); }
          60%  { transform: rotateY(-110deg); box-shadow: 18px 26px 36px rgba(0,0,0,0.28); }
          82%  { transform: rotateY(-150deg); box-shadow: 8px 14px 22px rgba(0,0,0,0.20); }
          92%  { transform: rotateY(-184deg); box-shadow: 0 4px 10px rgba(0,0,0,0.14); }
          97%  { transform: rotateY(-178deg); box-shadow: 0 3px 8px rgba(0,0,0,0.12); }
          100% { transform: rotateY(-180deg); box-shadow: 0 3px 8px rgba(0,0,0,0.10); }
        }
        @keyframes pageBendBackward {
          0%   { transform: rotateY(0deg);    box-shadow: 0 3px 8px rgba(0,0,0,0.10); }
          18%  { transform: rotateY(30deg);   box-shadow: 8px 14px 22px rgba(0,0,0,0.20); }
          40%  { transform: rotateY(70deg);   box-shadow: 18px 26px 36px rgba(0,0,0,0.28); }
          50%  { transform: rotateY(90deg);   box-shadow: 0 30px 48px rgba(0,0,0,0.34); }
          60%  { transform: rotateY(110deg);  box-shadow: -18px 26px 36px rgba(0,0,0,0.28); }
          82%  { transform: rotateY(150deg);  box-shadow: -8px 14px 22px rgba(0,0,0,0.20); }
          92%  { transform: rotateY(184deg);  box-shadow: 0 4px 10px rgba(0,0,0,0.14); }
          97%  { transform: rotateY(178deg);  box-shadow: 0 3px 8px rgba(0,0,0,0.12); }
          100% { transform: rotateY(180deg);  box-shadow: 0 3px 8px rgba(0,0,0,0.10); }
        }
        @keyframes fadeIn {
          0%   { opacity: 0; }
          30%  { opacity: 0; }
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
          className="flex-1 relative overflow-hidden min-h-0 flex items-center justify-center px-3 py-5 bg-cream"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ perspective: "2400px" }}
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
                boxShadow:
                  "0 30px 80px -20px rgba(0,0,0,0.4), 0 12px 24px -10px rgba(0,0,0,0.2)",
                borderRadius: 8,
                background: "#fff",
                transformStyle: "preserve-3d",
                transition: "width 0.5s ease-in-out, aspect-ratio 0.5s ease-in-out",
              }}
            >
              {/* COVER closed */}
              {showCover && !isFlipping && (
                <div className="absolute inset-0 overflow-hidden rounded-[8px]"><Cover /></div>
              )}

              {/* COVER OPENING — cover bends like paper around its left edge */}
              {flipMode === "cover-open" && (
                <div className="absolute inset-0 overflow-hidden rounded-[8px]" style={{ transformStyle: "preserve-3d" }}>
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
                  {/* Top: cover bends and rotates around its left edge */}
                  <div
                    className="absolute inset-0"
                    style={{
                      transformOrigin: "left center",
                      transformStyle: "preserve-3d",
                      animation: `pageBendForward ${FLIP_DURATION}ms linear forwards`,
                      willChange: "transform, filter",
                    }}
                  >
                    <div className="flip-face"><Cover /></div>
                    <div className="flip-face back" style={{ background: "linear-gradient(180deg, #FFFAF0 0%, #FFE7C7 100%)" }} />
                  </div>
                </div>
              )}

              {/* COVER CLOSING — current spread's left page bends back to reveal cover */}
              {flipMode === "cover-close" && (
                <div className="absolute inset-0 overflow-hidden rounded-[8px]" style={{ transformStyle: "preserve-3d" }}>
                  {/* Underneath: cover */}
                  <div className="absolute inset-0"><Cover /></div>
                  {/* Top: the left-most page bends to the right, around its right edge */}
                  <div
                    className="absolute inset-0"
                    style={{
                      transformOrigin: "right center",
                      transformStyle: "preserve-3d",
                      animation: `pageBendBackward ${FLIP_DURATION}ms linear forwards`,
                      willChange: "transform, filter",
                    }}
                  >
                    <div className="flip-face" style={{ background: "linear-gradient(180deg, #FFFAF0 0%, #FFE7C7 100%)" }} />
                    <div className="flip-face back"><Cover /></div>
                  </div>
                </div>
              )}

              {/* INSIDE — static */}
              {!showCover && !isFlipping && (
                <div className="absolute inset-0 overflow-hidden rounded-[8px]">
                  {isWide ? (
                    <>
                      <div className="flex h-full">
                        <div className="w-1/2 h-full"><PageInPanel pageIndex={currentPages.left}  side="left"  /></div>
                        <div className="w-1/2 h-full"><PageInPanel pageIndex={currentPages.right} side="right" /></div>
                      </div>
                      {/* Soft pastel binding */}
                      <div className="absolute top-0 bottom-0 pointer-events-none"
                        style={{
                          left: "50%", width: 12, transform: "translateX(-50%)",
                          background: "linear-gradient(to right, rgba(180,140,100,0) 0%, rgba(180,140,100,0.18) 50%, rgba(180,140,100,0) 100%)",
                          zIndex: 3,
                        }} />
                    </>
                  ) : (
                    <PageInPanel pageIndex={currentPages.right} side="single" />
                  )}
                </div>
              )}

              {/* INSIDE — single page bends around the binding */}
              {flipMode === "page" && (
                <div className="absolute inset-0 overflow-hidden rounded-[8px]" style={{ transformStyle: "preserve-3d" }}>
                  {/* Underneath: TARGET spread, fully visible */}
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
                      {/* On desktop, the static left page (current) stays put during the flip */}
                      {isWide && (
                        <div className="absolute top-0 left-0 bottom-0 w-1/2 h-full">
                          <PageInPanel pageIndex={currentPages.left} side="left" />
                        </div>
                      )}
                      {/* Flipping page = current right; bends around its left edge */}
                      <div className={`absolute top-0 ${isWide ? "right-0 w-1/2" : "inset-x-0 w-full"} bottom-0 h-full`}>
                        <div
                          className="absolute inset-0"
                          style={{
                            transformOrigin: "left center",
                            transformStyle: "preserve-3d",
                            animation: `pageBendForward ${FLIP_DURATION}ms linear forwards`,
                            willChange: "transform, filter",
                          }}
                        >
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
                      {/* Static right page stays put */}
                      {isWide && (
                        <div className="absolute top-0 right-0 bottom-0 w-1/2 h-full">
                          <PageInPanel pageIndex={currentPages.right} side="right" />
                        </div>
                      )}
                      {/* Flipping page = current left; bends around its right edge */}
                      <div className={`absolute top-0 ${isWide ? "left-0 w-1/2" : "inset-x-0 w-full"} bottom-0 h-full`}>
                        <div
                          className="absolute inset-0"
                          style={{
                            transformOrigin: "right center",
                            transformStyle: "preserve-3d",
                            animation: `pageBendBackward ${FLIP_DURATION}ms linear forwards`,
                            willChange: "transform, filter",
                          }}
                        >
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
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                style={{ background: "#FFB36B", color: "#fff" }}
                aria-label="Previous page">
                <ChevronLeft size={22} />
              </button>
              <button onClick={goNext} disabled={!showCover && spread >= totalSpreads - 1}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                style={{ background: "#FFB36B", color: "#fff" }}
                aria-label="Next page">
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {!pdfLoading && !pdfError && !showCover && (
            <>
              <div className="sm:hidden absolute left-3 top-1/2 pointer-events-none" style={{ color: "rgba(255,179,107,0.7)", animation: "hintPulseLeft 1.6s ease-in-out infinite" }} aria-hidden>
                <ChevronLeft size={16} />
              </div>
              {spread < totalSpreads - 1 && (
                <div className="sm:hidden absolute right-3 top-1/2 pointer-events-none" style={{ color: "rgba(255,179,107,0.7)", animation: "hintPulseRight 1.6s ease-in-out infinite" }} aria-hidden>
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

// ── Decorative components ─────────────────────────────────────────────────────
function StarShape({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 L14.5 9 L22 9 L16 13.5 L18.5 21 L12 16.5 L5.5 21 L8 13.5 L2 9 L9.5 9 Z" />
    </svg>
  );
}
function HeartShape({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21 C 4 14 1 10 4 6 C 7 2 11 4 12 7 C 13 4 17 2 20 6 C 23 10 20 14 12 21 Z" />
    </svg>
  );
}
function CloudShape({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 100 60" fill="#fff">
      <ellipse cx="25" cy="38" rx="22" ry="18" />
      <ellipse cx="55" cy="32" rx="28" ry="22" />
      <ellipse cx="80" cy="40" rx="18" ry="15" />
    </svg>
  );
}
function Clouds() {
  return (
    <>
      <div className="absolute top-[6%] left-[10%] opacity-90"><CloudShape size={60} /></div>
      <div className="absolute top-[14%] right-[20%] opacity-80"><CloudShape size={45} /></div>
      <div className="absolute top-[2%] left-[60%] opacity-85"><CloudShape size={35} /></div>
    </>
  );
}
