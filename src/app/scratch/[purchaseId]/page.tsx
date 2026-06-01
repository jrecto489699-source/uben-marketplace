"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft, RotateCcw, Download, Maximize, Minimize,
  ChevronLeft, ChevronRight, BookOpen, Sparkles, ZoomIn, ZoomOut,
  Hand, Paintbrush,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { allProducts } from "@/data/products";

const CANVAS_W = 800;
const CANVAS_H = 1040;
const SCRATCHES_BUCKET = "scratches";

function dataURLtoBlob(dataURL: string): Blob {
  const [header, data] = dataURL.split(",");
  const mime = header.match(/:(.*?);/)![1];
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ── Page pair (two image URLs per page) ──────────────────────────────────────
interface PagePair {
  scratch: string; // black & white image (the coating)
  reveal:  string; // rainbow colored image (what's underneath)
}

// ── Confetti particle ─────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; life: number;
  rotation: number; rotSpeed: number;
}

// ── Image loader ──────────────────────────────────────────────────────────────
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// ── Draw image centered + scaled onto a canvas ────────────────────────────────
// Returns the bounds (in canvas pixels) where the image was drawn so callers
// can use it for scratch-percentage calculations.
function drawImageCentered(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const scale = Math.min(CANVAS_W / img.naturalWidth, CANVAS_H / img.naturalHeight);
  const dw = Math.round(img.naturalWidth  * scale);
  const dh = Math.round(img.naturalHeight * scale);
  const dx = Math.round((CANVAS_W - dw) / 2);
  const dy = Math.round((CANVAS_H - dh) / 2);
  ctx.drawImage(img, dx, dy, dw, dh);
  return { x: dx, y: dy, w: dw, h: dh };
}

