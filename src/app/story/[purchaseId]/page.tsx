"use client";

import { use, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Maximize, Minimize,
  Play, Pause, BookOpen, Volume2, VolumeX,
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
// Pause between the narrator finishing a spread and the next page
// auto-turning — long enough for the listener to absorb the last
// line, short enough that the story keeps moving.
const POST_AUDIO_DWELL = 1500;
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
  // 700px catches every iPad (mini portrait is 744px) so they all
  // get the desktop spread + two-element flip animation, instead of
  // falling back to the single-page mobile flip.
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const check = () => setIsWide(window.innerWidth >= 700);
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
  // Narrator audio
  const audioRef                                = useRef<HTMLAudioElement | null>(null);
  const [audioOn,            setAudioOn]        = useState(false);
  const [audioPlaying,       setAudioPlaying]   = useState(false);
  const [audioQueue,         setAudioQueue]     = useState<string[]>([]);
  const [audioQueueIndex,    setAudioQueueIndex]= useState(0);
  // Page-flip sound effect. Lazy-loaded once on mount; played on
  // every page/cover flip. If the file is missing, play() silently
  // rejects — no error.
  const flipSoundRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = new Audio("/sounds/page-flip.mp3");
    a.preload = "auto";
    a.volume  = 0.6;
    flipSoundRef.current = a;
  }, []);
  function playFlipSound() {
    const a = flipSoundRef.current;
    if (!a) return;
    try { a.currentTime = 0; a.play().catch(() => {}); } catch {}
  }

  // iOS Safari requires every HTMLAudioElement to receive at least one
  // play() call from inside a user-gesture handler before it can be
  // played programmatically from a timer or event later. A muted
  // play-then-pause inside the gesture satisfies the requirement
  // without any audible artifact, and is a no-op on permissive
  // browsers (desktop Chrome, Firefox, Android Chrome). The element
  // stays unlocked for the rest of the session.
  //
  // If the element has no `src` yet (the narrator element on the very
  // first Read-Aloud tap, before any fetch has run), play() rejects
  // and iOS does NOT register the unlock — the next programmatic
  // play() in the fetch effect is blocked. To avoid that, swap in a
  // tiny silent WAV data URI just for the unlock, then clear it so
  // the real fetch can take over.
  const SILENT_SRC = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=";
  // True while we're in the middle of a muted unlock play() on the
  // narrator element. The silent WAV used for the unlock is 0
  // duration, so the browser fires `ended` immediately — and that
  // event was reaching onAudioEnded → scheduleAdvance → goNext,
  // turning the page before the real Cover.mp3 had loaded.
  // While this is set, the audio event handlers no-op.
  const isUnlockingRef = useRef(false);
  function unlockAudioElement(el: HTMLAudioElement | null) {
    if (!el) return;
    const prevMuted = el.muted;
    const prevVolume = el.volume;
    const hadSrc = !!el.getAttribute("src") || !!el.src;
    const isNarrator = el === audioRef.current;
    if (isNarrator) isUnlockingRef.current = true;
    // Cleanup runs after the muted unlock play resolves (or fails).
    // CRITICAL: by the time it runs, the fetch effect may have already
    // assigned the real audio URL and started playback. So we ONLY
    // touch the element here if our placeholder src is still in
    // place. Otherwise we just restore muted and leave the real
    // playback alone.
    const cleanup = () => {
      const stillPlaceholder =
        !hadSrc && (el.src === SILENT_SRC || el.currentSrc === SILENT_SRC);
      if (stillPlaceholder) {
        el.pause();
        el.currentTime = 0;
        el.removeAttribute("src");
      } else {
        // For the flip-sound element (no placeholder swap; we just
        // played its own short MP3 silently), pause it so the rest
        // of the file doesn't keep playing in the background and
        // reset to start so the next real flip plays from frame 0.
        try {
          el.pause();
          el.currentTime = 0;
        } catch {}
      }
      el.muted = prevMuted;
      el.volume = prevVolume;
      // Hold the unlocking flag for a short tail. The placeholder's
      // synthetic "ended" event can arrive on a slightly later tick
      // than the play() Promise's resolution — if we cleared the
      // flag synchronously here, that event would slip through to
      // onAudioEnded → scheduleAdvance → goNext, turning the page
      // before the real Cover.mp3 had a chance to play.
      if (isNarrator) {
        setTimeout(() => { isUnlockingRef.current = false; }, 250);
      }
    };
    try {
      el.muted = true;
      el.volume = 0;
      if (!hadSrc) el.src = SILENT_SRC;
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.then(cleanup).catch(cleanup);
      } else {
        cleanup();
      }
    } catch {
      cleanup();
    }
  }

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
    playFlipSound();
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

  // User-initiated navigation (swipe, arrow keys, chevron buttons).
  // Any of these interrupt Read-Aloud — the narrator pauses and
  // auto-flip stops, so the listener has taken back control. The
  // audio system won't re-fetch on the next spread because audioOn
  // is now false.
  function userGoNext() {
    if (audioOn || isAutoPlay) { stopAudio(); setIsAutoPlay(false); }
    goNext();
  }
  function userGoPrev() {
    if (audioOn || isAutoPlay) { stopAudio(); setIsAutoPlay(false); }
    goPrev();
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
  // If the narrator is on AND has audio playing for the current view,
  // the fixed timer is suppressed — `onAudioEnded` triggers the next
  // advance instead, so page-turns are paced by the narration.
  useEffect(() => {
    if (!isAutoPlay || isFlipping || pdfLoading || pdfError) return;
    // When the narrator is on, the audio system drives every advance
    // (onAudioEnded for narrated pages, the URL-null branch for
    // silent ones). Suppress the fixed timer entirely so we don't
    // race against a slow audio load on mobile.
    if (audioOn) return;

    if (showCover) {
      const timer = setTimeout(() => goNext(), AUTO_PLAY_DELAY * 0.6);
      return () => clearTimeout(timer);
    }

    if (totalSpreads > 0 && spread >= totalSpreads - 1) {
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
  }, [isAutoPlay, spread, showCover, isFlipping, pdfLoading, pdfError, totalSpreads, audioOn, audioPlaying]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.code === "ArrowRight" || e.code === "Space") { e.preventDefault(); userGoNext(); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); userGoPrev(); }
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
    if (dx < 0) userGoNext(); else userGoPrev();
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

  // NOTE: early returns are intentionally delayed until after every
  // hook in this component has had a chance to register, so the hook
  // order stays stable across renders (avoids React error #310 when
  // `loading` flips from true → false).

  // ── Cover — uses the product image as the actual book cover ─────────────
  function Cover() {
    const src = pageImages[0] ?? product!.image;
    return (
      <div className="relative w-full h-full overflow-hidden rounded-[6px] bg-white">
        {/* The PDF's first page IS the designed cover — display it
            edge-to-edge with no decorations on top. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={product!.title}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
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

  // ── Narrator: build the audio queue for the current view ─────────────────
  // Cover view  → ["cover"]
  // Desktop spread → [left, right] (in reading order)
  // Mobile  → [right] (single visible page)
  // We only rebuild when the flip settles, so page-turn audio doesn't
  // start mid-rotation.
  useEffect(() => {
    if (pdfLoading || pdfError) return;
    if (isFlipping) return;
    if (showCover) {
      setAudioQueue(["cover"]);
    } else {
      const ids: string[] = [];
      if (isWide && currentPages.left !== null) ids.push(String(currentPages.left));
      if (currentPages.right !== null)          ids.push(String(currentPages.right));
      setAudioQueue(ids);
    }
    setAudioQueueIndex(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCover, currentPages.left, currentPages.right, isWide, isFlipping, pdfLoading, pdfError]);

  // Whenever the queue item changes, fetch its signed URL and (optionally)
  // start playback. If the page has no audio file, the route returns
  // `url: null`; we silently skip to the next queue item.
  useEffect(() => {
    if (!audioOn) return;
    const item = audioQueue[audioQueueIndex];
    if (!item) { setAudioPlaying(false); return; }
    let cancelled = false;
    fetch(`/api/story-audio/${purchaseId}/${item}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { url: null })
      .then((data: { url: string | null }) => {
        if (cancelled) return;
        const el = audioRef.current;
        if (!el) return;
        if (!data.url) {
          // Skip silent pages within a spread; if the whole spread is
          // silent and auto-play is on, hand off to scheduleAdvance
          // so the page still turns at the same dwell as a narrated
          // one (instead of stalling forever).
          if (audioQueueIndex < audioQueue.length - 1) {
            setAudioQueueIndex(audioQueueIndex + 1);
          } else {
            setAudioPlaying(false);
            scheduleAdvance();
          }
          return;
        }
        el.src = data.url;
        el.play().then(() => setAudioPlaying(true)).catch(() => setAudioPlaying(false));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [audioQueue, audioQueueIndex, audioOn, purchaseId]);

  // Schedule the next page-turn after POST_AUDIO_DWELL. Used by the
  // audio system whenever it finishes a spread — narrated or silent.
  // Tracks the timer so a quick state change can cancel it.
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleAdvance() {
    if (!isAutoPlay) return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      const s = stateRef.current;
      const spreads = Math.ceil(Math.max(0, s.totalPages - 1) / (s.isWide ? 2 : 1));
      if (s.showCover) {
        goNext();
      } else if (spreads > 0 && s.spread >= spreads - 1) {
        setIsAutoPlay(false);
        startFlip("prev", "cover-close", () => {
          setShowCover(true);
          setSpread(0);
        });
      } else {
        goNext();
      }
    }, POST_AUDIO_DWELL);
  }

  function onAudioEnded() {
    // Ignore the synthetic ended event fired by the zero-duration
    // silent WAV used to unlock the element on iOS.
    if (isUnlockingRef.current) return;
    if (audioQueueIndex < audioQueue.length - 1) {
      setAudioQueueIndex(audioQueueIndex + 1);
      return;
    }
    setAudioPlaying(false);
    scheduleAdvance();
  }

  function toggleAudio() {
    const el = audioRef.current;
    if (!audioOn) {
      // First-time turn-on: start playback from the current queue item.
      setAudioOn(true);
      return;
    }
    if (!el) return;
    if (audioPlaying) {
      el.pause();
      setAudioPlaying(false);
    } else if (el.src) {
      el.play().then(() => setAudioPlaying(true)).catch(() => {});
    } else {
      // Re-kick the fetch effect.
      setAudioQueueIndex(i => i);
    }
  }

  function stopAudio() {
    const el = audioRef.current;
    if (el) { el.pause(); el.currentTime = 0; }
    setAudioOn(false);
    setAudioPlaying(false);
  }

  // Early returns are placed AFTER every hook above so the hook order
  // never changes between renders.
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
            /* Single Read-Aloud control — turns narrator AND auto-flip
                on/off in one tap. Pressed-state when both are on. */
            <button
              onClick={() => {
                const bothOn = audioOn && isAutoPlay;
                if (bothOn) {
                  stopAudio();
                  setIsAutoPlay(false);
                } else {
                  // Synchronous in-gesture unlock so iOS Safari will
                  // let the flip sound and the narrator play later
                  // from setTimeout / 'ended' callbacks. Must happen
                  // before any await/Promise boundary.
                  unlockAudioElement(flipSoundRef.current);
                  unlockAudioElement(audioRef.current);
                  setAudioOn(true);
                  setIsAutoPlay(true);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                audioOn && isAutoPlay ? "bg-ink text-cream hover:bg-[#3a3a3a]" : "bg-[#EDEBE6] text-ink hover:bg-card-hover"
              }`}
              title={audioOn && isAutoPlay ? "Stop read-aloud" : "Start read-aloud (narrator + auto-flip)"}
            >
              {audioOn && isAutoPlay ? <Pause size={12} /> : <Play size={12} />}
              <span className="hidden sm:inline">{audioOn && isAutoPlay ? "Stop" : "Read-Aloud"}</span>
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
              className="relative select-none overflow-hidden"
              style={{
                ...containerStyle,
                boxShadow:
                  "0 30px 80px -20px rgba(0,0,0,0.4), 0 12px 24px -10px rgba(0,0,0,0.2)",
                borderRadius: 8,
                // Transparent: pages and cover bring their own
                // backgrounds, so any uncovered area of the container
                // (e.g. the left half during the cover-close
                // narrow-down) doesn't flash white.
                background: "transparent",
                transformStyle: "preserve-3d",
                transition:
                  "width 450ms cubic-bezier(0.32, 0.72, 0, 1) 80ms, height 450ms cubic-bezier(0.32, 0.72, 0, 1) 80ms",
              }}
            >
              {/* GHOST PAGE — transparent rectangle on the LEFT during
                  the cover view, outlined with a thin border so the
                  area reads as a defined "page slot" rather than a
                  blank-white page sitting next to the cover. Sized
                  to fill the gap between the container's left edge
                  and the cover (right:PAGE_W). As the container
                  narrows from spread → page width over the 450ms
                  reshape, this gap shrinks to zero, so the ghost
                  page implicitly fades out without its own opacity
                  animation. */}
              {showCover && !isFlipping && (
                <div
                  className="absolute top-0 bottom-0 rounded-[8px] pointer-events-none"
                  style={{
                    left: 0,
                    right: PAGE_W,
                    border: "1px solid rgba(180, 140, 100, 0.28)",
                    background: "transparent",
                  }}
                />
              )}

              {/* COVER closed — anchored to the right at PAGE_W so it
                  stays at its natural size as the container narrows
                  from spread (right after a cover-close flip) down to
                  page width. When the container has reached PAGE_W
                  it perfectly fills the frame. */}
              {showCover && !isFlipping && (
                <div
                  className="absolute top-0 bottom-0 overflow-hidden rounded-[8px]"
                  style={{ right: 0, width: PAGE_W }}
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
                      {/* Static right page (page 2) stays in place at
                          its natural PAGE_W width on the right of the
                          spread. The flipping element below will
                          land on top of it. */}
                      <div className="absolute top-0 bottom-0" style={{ right: 0, width: PAGE_W }}>
                        <PageInPanel pageIndex={currentPages.right} side="right" />
                      </div>
                      {/* Single-element flip on the LEFT half — page 1
                          rotates right around the spine, with the cover
                          on its back face. Same pattern as a normal
                          page-turn, just with the cover as the target,
                          so the close reads as a continuous book-page
                          motion rather than a separate animation. */}
                      <div
                        className="absolute top-0 bottom-0"
                        style={{
                          left: 0,
                          width: PAGE_W,
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
                          <PageInPanel pageIndex={currentPages.left} side="left" />
                        </div>
                        <div
                          className="flip-face back"
                          style={{ animation: `mobileFlipBackShow ${FLIP_DURATION}ms linear forwards` }}
                        >
                          <Cover />
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Mobile — single-element flip with cover on the
                       back face. Unchanged. */
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
                  Rendered any time we're past the cover EXCEPT during
                  a cover-close (the close has its own self-contained
                  static right page + flipping element; if this layer
                  rendered on top of it, it would cover the rotating
                  element and make the close visually instant).
                  During a page flip it shows the TARGET spread
                  underneath; during the static state it shows the
                  current spread. Since targetPages === currentPages
                  once the flip finishes, these PageInPanel components
                  keep the SAME pageIndex across the flip→static
                  transition — React doesn't unmount them, so the
                  browser never has to re-decode the page images. */}
              {!showCover && flipMode !== "cover-close" && (
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
              <button onClick={userGoPrev} disabled={showCover}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                style={{ background: "#FFB36B", color: "#fff" }}
                aria-label="Previous page">
                <ChevronLeft size={22} />
              </button>
              <button onClick={userGoNext} disabled={!showCover && spread >= totalSpreads - 1}
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
        {/* Narrator — hidden HTML5 audio element. Source is set by the
            queue/fetch effect; auto-advances through the queue on `ended`
            and stops when audioOn is toggled off. */}
        <audio
          ref={audioRef}
          onEnded={onAudioEnded}
          onPause={() => { if (!isUnlockingRef.current) setAudioPlaying(false); }}
          onPlay={() => { if (!isUnlockingRef.current) setAudioPlaying(true); }}
          preload="auto"
          style={{ display: "none" }}
        />
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
