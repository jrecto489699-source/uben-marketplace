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

const PAGE_RENDER_SCALE = 1.2; // 1.5 was overkill — pages display at ~480px wide
const FLIP_DURATION    = 1100;
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
  // Pages currently being rendered — prevents the same page being
  // rendered twice when both the useEffect and startFlip kick it off.
  const renderingRef = useRef(new Set<number>());

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

  // PDF page 0 IS the cover — it's only used by <Cover />, never as
  // a content page. Inside spreads start at PDF page 1, so there's
  // one less content page than total PDF pages.
  const pagesPerSpread = isWide ? 2 : 1;
  const contentPages   = Math.max(0, totalPages - 1);
  const totalSpreads   = Math.ceil(contentPages / pagesPerSpread);

  function pagesForSpread(s: number): { left: number | null; right: number | null } {
    if (isWide) return { left: s * 2 + 1, right: s * 2 + 2 };
    return { left: null, right: s + 1 };
  }

  useEffect(() => { getPdfJs(); }, []);

  async function renderPage(pageIndex: number) {
    const doc = pdfDocRef.current;
    if (!doc || pageIndex < 0 || pageIndex >= doc.numPages) return;
    if (pageImages[pageIndex]) return;
    if (renderingRef.current.has(pageIndex)) return;
    renderingRef.current.add(pageIndex);
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
    } finally {
      renderingRef.current.delete(pageIndex);
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

  // ── Auto-play loop ────────────────────────────────────────────────────────
  // Three states:
  //  1. On the cover → after a short pause, open the book.
  //  2. On any inside spread that's not the last → advance after the
  //     delay.
  //  3. On the LAST spread → after the delay, animate the book closed
  //     and turn auto-play off.
  useEffect(() => {
    if (!isAutoPlay || isFlipping || pdfLoading || pdfError) return;

    if (showCover) {
      // Auto-open from the cover with a short pause first
      const timer = setTimeout(() => goNext(), AUTO_PLAY_DELAY * 0.6);
      return () => clearTimeout(timer);
    }

    if (totalSpreads > 0 && spread >= totalSpreads - 1) {
      // Reached the end — close the book and stop auto-play
      const timer = setTimeout(() => {
        setIsAutoPlay(false);
        startFlip("prev", "cover-close", () => {
          setShowCover(true);
          setSpread(0);
        });
      }, AUTO_PLAY_DELAY);
      return () => clearTimeout(timer);
    }

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
            {pageIndex}
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

  // Sizing — the book grows from a single-page (3:4) into a two-page
  // spread (3:2) during the cover-open animation.
  //
  // Use a CSS variable for the single-page width so the spread is
  // *exactly* twice as wide. Both share the same height (3:4 of W
  // equals 3:2 of 2W). The cover element rendered during cover-open
  // also uses this --pw value so it stays anchored to its single-page
  // size as the container widens around it — the classic Heyzine
  // "book grows open" effect.
  // Book sizing. On wide screens the single page is capped so the
  // spread (2 × PAGE_W) fits comfortably. On narrow screens we
  // let the page take up most of the viewport — the book was too
  // small on phones before. Both states have the same height because
  // 3:4 of W equals 3:2 of 2W.
  const PAGE_W = isWide
    ? "min(46vw, 560px, calc(82dvh * 0.75))"
    : "min(92vw, 460px, calc(74dvh * 0.75))";
  // Fixed height across both states — for any PAGE_W, height is
  // PAGE_W × 4/3. Since spread is 2×PAGE_W with a 3:2 ratio, it
  // works out to the SAME height as the single-page (3:4) state.
  // Setting `height` explicitly instead of letting the browser
  // interpolate `aspect-ratio` removes a major source of jitter
  // during the width transition — aspect-ratio changes were causing
  // the container height to jump around as width animated.
  const PAGE_H = `calc((${PAGE_W}) * 4 / 3)`;
  const pageUnitStyle = { width: PAGE_W, height: PAGE_H };
  const spreadStyle   = isWide
    ? { width: `calc(${PAGE_W} * 2)`, height: PAGE_H }
    : pageUnitStyle;

  // Container is page-width only when the cover is shown by
  // itself. During cover-close it stays at spread width — matches
  // yesterday's behavior where the spread content rotates away on
  // the full-size flipping element and the container snaps to
  // page width after the close completes.
  const containerAtPageWidth = showCover && !isFlipping;
  const containerStyle: React.CSSProperties = containerAtPageWidth
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
        }
        .flip-face.back { transform: rotateY(180deg); }
        /* Heyzine-style two-element page flip — no shared rotating
           parent, no backface-visibility dependency. Each face has
           its own animation that never rotates past 90° (so it can
           never appear mirrored). The front fades out exactly when
           the back fades in, at the 50% midpoint where both are
           edge-on. */
        @keyframes flipOutNext {
          0%   { transform: rotateY(0deg);    box-shadow: 0 3px 8px rgba(0,0,0,0.10); opacity: 1; }
          25%  { transform: rotateY(-45deg);  box-shadow: -12px 20px 30px rgba(0,0,0,0.25); opacity: 1; }
          49.9%{ transform: rotateY(-89deg);  box-shadow: 0 30px 48px rgba(0,0,0,0.34); opacity: 1; }
          50%, 100% { transform: rotateY(-90deg); opacity: 0; }
        }
        @keyframes flipInNext {
          0%, 49.9% { transform: rotateY(90deg);  opacity: 0; }
          50%  { transform: rotateY(90deg);  box-shadow: 0 30px 48px rgba(0,0,0,0.34); opacity: 1; }
          75%  { transform: rotateY(45deg);  box-shadow: 12px 20px 30px rgba(0,0,0,0.25); opacity: 1; }
          100% { transform: rotateY(0deg);   box-shadow: 0 3px 8px rgba(0,0,0,0.10); opacity: 1; }
        }
        @keyframes flipOutPrev {
          0%   { transform: rotateY(0deg);    box-shadow: 0 3px 8px rgba(0,0,0,0.10); opacity: 1; }
          25%  { transform: rotateY(45deg);   box-shadow: 12px 20px 30px rgba(0,0,0,0.25); opacity: 1; }
          49.9%{ transform: rotateY(89deg);   box-shadow: 0 30px 48px rgba(0,0,0,0.34); opacity: 1; }
          50%, 100% { transform: rotateY(90deg);  opacity: 0; }
        }
        @keyframes flipInPrev {
          0%, 49.9% { transform: rotateY(-90deg); opacity: 0; }
          50%  { transform: rotateY(-90deg); box-shadow: 0 30px 48px rgba(0,0,0,0.34); opacity: 1; }
          75%  { transform: rotateY(-45deg); box-shadow: -12px 20px 30px rgba(0,0,0,0.25); opacity: 1; }
          100% { transform: rotateY(0deg);   box-shadow: 0 3px 8px rgba(0,0,0,0.10); opacity: 1; }
        }
        /* Mobile page flip — single rotating element, the front
           shows the current page and the back shows the target.
           Only one rotation happens (around the spine edge), so
           it reads as a single page turning, not the desktop's
           two elements crossing over. */
        @keyframes mobileFlipNext {
          0%   { transform: rotateY(0deg);    box-shadow: 0 3px 8px rgba(0,0,0,0.10); }
          50%  { transform: rotateY(-90deg);  box-shadow: 0 30px 48px rgba(0,0,0,0.34); }
          100% { transform: rotateY(-180deg); box-shadow: 0 3px 8px rgba(0,0,0,0.10); }
        }
        @keyframes mobileFlipPrev {
          0%   { transform: rotateY(0deg);    box-shadow: 0 3px 8px rgba(0,0,0,0.10); }
          50%  { transform: rotateY(90deg);   box-shadow: 0 30px 48px rgba(0,0,0,0.34); }
          100% { transform: rotateY(180deg);  box-shadow: 0 3px 8px rgba(0,0,0,0.10); }
        }
        /* Sharp opacity swap so we don't depend on backface-visibility
           (Chrome flattens our 3D context too often). */
        @keyframes mobileFlipFrontHide {
          0%, 49.9% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes mobileFlipBackShow {
          0%, 49.9% { opacity: 0; }
          50%, 100% { opacity: 1; }
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
                  ? `Pages ${currentPages.left !== null && currentPages.left < totalPages ? currentPages.left : "—"}–${currentPages.right !== null && currentPages.right < totalPages ? currentPages.right : "—"}`
                  : `Page ${currentPages.right ?? 0}`}
                <span className="text-ink-muted/70"> of {contentPages}</span>
              </span>
            </div>
          )}

          {!pdfError && !pdfLoading && (
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
          className="flex-1 relative overflow-hidden min-h-0 flex items-center justify-center px-2 py-3 bg-cream"
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
                transition:
                  `width ${FLIP_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1), height ${FLIP_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1)`,
              }}
            >
              {/* COVER closed — cover is locked at PAGE_W and
                  centered, so when the container is resizing from
                  spread → page width right after a cover-close, the
                  cover doesn't horizontally squish along with the
                  container. It stays its real size and the book
                  "settles" around it. */}
              {showCover && !isFlipping && (
                <div
                  className="absolute top-0 bottom-0 overflow-hidden rounded-[8px]"
                  style={{ left: "50%", transform: "translateX(-50%)", width: PAGE_W }}
                >
                  <Cover />
                </div>
              )}

              {/* COVER OPENING — Heyzine-style: the container is already
                  growing from single-page to spread width (CSS transition
                  on width), and the cover stays at its single-page size
                  anchored to the right side. The cover rotates around its
                  left edge — that left edge is at the centre of the
                  eventual spread, which acts as the book's spine.
                  Transparent back face so the spread shows through. */}
              {flipMode === "cover-open" && (
                <div className="absolute inset-0 overflow-hidden rounded-[8px]" style={{ transformStyle: "preserve-3d" }}>
                  {/* Underneath: target spread, fully visible from frame 1 */}
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
                  {/* Top: cover anchored to the right with a fixed single-page
                      width; rotates around its left edge (the spine). */}
                  <div
                    className="absolute top-0 bottom-0"
                    style={{
                      right: 0,
                      width: isWide ? PAGE_W : "100%",
                      transformOrigin: "left center",
                      transformStyle: "preserve-3d",
                      animation: `pageBendForward ${FLIP_DURATION}ms linear forwards`,
                      willChange: "transform",
                    }}
                  >
                    <div className="flip-face"><Cover /></div>
                    {/* Transparent back face so the spread shows through */}
                    <div className="flip-face back" />
                  </div>
                </div>
              )}

              {/* COVER CLOSING.
                  Desktop: spread content flips away on a full-size
                  element with a transparent back, revealing the cover
                  underneath at inset:0.
                  Mobile: same pattern as a normal page flip — single
                  rotating element with the current page on the front
                  and the cover on the back, opacity-stepped at 50%.
                  Reads as the page itself becoming the cover, which
                  is what "closing the book" looks like. */}
              {flipMode === "cover-close" && (
                <div className="absolute inset-0 overflow-hidden rounded-[8px]" style={{ transformStyle: "preserve-3d" }}>
                  {isWide ? (
                    <>
                      {/* Underneath: cover at the same locked
                          PAGE_W centered position as the closed
                          state, so when the flip finishes and the
                          container shrinks, the cover doesn't move
                          or squish — it's already where it'll be. */}
                      <div
                        className="absolute top-0 bottom-0 overflow-hidden rounded-[8px]"
                        style={{ left: "50%", transform: "translateX(-50%)", width: PAGE_W }}
                      >
                        <Cover />
                      </div>
                      {/* Top: spread content flips to the right */}
                      <div
                        className="absolute inset-0"
                        style={{
                          transformOrigin: "right center",
                          transformStyle: "preserve-3d",
                          animation: `pageBendBackward ${FLIP_DURATION}ms linear forwards`,
                          willChange: "transform",
                        }}
                      >
                        <div className="flip-face">
                          <div className="flex h-full">
                            <div className="w-1/2 h-full"><PageInPanel pageIndex={currentPages.left}  side="left"  /></div>
                            <div className="w-1/2 h-full"><PageInPanel pageIndex={currentPages.right} side="right" /></div>
                          </div>
                        </div>
                        <div className="flip-face back" />
                      </div>
                    </>
                  ) : (
                    /* Mobile — same single-element flip as the page
                       turn, with the cover on the back face. The book
                       physically closes. */
                    <div
                      className="absolute inset-0"
                      style={{
                        transformOrigin: "right center",
                        transformStyle: "preserve-3d",
                        animation: `mobileFlipPrev ${FLIP_DURATION}ms linear forwards`,
                        willChange: "transform",
                      }}
                    >
                      <div
                        className="flip-face"
                        style={{ animation: `mobileFlipFrontHide ${FLIP_DURATION}ms linear forwards` }}
                      >
                        <PageInPanel pageIndex={currentPages.right} side="single" />
                      </div>
                      <div
                        className="flip-face back"
                        style={{ animation: `mobileFlipBackShow ${FLIP_DURATION}ms linear forwards` }}
                      >
                        <Cover />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* INSIDE — persistent base layer.
                  Rendered any time we're past the cover. During a page
                  flip it shows the TARGET spread underneath; during the
                  static state it shows the current spread. Since
                  targetPages === currentPages once the flip finishes,
                  these PageInPanel components keep the SAME pageIndex
                  across the flip→static transition — React doesn't
                  unmount them, so the browser never has to re-decode
                  the page images. That's what eliminates the half-
                  second "old page lingers" flash after a swipe. */}
              {!showCover && (
                <div className="absolute inset-0 overflow-hidden rounded-[8px]">
                  {(() => {
                    const showTarget = isFlipping && flipMode === "page";
                    const left  = showTarget ? targetPages.left  : currentPages.left;
                    const right = showTarget ? targetPages.right : currentPages.right;
                    return isWide ? (
                      <>
                        <div className="flex h-full">
                          <div className="w-1/2 h-full"><PageInPanel pageIndex={left}  side="left"  /></div>
                          <div className="w-1/2 h-full"><PageInPanel pageIndex={right} side="right" /></div>
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
                      <PageInPanel pageIndex={right} side="single" />
                    );
                  })()}
                </div>
              )}

              {/* INSIDE — page flip.
                  Desktop uses two elements meeting at the spine
                  (each on its own half of the spread). Mobile uses
                  a SINGLE rotating element with front/back faces
                  swapped via opacity at 50% — so the user sees one
                  continuous page turn, not two stacked rotations. */}
              {flipMode === "page" && (
                <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
                  {isWide ? (
                    flipDir === "next" ? (
                      <>
                        {/* Static left page stays put */}
                        <div className="absolute top-0 left-0 bottom-0 w-1/2 h-full">
                          <PageInPanel pageIndex={currentPages.left} side="left" />
                        </div>
                        {/* OUT: current right page lifting up. */}
                        <div
                          className="absolute top-0 right-0 bottom-0 w-1/2 h-full"
                          style={{
                            transformOrigin: "left center",
                            animation: `flipOutNext ${FLIP_DURATION}ms linear forwards`,
                            willChange: "transform, opacity",
                          }}
                        >
                          <PageInPanel pageIndex={currentPages.right} side="right" />
                        </div>
                        {/* IN: target left page landing in. */}
                        <div
                          className="absolute top-0 left-0 bottom-0 w-1/2 h-full"
                          style={{
                            transformOrigin: "right center",
                            animation: `flipInNext ${FLIP_DURATION}ms linear forwards`,
                            willChange: "transform, opacity",
                          }}
                        >
                          <PageInPanel pageIndex={targetPages.left} side="left" />
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Static right page stays put */}
                        <div className="absolute top-0 right-0 bottom-0 w-1/2 h-full">
                          <PageInPanel pageIndex={currentPages.right} side="right" />
                        </div>
                        {/* OUT: current left page lifting up. */}
                        <div
                          className="absolute top-0 left-0 bottom-0 w-1/2 h-full"
                          style={{
                            transformOrigin: "right center",
                            animation: `flipOutPrev ${FLIP_DURATION}ms linear forwards`,
                            willChange: "transform, opacity",
                          }}
                        >
                          <PageInPanel pageIndex={currentPages.left} side="left" />
                        </div>
                        {/* IN: target right page landing in. */}
                        <div
                          className="absolute top-0 right-0 bottom-0 w-1/2 h-full"
                          style={{
                            transformOrigin: "left center",
                            animation: `flipInPrev ${FLIP_DURATION}ms linear forwards`,
                            willChange: "transform, opacity",
                          }}
                        >
                          <PageInPanel pageIndex={targetPages.right} side="right" />
                        </div>
                      </>
                    )
                  ) : (
                    /* Mobile — one element rotating, two faces. */
                    <div
                      className="absolute inset-0"
                      style={{
                        transformOrigin: flipDir === "next" ? "left center" : "right center",
                        transformStyle: "preserve-3d",
                        animation: `${flipDir === "next" ? "mobileFlipNext" : "mobileFlipPrev"} ${FLIP_DURATION}ms linear forwards`,
                        willChange: "transform",
                      }}
                    >
                      <div
                        className="flip-face"
                        style={{ animation: `mobileFlipFrontHide ${FLIP_DURATION}ms linear forwards` }}
                      >
                        <PageInPanel pageIndex={currentPages.right} side="single" />
                      </div>
                      <div
                        className="flip-face back"
                        style={{ animation: `mobileFlipBackShow ${FLIP_DURATION}ms linear forwards` }}
                      >
                        <PageInPanel pageIndex={targetPages.right} side="single" />
                      </div>
                    </div>
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
              {showCover ? "Cover" : `Page ${currentPages.right ?? 0} of ${contentPages}`}
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