export default function ScratchPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();
  const { user } = useAuth();
  const supabase = createClient();

  const purchase = purchases.find(p => p.id === purchaseId);
  const product  = purchase ? allProducts.find(p => p.id === purchase.product_id) : null;
  const cloudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Canvas refs ───────────────────────────────────────────────────────────
  // revealRef  = bottom: the colored "reveal" image (what gets uncovered)
  // scratchRef = top:    the black-and-white image (gets scratched away)
  const revealRef     = useRef<HTMLCanvasElement>(null);
  const scratchRef    = useRef<HTMLCanvasElement>(null);
  const confettiRef   = useRef<HTMLCanvasElement>(null);
  const cursorRef     = useRef<HTMLDivElement>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const lastPos              = useRef<{ x: number; y: number } | null>(null);
  const isDrawing            = useRef(false);
  const animRef              = useRef<number | null>(null);
  const particles            = useRef<Particle[]>([]);
  const pagePairs            = useRef<PagePair[]>([]);
  const loadedScratchImages  = useRef<Record<number, HTMLImageElement>>({});
  const loadedRevealImages   = useRef<Record<number, HTMLImageElement>>({});
  const currentPageRef       = useRef(0);
  // Bounds (x,y,w,h) of the image inside the canvas for the current page —
  // used so the scratch % only counts pixels that are actually image area,
  // not the black letterbox borders.
  const imageBoundsRef       = useRef<{ x: number; y: number; w: number; h: number }>({
    x: 0, y: 0, w: CANVAS_W, h: CANVAS_H,
  });

  const [brushSize,      setBrushSize]      = useState(4);
  const [scratchPct,     setScratchPct]     = useState(0);
  const [isRevealed,     setIsRevealed]     = useState(false);
  const [isAutoClearing, setIsAutoClearing] = useState(false);
  const [isFullscreen,   setIsFullscreen]   = useState(false);
  const [zoom,           setZoom]           = useState(1); // 0.5 = 50%, 1 = 100%, 2 = 200%
  const [tool,           setTool]           = useState<"scratch" | "pan">("scratch");
  const [isPanning,      setIsPanning]      = useState(false);
  const [panX,           setPanX]           = useState(0);
  const [panY,           setPanY]           = useState(0);

  // Refs for pan
  const viewportRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  const spaceHeld   = useRef(false);
  const prevToolRef = useRef<"scratch" | "pan">("scratch");
  const [imgLoading,     setImgLoading]     = useState(true);
  const [imgError,       setImgError]       = useState<string | null>(null);
  const [totalPages,     setTotalPages]     = useState(0);
  const [currentPage,    setCurrentPage]    = useState(0);
  const [thumbnails,     setThumbnails]     = useState<string[]>([]);
  const [pageLoading,    setPageLoading]    = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [cloudSaving,    setCloudSaving]    = useState(false);
  const [guideUrl,       setGuideUrl]       = useState<string | null>(null);

  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // Update guide preview URL when the page changes or pages load
  useEffect(() => {
    const url = pagePairs.current[currentPage]?.reveal ?? null;
    setGuideUrl(url);
  }, [currentPage, totalPages]);

  // ── Load images (cached per page) ─────────────────────────────────────────
  async function getScratchImage(pageIndex: number): Promise<HTMLImageElement | null> {
    if (loadedScratchImages.current[pageIndex]) return loadedScratchImages.current[pageIndex];
    const pair = pagePairs.current[pageIndex];
    if (!pair) return null;
    try {
      const img = await loadImage(pair.scratch);
      loadedScratchImages.current[pageIndex] = img;
      return img;
    } catch { return null; }
  }

  async function getRevealImage(pageIndex: number): Promise<HTMLImageElement | null> {
    if (loadedRevealImages.current[pageIndex]) return loadedRevealImages.current[pageIndex];
    const pair = pagePairs.current[pageIndex];
    if (!pair) return null;
    try {
      const img = await loadImage(pair.reveal);
      loadedRevealImages.current[pageIndex] = img;
      return img;
    } catch { return null; }
  }

  // ── Render reveal layer (the colored image) ──────────────────────────────
  async function renderRevealLayer(pageIndex: number) {
    const canvas = revealRef.current;
    if (!canvas) return;
    const img = await getRevealImage(pageIndex);
    if (!img) return;
    drawImageCentered(canvas.getContext("2d")!, img);
  }

  // ── Per-page storage keys/paths ───────────────────────────────────────────
  function localKey(pageIndex: number) {
    return `uben_scratch_${purchaseId}_${pageIndex}`;
  }
  function cloudPath(pageIndex: number) {
    return user ? `${user.id}/${purchaseId}/${pageIndex}.png` : null;
  }

  // ── Compute & cache the image bounds for a page ──────────────────────────
  async function computeBoundsForPage(pageIndex: number) {
    const img = await getScratchImage(pageIndex);
    if (!img) return;
    const scale = Math.min(CANVAS_W / img.naturalWidth, CANVAS_H / img.naturalHeight);
    const dw = Math.round(img.naturalWidth  * scale);
    const dh = Math.round(img.naturalHeight * scale);
    const dx = Math.round((CANVAS_W - dw) / 2);
    const dy = Math.round((CANVAS_H - dh) / 2);
    imageBoundsRef.current = { x: dx, y: dy, w: dw, h: dh };
  }

  // ── Render scratch coating layer ──────────────────────────────────────────
  // 1. Try Supabase Storage (cross-device) → 2. localStorage → 3. fresh B&W
  async function renderScratchLayer(pageIndex: number) {
    const canvas = scratchRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    // Always update bounds for this page first (used by percentage calc)
    await computeBoundsForPage(pageIndex);

    // 1. Cloud
    const path = cloudPath(pageIndex);
    if (path) {
      try {
        const { data: blob } = await supabase.storage.from(SCRATCHES_BUCKET).download(path);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const savedImg = await loadImage(url);
          ctx.globalCompositeOperation = "source-over";
          ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
          ctx.drawImage(savedImg, 0, 0);
          URL.revokeObjectURL(url);
          canvas.style.opacity = "1";
          // Mirror to localStorage for offline reload
          try { localStorage.setItem(localKey(pageIndex), canvas.toDataURL("image/png")); } catch {}
          return;
        }
      } catch {}
    }

    // 2. localStorage
    try {
      const saved = localStorage.getItem(localKey(pageIndex));
      if (saved) {
        const savedImg = await loadImage(saved);
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(savedImg, 0, 0);
        canvas.style.opacity = "1";
        return;
      }
    } catch {}

    // 3. Fresh B&W image
    const img = await getScratchImage(pageIndex);
    if (!img) return;
    imageBoundsRef.current = drawImageCentered(ctx, img);
    canvas.style.opacity = "1";
  }

  // ── Save scratch state ────────────────────────────────────────────────────
  // Immediate local save + debounced cloud upload (3 s after last stroke)
  function saveScratchState() {
    const canvas = scratchRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL("image/png");
    const pg = currentPageRef.current;

    try { localStorage.setItem(localKey(pg), dataURL); } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    const path = cloudPath(pg);
    if (!path) return;
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    cloudTimerRef.current = setTimeout(async () => {
      setCloudSaving(true);
      try {
        await supabase.storage.from(SCRATCHES_BUCKET).upload(path, dataURLtoBlob(dataURL), {
          upsert: true,
          contentType: "image/png",
        });
      } finally {
        setCloudSaving(false);
      }
    }, 3000);
  }

  // ── Load page list ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!purchase?.id) return;
    async function load() {
      setImgLoading(true); setImgError(null);
      try {
        const res = await fetch(`/api/scratch-images/${purchase!.id}`, { credentials: "include", cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setImgError(body.error ?? "Scratch images not available yet");
          setImgLoading(false); return;
        }
        const { pages, total } = await res.json();
        pagePairs.current = pages;
        setTotalPages(total);
        await Promise.all([renderRevealLayer(0), renderScratchLayer(0)]);
        setImgLoading(false);
        // Compute scratch % from restored state (if any)
        const pct = computeScratchPct();
        setScratchPct(pct);
        setIsRevealed(pct >= 95);
        buildThumbnails();
      } catch {
        setImgError("Failed to load scratch images");
        setImgLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase?.id, user?.id]);

  // ── Build thumbnails from scratch (B&W) images ───────────────────────────
  async function buildThumbnails() {
    const result: string[] = [];
    for (let i = 0; i < pagePairs.current.length; i++) {
      try {
        const img = await getScratchImage(i);
        if (!img) { result.push(""); setThumbnails([...result]); continue; }
        const c = document.createElement("canvas");
        const scale = 120 / img.naturalWidth;
        c.width  = Math.round(img.naturalWidth  * scale);
        c.height = Math.round(img.naturalHeight * scale);
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height);
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
    setCurrentPage(newPage);
    await Promise.all([renderRevealLayer(newPage), renderScratchLayer(newPage)]);
    setPageLoading(false);
    // Restore progress from saved state on the new page
    const pct = computeScratchPct();
    setScratchPct(pct);
    setIsRevealed(pct >= 95);
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

  // ── Zoom helpers ──────────────────────────────────────────────────────────
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2;
  function zoomIn()    { setZoom(z => Math.min(MAX_ZOOM, parseFloat((z + 0.25).toFixed(2)))); }
  function zoomOut()   { setZoom(z => Math.max(MIN_ZOOM, parseFloat((z - 0.25).toFixed(2)))); }
  function zoomReset() { setZoom(1); setPanX(0); setPanY(0); }

  // Auto-fit zoom on mobile so the whole scratch page fits the screen width
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vw = window.innerWidth;
    if (vw < 680) {
      const fit = Math.max(MIN_ZOOM, parseFloat(((vw - 32) / 680).toFixed(2)));
      setZoom(fit);
    }
  }, []);

  // Arrow keys + Space (hold for temporary pan)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "ArrowRight") { e.preventDefault(); nextPage(); return; }
      if (e.code === "ArrowLeft")  { e.preventDefault(); prevPage(); return; }
      if (e.code === "Space" && !e.repeat && !spaceHeld.current) {
        // Avoid hijacking Space when typing in an input
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        spaceHeld.current = true;
        setTool(curr => {
          if (curr !== "pan") prevToolRef.current = curr;
          return "pan";
        });
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceHeld.current = false;
        setTool(prevToolRef.current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
    };
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

  // ── Scratch stroke (hard-edged line, like a real coin/stylus) ─────────────
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

  // ── Compute scratch % (only over the image bounds, not full canvas) ─────
  function computeScratchPct(): number {
    const ctx = scratchRef.current?.getContext("2d");
    if (!ctx) return 0;
    const { x, y, w, h } = imageBoundsRef.current;
    if (w <= 0 || h <= 0) return 0;
    const data = ctx.getImageData(x, y, w, h).data;
    let transparent = 0;
    const step = 4, total = (w * h) / step;
    for (let i = 3; i < data.length; i += 4 * step) { if (data[i] < 128) transparent++; }
    return Math.min(Math.round((transparent / total) * 100), 100);
  }

  // ── Check scratch % + maybe trigger auto-clear ────────────────────────────
  function checkPercent() {
    const pct = computeScratchPct();
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
    saveScratchState(); // persist fully-revealed state
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
  function getClientXY(e: React.MouseEvent | React.TouchEvent) {
    if ("touches" in e) {
      const t = (e as React.TouchEvent).touches[0] || (e as React.TouchEvent).changedTouches[0];
      return t ? { clientX: t.clientX, clientY: t.clientY } : null;
    }
    const me = e as React.MouseEvent;
    return { clientX: me.clientX, clientY: me.clientY };
  }

  const onPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isAutoClearing || imgLoading || !!imgError) return;
    e.preventDefault();

    // Pan tool: start translating the canvas
    if (tool === "pan") {
      const xy = getClientXY(e);
      if (!xy) return;
      panStartRef.current = {
        clientX: xy.clientX, clientY: xy.clientY,
        panX, panY,
      };
      setIsPanning(true);
      return;
    }

    if (isRevealed) return;
    isDrawing.current = true;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent);
    if (!pos) return;
    scratchDot(pos, brushSize);
    lastPos.current = pos;
    navigator.vibrate?.(5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing, imgLoading, imgError, brushSize, tool]);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isAutoClearing) return;
    e.preventDefault();

    // Pan: translate the canvas freely
    if (tool === "pan" && panStartRef.current) {
      const xy = getClientXY(e);
      if (!xy) return;
      const dx = xy.clientX - panStartRef.current.clientX;
      const dy = xy.clientY - panStartRef.current.clientY;
      setPanX(panStartRef.current.panX + dx);
      setPanY(panStartRef.current.panY + dy);
      return;
    }

    if (isRevealed) return;
    // Update cursor ring position. The cursor is position: fixed outside
    // the zoom-transformed wrapper, so clientX/clientY map directly to
    // its screen position regardless of zoom or pan.
    if (!("touches" in e) && cursorRef.current) {
      cursorRef.current.style.display = "block";
      cursorRef.current.style.left = e.clientX + "px";
      cursorRef.current.style.top  = e.clientY + "px";
    }

    if (!isDrawing.current) return;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent);
    if (!pos) return;
    if (lastPos.current) scratchStroke(lastPos.current, pos, brushSize);
    lastPos.current = pos;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing, brushSize, tool]);

  const onPointerEnter = useCallback(() => {
    if (tool === "scratch" && cursorRef.current) cursorRef.current.style.display = "block";
  }, [tool]);

  const onPointerLeave = useCallback(() => {
    if (cursorRef.current) cursorRef.current.style.display = "none";
    if (tool === "pan" || panStartRef.current) {
      panStartRef.current = null;
      setIsPanning(false);
      return;
    }
    if (isDrawing.current) {
      isDrawing.current = false; lastPos.current = null;
      checkPercent();
      saveScratchState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing, tool]);

  const onPointerUp = useCallback(() => {
    if (tool === "pan" || panStartRef.current) {
      panStartRef.current = null;
      setIsPanning(false);
      return;
    }
    if (!isDrawing.current) return;
    isDrawing.current = false; lastPos.current = null;
    checkPercent();
    saveScratchState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed, isAutoClearing, tool]);

  // ── Reset current page ────────────────────────────────────────────────────
  async function reset() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    particles.current = [];
    confettiRef.current?.getContext("2d")?.clearRect(0, 0, CANVAS_W, CANVAS_H);
    // Clear saved state (local + cloud) so renderScratchLayer draws the fresh B&W image
    const pg = currentPageRef.current;
    try { localStorage.removeItem(localKey(pg)); } catch {}
    const path = cloudPath(pg);
    if (path) {
      supabase.storage.from(SCRATCHES_BUCKET).remove([path]).catch(() => {});
    }
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    const canvas = scratchRef.current;
    if (canvas) {
      const img = await getScratchImage(currentPageRef.current);
      if (img) {
        drawImageCentered(canvas.getContext("2d")!, img);
        canvas.style.opacity = "1";
      }
    }
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
      <main
        className="bg-[#EDEBE6] flex flex-col"
        style={{
          height: isFullscreen ? "100dvh" : "calc(100dvh - 64px)",
          ...(isFullscreen ? { position: "fixed", inset: 0, zIndex: 50 } : {}),
        }}>

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

          <span className={`text-[11px] shrink-0 transition-opacity duration-300 ${cloudSaving ? "opacity-100 text-ink-muted" : saved ? "opacity-100 text-[#258635]" : "opacity-0"}`}>
            {cloudSaving ? "Syncing…" : "Saved"}
          </span>

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

            {/* Color guide — always visible in sidebar */}
            {!imgLoading && !imgError && guideUrl && (
              <div>
                <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Color Guide</p>
                <div className="relative rounded-xl overflow-hidden border border-border-muted bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={guideUrl}
                    alt="Color guide"
                    className="w-full h-auto block"
                    style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}`, objectFit: "contain" }}
                  />
                </div>
                <p className="text-[10px] text-ink-muted mt-1.5 text-center">What you&apos;re scratching for</p>
              </div>
            )}

            {/* Tool — Scratch / Pan(Space) */}
            <div>
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Tool</p>
              <div className="flex flex-col gap-1">
                {([
                  { id: "scratch" as const, Icon: Paintbrush, label: "Brush" },
                  { id: "pan"     as const, Icon: Hand,       label: "Pan  (Space)" },
                ]).map(({ id, Icon, label }) => (
                  <button key={id}
                    onClick={() => { prevToolRef.current = id !== "pan" ? id : prevToolRef.current; setTool(id); }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                      tool === id ? "bg-ink text-cream" : "text-ink hover:bg-[#EDEBE6]"
                    }`}>
                    <Icon size={14} />{label}
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
                className="w-full cursor-pointer" style={{ accentColor: "#222" }} />
            </div>

            <div>
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">
                Zoom — {Math.round(zoom * 100)}%
              </p>
              <div className="flex items-center gap-1 bg-[#EDEBE6] rounded-full px-1 py-1 mb-2">
                <button onClick={zoomOut} disabled={zoom <= MIN_ZOOM}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white transition-colors disabled:opacity-40">
                  <ZoomOut size={13} />
                </button>
                <button onClick={zoomReset}
                  className="flex-1 text-[11px] font-semibold text-ink text-center hover:text-ink-muted transition-colors tabular-nums">
                  {Math.round(zoom * 100)}%
                </button>
                <button onClick={zoomIn} disabled={zoom >= MAX_ZOOM}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white transition-colors disabled:opacity-40">
                  <ZoomIn size={13} />
                </button>
              </div>
              <div className="flex gap-2">
                {[{ label: "50%", val: 0.5 }, { label: "100%", val: 1 }].map(z => (
                  <button key={z.val} onClick={() => setZoom(z.val)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      zoom === z.val ? "bg-ink text-cream" : "bg-[#EDEBE6] text-ink hover:bg-card-hover"
                    }`}>{z.label}
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
                  : "Scratch the white lines to reveal the hidden artwork underneath!"}
              </p>
            </div>
          </aside>

          {/* ── Canvas area ──────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">

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

            {!imgLoading && imgError && (
              <div className="absolute inset-0 z-20 flex items-center justify-center px-6" style={{ background: "#EDEBE6" }}>
                <div className="text-center max-w-sm">
                  <Sparkles size={40} strokeWidth={1.2} className="text-ink-muted mx-auto mb-4" />
                  <p className="font-serif text-xl text-ink mb-2">Scratch pages coming soon</p>
                  <p className="text-sm text-ink-muted">The interactive scratch book for this product is being prepared. Check back soon!</p>
                </div>
              </div>
            )}

            <div className="flex-1 relative overflow-hidden min-h-0">
              <div ref={viewportRef} className="absolute inset-0 overflow-auto" style={{ background: "#EDEBE6" }}>
                <div className="min-h-full min-w-full flex items-center justify-center p-2">
                {/* Outer wrapper takes the SCALED size so flex centering
                    works correctly. Inner div uses transform-origin top-left
                    so it occupies the same area as the outer wrapper. */}
                <div style={{
                  width:  Math.round(680 * zoom),
                  height: Math.round(680 * (CANVAS_H / CANVAS_W) * zoom),
                  flexShrink: 0,
                  transition: "width 0.12s ease-out, height 0.12s ease-out",
                }}>
                <div style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                  transformOrigin: "top left",
                  transition: isPanning ? "none" : "transform 0.12s ease-out",
                }}>
                <div className="relative rounded-2xl overflow-hidden shadow-lg select-none"
                  style={{ width: 680, height: Math.round(680 * (CANVAS_H / CANVAS_W)) }}>

                  {pageLoading && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 rounded-2xl">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {/* Layer 1 — Reveal (colored image) */}
                  <canvas ref={revealRef} width={CANVAS_W} height={CANVAS_H}
                    className="absolute inset-0 w-full h-full" />

                  {/* Layer 2 — Scratch coating (B&W image) */}
                  <canvas ref={scratchRef} width={CANVAS_W} height={CANVAS_H}
                    className="absolute inset-0 w-full h-full"
                    style={{
                      cursor: tool === "pan" ? (isPanning ? "grabbing" : "grab") : (isRevealed ? "default" : "none"),
                      touchAction: "none",
                    }}
                    onMouseDown={onPointerDown} onMouseMove={onPointerMove}
                    onMouseUp={onPointerUp}    onMouseLeave={onPointerLeave}
                    onMouseEnter={onPointerEnter}
                    onTouchStart={onPointerDown} onTouchMove={onPointerMove}
                    onTouchEnd={onPointerUp} />

                  {/* Layer 3 — Confetti */}
                  <canvas ref={confettiRef} width={CANVAS_W} height={CANVAS_H}
                    className="absolute inset-0 w-full h-full pointer-events-none" />

                  {!imgLoading && !imgError && scratchPct === 0 && !isRevealed && (
                    <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none">
                      <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                        <Sparkles size={13} className="text-white/70" />
                        <p className="text-white/70 text-xs font-medium">Scratch to reveal!</p>
                      </div>
                    </div>
                  )}

                </div>
                </div>
                </div>
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
          {/* Tool buttons (mobile) */}
          {([
            { id: "scratch" as const, Icon: Paintbrush },
            { id: "pan"     as const, Icon: Hand },
          ]).map(({ id, Icon }) => (
            <button key={id} onClick={() => setTool(id)}
              className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors ${
                tool === id ? "bg-ink text-cream" : "bg-[#EDEBE6] text-ink"
              }`}>
              <Icon size={15} />
            </button>
          ))}
          <div className="w-px h-6 bg-border-muted shrink-0 mx-0.5" />
          {/* Brush size pill (mobile) */}
          <div className="flex items-center gap-1 bg-[#EDEBE6] rounded-full px-2 py-1 shrink-0">
            <input
              type="range" min={2} max={20} value={brushSize}
              onChange={e => setBrushSize(Number(e.target.value))}
              className="cursor-pointer w-20" style={{ accentColor: "#222" }}
              aria-label="Brush size"
            />
            <span className="text-[10px] font-semibold text-ink-muted w-6 text-center tabular-nums">{brushSize}</span>
          </div>
          <div className="w-px h-6 bg-border-muted shrink-0 mx-0.5" />

          {/* Zoom pill (mobile) */}
          <div className="flex items-center gap-1 bg-[#EDEBE6] rounded-full px-1 py-1 shrink-0">
            <button onClick={zoomOut} disabled={zoom <= MIN_ZOOM}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white transition-colors disabled:opacity-40">
              <ZoomOut size={13} />
            </button>
            <button onClick={zoomReset}
              className="text-[11px] font-semibold text-ink w-10 text-center hover:text-ink-muted transition-colors tabular-nums">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={zoomIn} disabled={zoom >= MAX_ZOOM}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white transition-colors disabled:opacity-40">
              <ZoomIn size={13} />
            </button>
          </div>
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

      {/* Brush cursor — fixed to the viewport so zoom doesn't affect its
          screen position or size. Shown only when the brush tool is active. */}
      {!isRevealed && !imgLoading && !imgError && tool === "scratch" && (
        <div ref={cursorRef}
          className="fixed pointer-events-none rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{
            // visual diameter = brushSize × 2 × display-ratio × zoom
            // display-ratio = displayed canvas width / canvas internal width = 680 / 800
            width:  brushSize * 2 * (680 / CANVAS_W) * zoom,
            height: brushSize * 2 * (680 / CANVAS_W) * zoom,
            border: "1.5px solid rgba(255,255,255,0.9)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.6)",
            display: "none",
            zIndex: 100,
          }} />
      )}
    </>
  );
}
