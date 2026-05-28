"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import { Paintbrush, Droplets, Eraser, Undo2, Trash2, Download, ArrowLeft, Minus, Plus } from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { allProducts } from "@/data/products";

const PALETTE = [
  "#FFFFFF", "#111111", "#EF4444", "#F97316", "#F59E0B", "#22C55E",
  "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899", "#F9A8D4", "#FCA5A5",
  "#86EFAC", "#67E8F9", "#93C5FD", "#C4B5FD", "#D6D3D1", "#78716C",
  "#7C2D12", "#1E40AF",
];

const CANVAS_W = 800;
const CANVAS_H = 800;
const MAX_HISTORY = 15;

type Tool = "brush" | "fill" | "eraser";

export default function ColorPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const isDrawingRef = useRef(false);
  const cursorRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#EF4444");
  const [brushSize, setBrushSize] = useState(14);
  const [canUndo, setCanUndo] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  const purchase = purchases.find((p) => p.id === purchaseId);
  const product = purchase ? allProducts.find((p) => p.id === purchase.product_id) : null;
  const storageKey = `uben_coloring_${purchaseId}`;

  // Load overlay image
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !product) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.filter = "grayscale(1) contrast(12) brightness(1.05)";
      ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
      ctx.filter = "none";
      setImageLoaded(true);
    };
    img.src = product.image;
  }, [product]);

  // Init drawing canvas — try to restore from localStorage
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = saved;
    } else {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }, [storageKey]);

  function getPos(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;

    if ("touches" in e) {
      const touch = (e as TouchEvent).touches[0] || (e as TouchEvent).changedTouches[0];
      if (!touch) return null;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    const me = e as MouseEvent;
    return {
      x: (me.clientX - rect.left) * scaleX,
      y: (me.clientY - rect.top) * scaleY,
    };
  }

  function saveHistory() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const snap = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    if (historyRef.current.length >= MAX_HISTORY) historyRef.current.shift();
    historyRef.current.push(snap);
    setCanUndo(true);
  }

  function floodFill(startX: number, startY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const d = imageData.data;

    const xi = Math.floor(startX);
    const yi = Math.floor(startY);
    if (xi < 0 || xi >= CANVAS_W || yi < 0 || yi >= CANVAS_H) return;

    const px = (yi * CANVAS_W + xi) * 4;
    const tR = d[px], tG = d[px + 1], tB = d[px + 2];

    const fR = parseInt(color.slice(1, 3), 16);
    const fG = parseInt(color.slice(3, 5), 16);
    const fB = parseInt(color.slice(5, 7), 16);

    if (tR === fR && tG === fG && tB === fB) return;

    const tol = 28;
    const W = CANVAS_W;
    const H = CANVAS_H;
    const visited = new Uint8Array(W * H);

    function match(i: number) {
      return (
        Math.abs(d[i]     - tR) <= tol &&
        Math.abs(d[i + 1] - tG) <= tol &&
        Math.abs(d[i + 2] - tB) <= tol
      );
    }

    const stack = [xi + yi * W];
    while (stack.length > 0) {
      const pos = stack.pop()!;
      if (visited[pos]) continue;
      const x = pos % W;
      const y = (pos - x) / W;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = pos * 4;
      if (!match(i)) continue;
      visited[pos] = 1;
      d[i]     = fR;
      d[i + 1] = fG;
      d[i + 2] = fB;
      d[i + 3] = 255;
      if (x + 1 < W)  stack.push(pos + 1);
      if (x - 1 >= 0) stack.push(pos - 1);
      if (y + 1 < H)  stack.push(pos + W);
      if (y - 1 >= 0) stack.push(pos - W);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function drawLine(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const size = tool === "eraser" ? brushSize * 2.5 : brushSize;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = tool === "eraser" ? "#FFFFFF" : color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function drawDot(pos: { x: number; y: number }) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const size = tool === "eraser" ? brushSize * 2.5 : brushSize;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === "eraser" ? "#FFFFFF" : color;
    ctx.fill();
  }

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent);
      if (!pos) return;

      if (tool === "fill") {
        saveHistory();
        floodFill(pos.x, pos.y);
        autoSave();
        return;
      }

      saveHistory();
      isDrawingRef.current = true;
      lastPos.current = pos;
      drawDot(pos);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, color, brushSize]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect && cursorRef.current) {
        const me = "touches" in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);
        if (me) {
          cursorRef.current.style.left = me.clientX - rect.left + "px";
          cursorRef.current.style.top = me.clientY - rect.top + "px";
        }
      }

      if (!isDrawingRef.current) return;
      const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent);
      if (!pos) return;

      if (lastPos.current) {
        drawLine(lastPos.current, pos);
      }
      lastPos.current = pos;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, color, brushSize]
  );

  function handlePointerUp() {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPos.current = null;
      autoSave();
    }
  }

  function autoSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      localStorage.setItem(storageKey, canvas.toDataURL("image/png"));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {}
  }

  function undo() {
    const snap = historyRef.current.pop();
    if (!snap) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.putImageData(snap, 0, 0);
    setCanUndo(historyRef.current.length > 0);
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    saveHistory();
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    autoSave();
  }

  function downloadPNG() {
    const drawing = canvasRef.current;
    const overlay = overlayRef.current;
    if (!drawing || !overlay) return;

    const out = document.createElement("canvas");
    out.width = CANVAS_W;
    out.height = CANVAS_H;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(drawing, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(overlay, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    const a = document.createElement("a");
    a.download = `${product?.title ?? "coloring"}.png`;
    a.href = out.toDataURL("image/png");
    a.click();
  }

  const adjustBrushSize = (delta: number) => {
    setBrushSize((s) => Math.max(2, Math.min(48, s + delta)));
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <p className="text-sm text-ink-muted">Loading…</p>
        </div>
      </>
    );
  }

  if (!purchase || !product) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-cream flex items-center justify-center px-6 text-center">
          <div>
            <p className="font-serif text-2xl text-ink mb-2">Purchase not found</p>
            <p className="text-sm text-ink-muted mb-6">
              You need to purchase this product to color it.
            </p>
            <a
              href="/downloads"
              className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-medium hover:bg-[#3a3a3a] transition-colors duration-200"
            >
              My Downloads
            </a>
          </div>
        </div>
      </>
    );
  }

  const displaySize = tool === "eraser" ? brushSize * 2.5 : brushSize;

  return (
    <>
      <Navbar />
      <main className="bg-[#EDEBE6] min-h-screen flex flex-col" style={{ height: "calc(100vh - 64px)" }}>

        {/* Top bar */}
        <div className="bg-cream border-b border-border-muted px-4 py-2.5 flex items-center gap-3 shrink-0">
          <a
            href="/downloads"
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft size={13} />
            My Downloads
          </a>
          <span className="text-border-muted text-xs">·</span>
          <p className="text-sm font-medium text-ink truncate flex-1">{product.title}</p>
          <span
            className={`text-[11px] transition-opacity duration-300 ${saved ? "opacity-100 text-[#258635]" : "opacity-0 text-ink-muted"}`}
          >
            Saved
          </span>
          <button
            onClick={downloadPNG}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink text-cream text-xs font-medium hover:bg-[#3a3a3a] transition-colors shrink-0"
          >
            <Download size={12} />
            Save PNG
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar — desktop only */}
          <aside className="hidden md:flex flex-col gap-5 w-56 bg-cream border-r border-border-muted p-4 overflow-y-auto shrink-0">

            {/* Tools */}
            <div>
              <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Tool</p>
              <div className="flex flex-col gap-1">
                {([
                  { id: "brush"  as Tool, Icon: Paintbrush, label: "Brush" },
                  { id: "fill"   as Tool, Icon: Droplets,   label: "Paint Bucket" },
                  { id: "eraser" as Tool, Icon: Eraser,     label: "Eraser" },
                ]).map(({ id, Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setTool(id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                      tool === id ? "bg-ink text-cream" : "text-ink hover:bg-[#EDEBE6]"
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Brush size */}
            {tool !== "fill" && (
              <div>
                <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">
                  Size — {brushSize}px
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustBrushSize(-2)}
                    className="w-7 h-7 rounded-full bg-[#EDEBE6] hover:bg-card-hover flex items-center justify-center transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                  <div className="flex-1 h-1.5 bg-[#EDEBE6] rounded-full relative">
                    <div
                      className="absolute left-0 top-0 h-full bg-ink rounded-full"
                      style={{ width: `${((brushSize - 2) / 46) * 100}%` }}
                    />
                  </div>
                  <button
                    onClick={() => adjustBrushSize(2)}
                    className="w-7 h-7 rounded-full bg-[#EDEBE6] hover:bg-card-hover flex items-center justify-center transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <div className="flex justify-between mt-2">
                  {[4, 10, 18, 30, 46].map((s) => (
                    <button
                      key={s}
                      onClick={() => setBrushSize(s)}
                      className="flex items-center justify-center w-8 h-8"
                    >
                      <div
                        className={`rounded-full transition-colors ${brushSize === s ? "bg-ink" : "bg-[#C5C0B8] hover:bg-ink/60"}`}
                        style={{ width: s / 2 + 4, height: s / 2 + 4 }}
                      />
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
                  <button
                    key={c}
                    onClick={() => { setColor(c); if (tool === "eraser") setTool("brush"); }}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                      color === c && tool !== "eraser"
                        ? "border-ink shadow-sm scale-110"
                        : c === "#FFFFFF"
                        ? "border-[#D6D3D1]"
                        : "border-white"
                    }`}
                  />
                ))}
              </div>
              {/* Custom color input */}
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => { setColor(e.target.value); if (tool === "eraser") setTool("brush"); }}
                  className="sr-only"
                />
                <div
                  className="w-7 h-7 rounded-full border-2 border-dashed border-ink-muted flex items-center justify-center text-[10px] text-ink-muted"
                  style={{ backgroundColor: "transparent" }}
                >
                  +
                </div>
                <span className="text-xs text-ink-muted">Custom</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1 mt-auto pt-4 border-t border-border-muted">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-ink hover:bg-[#EDEBE6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Undo2 size={14} />
                Undo
              </button>
              <button
                onClick={clear}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-ink hover:bg-[#EDEBE6] transition-colors"
              >
                <Trash2 size={14} />
                Clear canvas
              </button>
            </div>
          </aside>

          {/* Canvas area */}
          <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden">
            <div
              className="relative rounded-2xl overflow-hidden shadow-lg select-none"
              style={{ maxWidth: 680, width: "100%", aspectRatio: "1 / 1" }}
            >
              {/* Drawing canvas */}
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="block w-full h-full"
                style={{
                  cursor: "none",
                  touchAction: "none",
                }}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
              />

              {/* Overlay: product image as coloring guide */}
              <canvas
                ref={overlayRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ mixBlendMode: "multiply", opacity: imageLoaded ? 1 : 0, transition: "opacity 0.3s" }}
              />

              {/* Custom cursor */}
              <div
                ref={cursorRef}
                className="absolute pointer-events-none rounded-full border-2 border-ink -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: displaySize,
                  height: displaySize,
                  backgroundColor: tool === "eraser" ? "rgba(255,255,255,0.5)" : `${color}66`,
                  display: tool === "fill" ? "none" : "block",
                }}
              />
            </div>
          </div>
        </div>

        {/* Mobile bottom toolbar */}
        <div className="md:hidden bg-cream border-t border-border-muted px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
          {/* Tool buttons */}
          {([
            { id: "brush"  as Tool, Icon: Paintbrush },
            { id: "fill"   as Tool, Icon: Droplets },
            { id: "eraser" as Tool, Icon: Eraser },
          ]).map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => setTool(id)}
              className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors ${
                tool === id ? "bg-ink text-cream" : "bg-[#EDEBE6] text-ink"
              }`}
            >
              <Icon size={15} />
            </button>
          ))}

          <div className="w-px h-6 bg-border-muted shrink-0 mx-0.5" />

          {/* Brush size (mobile): S / M / L buttons */}
          {[6, 14, 28].map((s) => (
            <button
              key={s}
              onClick={() => setBrushSize(s)}
              className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors ${
                brushSize === s ? "bg-ink" : "bg-[#EDEBE6]"
              }`}
            >
              <div
                className={`rounded-full ${brushSize === s ? "bg-cream" : "bg-ink"}`}
                style={{ width: s / 3 + 4, height: s / 3 + 4 }}
              />
            </button>
          ))}

          <div className="w-px h-6 bg-border-muted shrink-0 mx-0.5" />

          {/* Color swatches (mobile): scrollable subset */}
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); if (tool === "eraser") setTool("brush"); }}
              style={{ backgroundColor: c }}
              className={`w-7 h-7 rounded-full shrink-0 border-2 transition-all ${
                color === c && tool !== "eraser"
                  ? "border-ink scale-110"
                  : c === "#FFFFFF"
                  ? "border-[#D6D3D1]"
                  : "border-white"
              }`}
            />
          ))}

          <div className="w-px h-6 bg-border-muted shrink-0 mx-0.5" />

          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#EDEBE6] shrink-0 disabled:opacity-40"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={clear}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#EDEBE6] shrink-0"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </main>
    </>
  );
}
