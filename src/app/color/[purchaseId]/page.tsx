"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import {
  Paintbrush, Droplets, Eraser, Hand, Undo2, Redo2, Trash2, Download,
  ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus, ZoomIn, ZoomOut,
  Maximize, Minimize, BookOpen,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { allProducts } from "@/data/products";

const DRAWINGS_BUCKET = "colorings";
const CANVAS_W = 800;
const CANVAS_H = 1040; // Portrait — fits standard coloring book pages
const MAX_HISTORY = 15;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

type Tool = "brush" | "fill" | "eraser" | "pan";

// Lazy-load PDF.js to avoid SSR issues
let _pdfjsLib: typeof import("pdfjs-dist") | null = null;
async function getPdfJs() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import("pdfjs-dist");
    _pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return _pdfjsLib;
}

function dataURLtoBlob(dataURL: string): Blob {
  const [header, data] = dataURL.split(",");
  const mime = header.match(/:(.*?);/)![1];
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

const PALETTE = [
  "#FFFFFF", "#111111", "#EF4444", "#F97316", "#F59E0B", "#22C55E",
  "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899", "#F9A8D4", "#FCA5A5",
  "#86EFAC", "#67E8F9", "#93C5FD", "#C4B5FD", "#D6D3D1", "#78716C",
  "#7C2D12", "#1E40AF",
];

export default function ColorPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();
  const { user } = useAuth();
  const supabase = createClient();

  const purchase = purchases.find((p) => p.id === purchaseId);
  const product  = purchase ? allProducts.find((p) => p.id === purchase.product_id) : null;

  // ── Canvas / overlay refs ─────────────────────────────────────────────────
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const overlayRef     = useRef<HTMLCanvasElement>(null);
  const viewportRef    = useRef<HTMLDivElement>(null);
  const cursorRef      = useRef<HTMLDivElement>(null);
  const thumbStripRef  = useRef<HTMLDivElement>(null);

  // ── Drawing refs ──────────────────────────────────────────────────────────
  const lastPos       = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef  = useRef(false);
  const historyRef    = useRef<ImageData[]>([]);
  const redoRef       = useRef<ImageData[]>([]);
  const zoomRef       = useRef(1);
  const spaceHeld     = useRef(false);
  const prevToolRef   = useRef<Tool>("brush");
  const panStartRef   = useRef<{ clientX: number; clientY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const cloudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  // ── Per-page state ────────────────────────────────────────────────────────
  const pageDrawingsRef  = useRef<Record<number, ImageData>>({});
  const pageHistoriesRef = useRef<Record<number, ImageData[]>>({});
  const pageRedosRef     = useRef<Record<number, ImageData[]>>({});
  const currentPageRef   = useRef(0); // kept in sync with state for async callbacks

  // ── PDF state ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef   = useRef<any>(null);
  const [totalPages,  setTotalPages]  = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [thumbnails,  setThumbnails]  = useState<string[]>([]);
  const [pdfLoading,  setPdfLoading]  = useState(true);
  const [pdfError,    setPdfError]    = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [tool,          setTool]          = useState<Tool>("brush");
  const [color,         setColor]         = useState("#EF4444");
  const [brushSize,     setBrushSize]     = useState(14);
  const [canUndo,       setCanUndo]       = useState(false);
  const [canRedo,       setCanRedo]       = useState(false);
  const [imageLoaded,   setImageLoaded]   = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [cloudSaving,   setCloudSaving]   = useState(false);
  const [zoom,          setZoom]          = useState(1);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [isPanning,     setIsPanning]     = useState(false);

  // Keep refs in sync
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // ── Render a PDF page to the overlay canvas ───────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function renderPageToOverlay(doc: any, pageIndex: number) {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const page = await doc.getPage(pageIndex + 1);
    const natural = page.getViewport({ scale: 1 });
    const scale = Math.min(CANVAS_W / natural.width, CANVAS_H / natural.height);
    const vp = page.getViewport({ scale });
    const tmp = document.createElement("canvas");
    tmp.width  = Math.round(vp.width);
    tmp.height = Math.round(vp.height);
    await page.render({ canvasContext: tmp.getContext("2d")!, viewport: vp }).promise;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Enhance lines: boost contrast to make outlines crisp black and
    // background clean white. saturate(0) removes any color tint from the PDF.
    ctx.filter = "saturate(0) contrast(2) brightness(1.1)";
    ctx.drawImage(tmp, Math.round((CANVAS_W - tmp.width) / 2), Math.round((CANVAS_H - tmp.height) / 2));
    ctx.filter = "none";
  }

  // ── Render thumbnails for all pages (runs in background) ─────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function renderThumbnails(doc: any) {
    const result: string[] = [];
    for (let i = 0; i < doc.numPages; i++) {
      const page = await doc.getPage(i + 1);
      const natural = page.getViewport({ scale: 1 });
      const scale = 120 / natural.width;
      const vp = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width  = Math.round(vp.width);
      c.height = Math.round(vp.height);
      await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      result.push(c.toDataURL("image/jpeg", 0.7));
      setThumbnails([...result]);
    }
  }

  // ── Load drawing for a page (cloud → localStorage → blank) ───────────────
  async function loadPageDrawing(pageIndex: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const localKey   = `uben_coloring_${purchaseId}_${pageIndex}`;
    const cloudPath  = user ? `${user.id}/${purchaseId}/${pageIndex}.png` : null;

    if (cloudPath) {
      const { data: blob } = await supabase.storage.from(DRAWINGS_BUCKET).download(cloudPath);
      if (blob) {
        const url = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url); resolve(); };
          img.src = url;
        });
        pageDrawingsRef.current[pageIndex] = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        try { localStorage.setItem(localKey, canvas.toDataURL("image/png")); } catch {}
        return;
      }
    }
    const local = localStorage.getItem(localKey);
    if (local) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0); resolve(); };
        img.src = local;
      });
      pageDrawingsRef.current[pageIndex] = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      return;
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Warm up PDF.js the moment the component mounts so the dynamic import
  // is ready by the time purchase data arrives.
  useEffect(() => { getPdfJs(); }, []);

  // ── Load PDF ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!purchase?.id) return;
    async function loadPdf() {
      setPdfLoading(true);
      setPdfError(null);
      try {
        // Kick off both the signed-URL fetch and PDF.js warm-up in parallel
        const [res, lib] = await Promise.all([
          fetch(`/api/coloring-pdf/${purchase!.id}`),
          getPdfJs(),
        ]);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setPdfError(body.error ?? "Coloring PDF not available yet");
          setPdfLoading(false);
          return;
        }
        const { url } = await res.json();
        // Range requests: PDF.js fetches only what it needs per page
        // instead of downloading the entire file up front.
        const doc = await lib.getDocument({
          url,
          rangeChunkSize: 65536,   // 64 KB chunks
          disableAutoFetch: true,  // don't pre-fetch the whole file
          disableStream: false,
        }).promise;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        // Render first page overlay
        await renderPageToOverlay(doc, 0);
        setImageLoaded(true);
        setPdfLoading(false);
        // Load drawing for page 0 then render thumbnails in background
        await loadPageDrawing(0);
        renderThumbnails(doc);
      } catch {
        setPdfError("Failed to load coloring book");
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

    // Save current page
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      pageDrawingsRef.current[currentPageRef.current] = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    }
    pageHistoriesRef.current[currentPageRef.current] = [...historyRef.current];
    pageRedosRef.current[currentPageRef.current]     = [...redoRef.current];

    setCurrentPage(newPage);
    setImageLoaded(false);

    // Render new overlay
    await renderPageToOverlay(doc, newPage);
    setImageLoaded(true);

    // Restore or load drawing
    const drawCtx = canvasRef.current?.getContext("2d");
    if (drawCtx && canvasRef.current) {
      drawCtx.fillStyle = "#FFFFFF";
      drawCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const cached = pageDrawingsRef.current[newPage];
      if (cached) {
        drawCtx.putImageData(cached, 0, 0);
      } else {
        await loadPageDrawing(newPage);
      }
    }

    // Restore history/redo
    historyRef.current = pageHistoriesRef.current[newPage] ?? [];
    redoRef.current    = pageRedosRef.current[newPage]     ?? [];
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(redoRef.current.length > 0);

    setPageLoading(false);

    // Scroll thumbnail into view
    setTimeout(() => {
      const strip = thumbStripRef.current;
      if (!strip) return;
      const thumb = strip.children[newPage] as HTMLElement;
      if (thumb) thumb.scrollIntoView({ inline: "center", behavior: "smooth" });
    }, 50);
  }

  function nextPage() { switchPage(currentPage + 1); }
  function prevPage() { switchPage(currentPage - 1); }

  // ── Fullscreen ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }

  // ── Mouse-wheel zoom ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parseFloat((z + delta).toFixed(2)))));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function zoomIn()    { setZoom((z) => Math.min(MAX_ZOOM, parseFloat((z + ZOOM_STEP).toFixed(2)))); }
  function zoomOut()   { setZoom((z) => Math.max(MIN_ZOOM, parseFloat((z - ZOOM_STEP).toFixed(2)))); }
  function zoomReset() { setZoom(1); }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (e.code === "ArrowRight" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); nextPage(); return; }
      if (e.code === "ArrowLeft"  && !e.ctrlKey && !e.metaKey) { e.preventDefault(); prevPage(); return; }
      if (e.code === "Space" && !e.repeat && !spaceHeld.current) {
        e.preventDefault();
        spaceHeld.current = true;
        setTool((c) => { if (c !== "pan") prevToolRef.current = c; return "pan"; });
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") { spaceHeld.current = false; setTool(prevToolRef.current); }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, totalPages]);

  // ── Coordinate helpers ────────────────────────────────────────────────────
  function getCanvasPos(e: MouseEvent | TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    if ("touches" in e) {
      const t = (e as TouchEvent).touches[0] || (e as TouchEvent).changedTouches[0];
      if (!t) return null;
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    const me = e as MouseEvent;
    return { x: (me.clientX - rect.left) * scaleX, y: (me.clientY - rect.top) * scaleY };
  }

  function getClientXY(e: React.MouseEvent | React.TouchEvent) {
    if ("touches" in e) {
      const t = (e as React.TouchEvent).touches[0] || (e as React.TouchEvent).changedTouches[0];
      return t ? { clientX: t.clientX, clientY: t.clientY } : null;
    }
    const me = e as React.MouseEvent;
    return { clientX: me.clientX, clientY: me.clientY };
  }

  // ── History ───────────────────────────────────────────────────────────────
  function saveHistory() {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    if (historyRef.current.length >= MAX_HISTORY) historyRef.current.shift();
    historyRef.current.push(snap);
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function undo() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const snap = historyRef.current.pop();
    if (!snap || !ctx || !canvas) return;
    redoRef.current.push(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
    ctx.putImageData(snap, 0, 0);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
  }

  function redo() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const snap = redoRef.current.pop();
    if (!snap || !ctx || !canvas) return;
    historyRef.current.push(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
    ctx.putImageData(snap, 0, 0);
    setCanRedo(redoRef.current.length > 0);
    setCanUndo(true);
  }

  // ── Flood fill ────────────────────────────────────────────────────────────
  function floodFill(startX: number, startY: number) {
    const canvas  = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const d = imageData.data;
    let od: Uint8ClampedArray | null = null;
    if (overlay) { const oc = overlay.getContext("2d"); if (oc) od = oc.getImageData(0, 0, CANVAS_W, CANVAS_H).data; }
    const xi = Math.floor(startX), yi = Math.floor(startY);
    if (xi < 0 || xi >= CANVAS_W || yi < 0 || yi >= CANVAS_H) return;
    const px = (yi * CANVAS_W + xi) * 4;
    const tR = d[px], tG = d[px + 1], tB = d[px + 2];
    const fR = parseInt(color.slice(1, 3), 16);
    const fG = parseInt(color.slice(3, 5), 16);
    const fB = parseInt(color.slice(5, 7), 16);
    if (tR === fR && tG === fG && tB === fB) return;
    const tol = 28;
    const visited = new Uint8Array(CANVAS_W * CANVAS_H);
    const match  = (i: number) => Math.abs(d[i] - tR) <= tol && Math.abs(d[i+1] - tG) <= tol && Math.abs(d[i+2] - tB) <= tol;
    const isLine = (pos: number) => od != null && od[pos * 4] < 100 && od[pos * 4 + 3] > 128;
    const stack = [xi + yi * CANVAS_W];
    while (stack.length > 0) {
      const pos = stack.pop()!;
      if (visited[pos]) continue;
      const x = pos % CANVAS_W, y = (pos - x) / CANVAS_W;
      if (x < 0 || x >= CANVAS_W || y < 0 || y >= CANVAS_H) continue;
      const i = pos * 4;
      if (!match(i) || isLine(pos)) continue;
      visited[pos] = 1;
      d[i] = fR; d[i+1] = fG; d[i+2] = fB; d[i+3] = 255;
      if (x + 1 < CANVAS_W) stack.push(pos + 1);
      if (x - 1 >= 0)       stack.push(pos - 1);
      if (y + 1 < CANVAS_H) stack.push(pos + CANVAS_W);
      if (y - 1 >= 0)       stack.push(pos - CANVAS_W);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // ── Drawing primitives ────────────────────────────────────────────────────
  function drawLine(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const size = tool === "eraser" ? brushSize * 2.5 : brushSize;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = tool === "eraser" ? "#FFFFFF" : color;
    ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke();
  }

  function drawDot(pos: { x: number; y: number }) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const size = tool === "eraser" ? brushSize * 2.5 : brushSize;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === "eraser" ? "#FFFFFF" : color;
    ctx.fill();
  }

  // ── Pointer handlers ──────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (tool === "pan") {
        const xy = getClientXY(e);
        const vp = viewportRef.current;
        if (!xy || !vp) return;
        panStartRef.current = { clientX: xy.clientX, clientY: xy.clientY, scrollLeft: vp.scrollLeft, scrollTop: vp.scrollTop };
        setIsPanning(true);
        return;
      }
      const pos = getCanvasPos(e.nativeEvent as MouseEvent | TouchEvent);
      if (!pos) return;
      if (tool === "fill") { saveHistory(); floodFill(pos.x, pos.y); autoSave(); return; }
      saveHistory(); isDrawingRef.current = true; lastPos.current = pos; drawDot(pos);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, color, brushSize]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (tool === "pan" && panStartRef.current && viewportRef.current) {
        const xy = getClientXY(e);
        if (!xy) return;
        viewportRef.current.scrollLeft = panStartRef.current.scrollLeft - (xy.clientX - panStartRef.current.clientX);
        viewportRef.current.scrollTop  = panStartRef.current.scrollTop  - (xy.clientY - panStartRef.current.clientY);
        return;
      }
      const canvas = canvasRef.current;
      if (canvas && cursorRef.current) {
        const rect = canvas.getBoundingClientRect();
        const xy = getClientXY(e);
        if (xy) {
          const z = zoomRef.current;
          cursorRef.current.style.left = (xy.clientX - rect.left) / z + "px";
          cursorRef.current.style.top  = (xy.clientY - rect.top)  / z + "px";
        }
      }
      if (!isDrawingRef.current) return;
      const pos = getCanvasPos(e.nativeEvent as MouseEvent | TouchEvent);
      if (!pos) return;
      if (lastPos.current) drawLine(lastPos.current, pos);
      lastPos.current = pos;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, color, brushSize]
  );

  function handlePointerUp() {
    if (tool === "pan" || panStartRef.current) { panStartRef.current = null; setIsPanning(false); return; }
    if (isDrawingRef.current) { isDrawingRef.current = false; lastPos.current = null; autoSave(); }
  }

  // ── Touch swipe for page navigation ──────────────────────────────────────
  // Only swipe when NOT drawing (tool is pan, or no drawing in progress)
  function handleTouchStartNav(e: React.TouchEvent) {
    if (tool !== "pan") return; // only allow swipe when in pan mode
    touchStartXRef.current = e.touches[0].clientX;
  }
  function handleTouchEndNav(e: React.TouchEvent) {
    if (touchStartXRef.current === null || tool !== "pan") return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (diff > 60) nextPage();
    else if (diff < -60) prevPage();
    touchStartXRef.current = null;
  }

  // ── Auto-save ─────────────────────────────────────────────────────────────
  function autoSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL("image/png");
    const pg = currentPageRef.current;
    const localKey  = `uben_coloring_${purchaseId}_${pg}`;
    const cloudPath = user ? `${user.id}/${purchaseId}/${pg}.png` : null;
    try { localStorage.setItem(localKey, dataURL); } catch {}
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    if (!cloudPath) return;
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    cloudTimerRef.current = setTimeout(async () => {
      setCloudSaving(true);
      try {
        await supabase.storage.from(DRAWINGS_BUCKET).upload(cloudPath, dataURLtoBlob(dataURL), { upsert: true, contentType: "image/png" });
      } finally { setCloudSaving(false); }
    }, 3000);
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    saveHistory();
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    autoSave();
  }

  function downloadPNG() {
    const drawing = canvasRef.current;
    const overlay = overlayRef.current;
    if (!drawing || !overlay) return;
    const out = document.createElement("canvas");
    out.width = CANVAS_W; out.height = CANVAS_H;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(drawing, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(overlay, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    const a = document.createElement("a");
    a.download = `${product?.title ?? "coloring"}-page${currentPage + 1}.png`;
    a.href = out.toDataURL("image/png");
    a.click();
  }

  const adjustBrushSize = (delta: number) => setBrushSize((s) => Math.max(2, Math.min(48, s + delta)));
  const canvasCursor = tool === "pan" ? (isPanning ? "grabbing" : "grab") : tool === "fill" ? "crosshair" : "none";
  const displaySize = tool === "eraser" ? brushSize * 2.5 : brushSize;

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
            <p className="text-sm text-ink-muted mb-6">You need to purchase this product to color it.</p>
            <a href="/downloads" className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-medium hover:bg-[#3a3a3a] transition-colors duration-200">My Library</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {!isFullscreen && <Navbar />}
      <main className="bg-[#EDEBE6] flex flex-col" style={{ height: isFullscreen ? "100vh" : "calc(100vh - 64px)" }}>

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

          {/* Page indicator */}
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

          {/* Zoom controls */}
          <div className="hidden md:flex items-center gap-1 bg-[#EDEBE6] rounded-full px-1 py-1 shrink-0">
            <button onClick={zoomOut} disabled={zoom <= MIN_ZOOM} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white transition-colors disabled:opacity-40" title="Zoom out"><ZoomOut size={13} /></button>
            <button onClick={zoomReset} className="text-[11px] font-semibold text-ink w-10 text-center hover:text-ink-muted transition-colors tabular-nums" title="Reset zoom">{Math.round(zoom * 100)}%</button>
            <button onClick={zoomIn}  disabled={zoom >= MAX_ZOOM} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white transition-colors disabled:opacity-40" title="Zoom in"><ZoomIn size={13} /></button>
          </div>

          <button onClick={toggleFullscreen} className="w-8 h-8 rounded-full bg-[#EDEBE6] flex items-center justify-center hover:bg-card-hover transition-colors shrink-0" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>

          <button onClick={downloadPNG} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink text-cream text-xs font-medium hover:bg-[#3a3a3a] transition-colors shrink-0">
            <Download size={12} />Save PNG
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* Sidebar — desktop */}
          <aside className="hidden md:flex flex-col gap-5 w-56 bg-cream border-r border-border-muted p-4 overflow-y-auto shrink-0">
            {/* Tools */}
            <div>
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Tool</p>
              <div className="flex flex-col gap-1">
                {([
                  { id: "brush"  as Tool, Icon: Paintbrush, label: "Brush" },
                  { id: "fill"   as Tool, Icon: Droplets,   label: "Paint Bucket" },
                  { id: "eraser" as Tool, Icon: Eraser,     label: "Eraser" },
                  { id: "pan"    as Tool, Icon: Hand,       label: "Pan  (Space)" },
                ]).map(({ id, Icon, label }) => (
                  <button key={id} onClick={() => { prevToolRef.current = id !== "pan" ? id : prevToolRef.current; setTool(id); }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${tool === id ? "bg-ink text-cream" : "text-ink hover:bg-[#EDEBE6]"}`}>
                    <Icon size={14} />{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Brush size */}
            {tool !== "fill" && tool !== "pan" && (
              <div>
                <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Size — {brushSize}px</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => adjustBrushSize(-2)} className="w-7 h-7 rounded-full bg-[#EDEBE6] hover:bg-card-hover flex items-center justify-center transition-colors shrink-0"><Minus size={12} /></button>
                  <input type="range" min={2} max={48} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="flex-1 cursor-pointer" style={{ accentColor: "#222" }} />
                  <button onClick={() => adjustBrushSize(2)}  className="w-7 h-7 rounded-full bg-[#EDEBE6] hover:bg-card-hover flex items-center justify-center transition-colors shrink-0"><Plus size={12} /></button>
                </div>
                <div className="flex justify-between mt-2">
                  {[4, 10, 18, 30, 46].map((s) => (
                    <button key={s} onClick={() => setBrushSize(s)} className="flex items-center justify-center w-8 h-8">
                      <div className={`rounded-full transition-colors ${brushSize === s ? "bg-ink" : "bg-[#C5C0B8] hover:bg-ink/60"}`} style={{ width: s / 2 + 4, height: s / 2 + 4 }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color palette */}
            <div>
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Color</p>
              <div className="grid grid-cols-5 gap-1.5">
                {PALETTE.map((c) => (
                  <button key={c} onClick={() => { setColor(c); if (tool === "eraser" || tool === "pan") setTool("brush"); }}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${color === c && tool !== "eraser" ? "border-ink shadow-sm scale-110" : c === "#FFFFFF" ? "border-[#D6D3D1]" : "border-white"}`} />
                ))}
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input type="color" value={color} onChange={(e) => { setColor(e.target.value); if (tool === "eraser" || tool === "pan") setTool("brush"); }} className="sr-only" />
                <div className="w-7 h-7 rounded-full border-2 border-dashed border-ink-muted flex items-center justify-center text-[10px] text-ink-muted">+</div>
                <span className="text-xs text-ink-muted">Custom</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1 mt-auto pt-4 border-t border-border-muted">
              <button onClick={undo} disabled={!canUndo} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-ink hover:bg-[#EDEBE6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Undo2 size={14} />Undo<span className="ml-auto text-[10px] text-ink-muted">Ctrl+Z</span>
              </button>
              <button onClick={redo} disabled={!canRedo} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-ink hover:bg-[#EDEBE6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Redo2 size={14} />Redo<span className="ml-auto text-[10px] text-ink-muted">Ctrl+Y</span>
              </button>
              <button onClick={clear} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-ink hover:bg-[#EDEBE6] transition-colors">
                <Trash2 size={14} />Clear page
              </button>
            </div>
          </aside>

          {/* ── Canvas area ─────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">

            {/* Loading overlay — sits on top of canvases so they stay mounted */}
            {pdfLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden" style={{ background: "#EDEBE6" }}>
                {product?.image && (
                  <img src={product.image} alt="" className="absolute inset-0 w-full h-full object-contain opacity-20 blur-md pointer-events-none select-none" />
                )}
                <div className="relative text-center z-10">
                  <div className="w-10 h-10 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-ink-muted">Loading coloring book…</p>
                </div>
              </div>
            )}

            {/* Error state */}
            {!pdfLoading && pdfError && (
              <div className="absolute inset-0 z-20 flex items-center justify-center px-6" style={{ background: "#EDEBE6" }}>
                <div className="text-center max-w-sm">
                  <BookOpen size={40} strokeWidth={1.2} className="text-ink-muted mx-auto mb-4" />
                  <p className="font-serif text-xl text-ink mb-2">Coloring pages coming soon</p>
                  <p className="text-sm text-ink-muted">The interactive coloring book for this product is being prepared. Check back soon!</p>
                </div>
              </div>
            )}

            {/* Canvases always stay in the DOM so refs are valid during PDF rendering */}
            {true && (
              <>
                {/* Canvas + navigation */}
                <div className="flex-1 relative overflow-hidden min-h-0">
                  {/* Scroll viewport */}
                  <div ref={viewportRef} className="absolute inset-0 overflow-auto flex items-center justify-center" style={{ background: "#EDEBE6" }}>
                    {/* Zoom wrapper */}
                    <div style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: zoom > 1 ? "top center" : "center center",
                      transition: "transform 0.12s ease-out",
                      margin: zoom > 1 ? `${(zoom - 1) * 400}px auto` : "auto",
                    }}>
                      {/* Canvas wrapper */}
                      <div className="relative select-none"
                        style={{ width: 680, height: Math.round(680 * (CANVAS_H / CANVAS_W)) }}
                        onTouchStart={handleTouchStartNav}
                        onTouchEnd={handleTouchEndNav}>

                        {/* Page loading overlay */}
                        {pageLoading && (
                          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 rounded-2xl">
                            <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}

                        {/* Drawing canvas */}
                        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
                          className="block w-full h-full rounded-2xl shadow-lg"
                          style={{ cursor: canvasCursor, touchAction: "none" }}
                          onMouseDown={handlePointerDown} onMouseMove={handlePointerMove}
                          onMouseUp={handlePointerUp}     onMouseLeave={handlePointerUp}
                          onTouchStart={handlePointerDown} onTouchMove={handlePointerMove}
                          onTouchEnd={handlePointerUp} />

                        {/* Outline overlay */}
                        <canvas ref={overlayRef} width={CANVAS_W} height={CANVAS_H}
                          className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none"
                          style={{ mixBlendMode: "multiply", opacity: imageLoaded ? 1 : 0, transition: "opacity 0.2s" }} />

                        {/* Custom cursor */}
                        <div ref={cursorRef}
                          className="absolute pointer-events-none rounded-full border-2 border-ink -translate-x-1/2 -translate-y-1/2"
                          style={{
                            width: displaySize, height: displaySize,
                            backgroundColor: tool === "eraser" ? "rgba(255,255,255,0.5)" : `${color}66`,
                            display: tool === "fill" || tool === "pan" ? "none" : "block",
                          }} />
                      </div>
                    </div>
                  </div>

                  {/* Prev page arrow */}
                  {currentPage > 0 && (
                    <button onClick={prevPage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-ink/80 hover:bg-ink text-cream flex items-center justify-center shadow-lg transition-colors"
                      title="Previous page (←)">
                      <ChevronLeft size={20} />
                    </button>
                  )}

                  {/* Next page arrow */}
                  {currentPage < totalPages - 1 && (
                    <button onClick={nextPage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-ink/80 hover:bg-ink text-cream flex items-center justify-center shadow-lg transition-colors"
                      title="Next page (→)">
                      <ChevronRight size={20} />
                    </button>
                  )}
                </div>

                {/* Thumbnail strip */}
                <div className="bg-[#E8E4DC] border-t border-border-muted shrink-0" style={{ maxHeight: 140 }}>
                  <div ref={thumbStripRef} className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button key={i} onClick={() => switchPage(i)}
                        className={`flex-shrink-0 flex flex-col items-center gap-1 transition-opacity ${currentPage === i ? "opacity-100" : "opacity-50 hover:opacity-75"}`}>
                        <div className={`rounded-lg overflow-hidden border-2 transition-all bg-white ${currentPage === i ? "border-ink shadow-md" : "border-transparent"}`}
                          style={{ width: 60 }}>
                          {thumbnails[i]
                            ? <img src={thumbnails[i]} alt={`Page ${i + 1}`} className="w-full h-auto block" />
                            : <div className="w-full bg-[#E8E4DC] animate-pulse" style={{ height: 78 }} />
                          }
                        </div>
                        <span className={`text-[10px] tabular-nums ${currentPage === i ? "text-ink font-semibold" : "text-ink-muted"}`}>{i + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Mobile bottom toolbar ─────────────────────────────────────── */}
        <div className="md:hidden bg-cream border-t border-border-muted px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
          {([
            { id: "brush"  as Tool, Icon: Paintbrush },
            { id: "fill"   as Tool, Icon: Droplets },
            { id: "eraser" as Tool, Icon: Eraser },
            { id: "pan"    as Tool, Icon: Hand },
          ]).map(({ id, Icon }) => (
            <button key={id} onClick={() => setTool(id)}
              className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors ${tool === id ? "bg-ink text-cream" : "bg-[#EDEBE6] text-ink"}`}>
              <Icon size={15} />
            </button>
          ))}

          <div className="w-px h-6 bg-border-muted shrink-0 mx-0.5" />

          {/* Page nav (mobile) */}
          <button onClick={prevPage} disabled={currentPage === 0} className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-[#EDEBE6] disabled:opacity-40"><ChevronLeft size={15} /></button>
          <span className="text-[11px] font-semibold text-ink shrink-0 w-14 text-center tabular-nums">{currentPage + 1}/{totalPages}</span>
          <button onClick={nextPage} disabled={currentPage >= totalPages - 1} className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-[#EDEBE6] disabled:opacity-40"><ChevronRight size={15} /></button>

          <div className="w-px h-6 bg-border-muted shrink-0 mx-0.5" />

          {/* Zoom */}
          <button onClick={zoomOut} disabled={zoom <= MIN_ZOOM} className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-[#EDEBE6] disabled:opacity-40"><ZoomOut size={15} /></button>
          <button onClick={zoomReset} className="text-[11px] font-semibold text-ink shrink-0 w-10 text-center">{Math.round(zoom * 100)}%</button>
          <button onClick={zoomIn}  disabled={zoom >= MAX_ZOOM} className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-[#EDEBE6] disabled:opacity-40"><ZoomIn size={15} /></button>

          <div className="w-px h-6 bg-border-muted shrink-0 mx-0.5" />

          {[6, 14, 28].map((s) => (
            <button key={s} onClick={() => setBrushSize(s)}
              className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors ${brushSize === s ? "bg-ink" : "bg-[#EDEBE6]"}`}>
              <div className={`rounded-full ${brushSize === s ? "bg-cream" : "bg-ink"}`} style={{ width: s / 3 + 4, height: s / 3 + 4 }} />
            </button>
          ))}

          <div className="w-px h-6 bg-border-muted shrink-0 mx-0.5" />

          {PALETTE.map((c) => (
            <button key={c} onClick={() => { setColor(c); if (tool === "eraser" || tool === "pan") setTool("brush"); }}
              style={{ backgroundColor: c }}
              className={`w-7 h-7 rounded-full shrink-0 border-2 transition-all ${color === c && tool !== "eraser" ? "border-ink scale-110" : c === "#FFFFFF" ? "border-[#D6D3D1]" : "border-white"}`} />
          ))}

          <div className="w-px h-6 bg-border-muted shrink-0 mx-0.5" />

          <button onClick={undo} disabled={!canUndo} className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#EDEBE6] shrink-0 disabled:opacity-40"><Undo2 size={15} /></button>
          <button onClick={redo} disabled={!canRedo} className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#EDEBE6] shrink-0 disabled:opacity-40"><Redo2 size={15} /></button>
          <button onClick={clear} className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#EDEBE6] shrink-0"><Trash2 size={15} /></button>
          <button onClick={toggleFullscreen} className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#EDEBE6] shrink-0 ml-auto">
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
        </div>
      </main>
    </>
  );
}
