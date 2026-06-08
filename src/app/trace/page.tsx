"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Sparkles, RotateCcw, Plus, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const MAX_CHARS = 28;

// Default rows mimic the classic Monday–Friday tracing worksheet,
// but every label and every word is editable so a parent can turn
// it into a spelling list, a name-practice sheet, or whatever else
// they like.
const DEFAULT_ROWS = [
  { label: "Monday",    word: "Editable Tracing" },
  { label: "Tuesday",   word: "Editable Tracing" },
  { label: "Wednesday", word: "Editable Tracing" },
  { label: "Thursday",  word: "Editable Tracing" },
  { label: "Friday",    word: "Editable Tracing" },
];

const COLORS = [
  { name: "Ink",   value: "#222222" },
  { name: "Sky",   value: "#1E88E5" },
  { name: "Rose",  value: "#E91E63" },
  { name: "Leaf",  value: "#16A34A" },
  { name: "Sun",   value: "#F59E0B" },
  { name: "Plum",  value: "#7C3AED" },
];

const STROKE_WIDTH = 10;

interface Row {
  label: string;
  word: string;
}

interface TraceRowProps {
  row: Row;
  index: number;
  color: string;
  onChange: (next: Row) => void;
  onRemove: () => void;
  canRemove: boolean;
  registerCanvas: (idx: number, el: HTMLCanvasElement | null) => void;
  onClear: () => void;
}

function TraceRow({ row, index, color, onChange, onRemove, canRemove, registerCanvas, onClear }: TraceRowProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef  = useRef<HTMLDivElement  | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // DPR-aware canvas sizing — same pattern as before, scoped to this row.
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage  = stageRef.current;
    if (!canvas || !stage) return;
    registerCanvas(index, canvas);

    function resize() {
      if (!canvas || !stage) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = stage.getBoundingClientRect();
      const prev = document.createElement("canvas");
      prev.width  = canvas.width;
      prev.height = canvas.height;
      const prevCtx = prev.getContext("2d");
      if (prevCtx && canvas.width > 0 && canvas.height > 0) {
        prevCtx.drawImage(canvas, 0, 0);
      }
      canvas.width  = Math.round(rect.width  * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width  = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (prev.width > 0) {
          ctx.drawImage(prev, 0, 0, rect.width, rect.height);
        }
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    return () => {
      ro.disconnect();
      registerCanvas(index, null);
    };
  // registerCanvas is stable; intentionally only re-running on index change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    const p = pointerPos(e);
    activePointersRef.current.set(e.pointerId, p);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, STROKE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const last = activePointersRef.current.get(e.pointerId);
    if (!last) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const next = pointerPos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    activePointersRef.current.set(e.pointerId, next);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    activePointersRef.current.delete(e.pointerId);
    const c = canvasRef.current;
    if (c && c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
  }

  // Tracing word is uppercased for the SVG so the dotted outlines
  // are uniform; the input retains its original case so the user can
  // see what they typed.
  const display = (row.word || " ").toUpperCase();

  return (
    <div className="mb-6">
      {/* Header — editable day/section label and trash button */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <input
          value={row.label}
          onChange={(e) => onChange({ ...row, label: e.target.value.slice(0, 24) })}
          className="font-serif text-xl md:text-2xl font-semibold text-ink bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-border-muted focus:rounded-lg focus:px-2 focus:py-0.5 transition-all duration-150 max-w-[280px]"
          aria-label="Row label"
        />
        <div className="flex-1" />
        <button
          onClick={onClear}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-ink-muted hover:bg-card-hover hover:text-ink transition-colors duration-150"
          aria-label="Clear this row"
        >
          <Eraser size={11} strokeWidth={2} />
          Clear
        </button>
        {canRemove && (
          <button
            onClick={onRemove}
            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-ink-muted hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
            aria-label="Remove row"
          >
            <X size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Editable word input — visible just under the label so it's
          obvious what the kid will trace. Type to change. */}
      <input
        value={row.word}
        onChange={(e) => onChange({ ...row, word: e.target.value.slice(0, MAX_CHARS) })}
        placeholder="Type a word or phrase…"
        maxLength={MAX_CHARS}
        aria-label="Word to trace"
        className="w-full text-sm text-ink-muted bg-transparent border-0 outline-none focus:text-ink mb-2 px-1 placeholder:text-ink-muted/50"
      />

      {/* Tracing stage — ruled paper background + SVG letters + canvas. */}
      <div
        ref={stageRef}
        className="relative w-full bg-white rounded-2xl border border-border-muted overflow-hidden shadow-sm"
        style={{ aspectRatio: "1000 / 220" }}
      >
        {/* Ruled-paper lines — top solid, middle dashed, bottom solid.
            Matches the classic K–2 handwriting practice sheet. */}
        <div className="absolute inset-x-0 pointer-events-none border-t" style={{ top: "20%", borderColor: "#9CA3AF" }} />
        <div className="absolute inset-x-0 pointer-events-none border-t border-dashed" style={{ top: "55%", borderColor: "#D1D5DB" }} />
        <div className="absolute inset-x-0 pointer-events-none border-t" style={{ top: "90%", borderColor: "#9CA3AF" }} />

        {/* Letters — drawn at fixed viewBox coords. textLength + lengthAdjust
            forces the word to fit horizontally regardless of how long it is,
            so a 2-char "Hi" and a 20-char phrase both fill the row. */}
        <svg
          viewBox="0 0 1000 220"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <text
            x="500"
            y="170"
            textAnchor="middle"
            fontFamily="'Fredoka', 'Baloo 2', 'Comic Sans MS', system-ui, sans-serif"
            fontSize="160"
            fontWeight="700"
            fill="#F3F0EA"
            letterSpacing="4"
            textLength="940"
            lengthAdjust="spacingAndGlyphs"
          >
            {display}
          </text>
          <text
            x="500"
            y="170"
            textAnchor="middle"
            fontFamily="'Fredoka', 'Baloo 2', 'Comic Sans MS', system-ui, sans-serif"
            fontSize="160"
            fontWeight="700"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="3.5"
            strokeDasharray="10 8"
            strokeLinecap="round"
            strokeLinejoin="round"
            letterSpacing="4"
            textLength="940"
            lengthAdjust="spacingAndGlyphs"
          >
            {display}
          </text>
        </svg>

        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
        />
      </div>
    </div>
  );
}

export default function TracePage() {
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [color, setColor] = useState(COLORS[1].value);
  const [showCelebrate, setShowCelebrate] = useState(false);

  // Track canvases per row so the global "Clear all" button can wipe
  // every one without each row having to expose its own clear method.
  const canvasMapRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  function registerCanvas(idx: number, el: HTMLCanvasElement | null) {
    if (el) canvasMapRef.current.set(idx, el);
    else    canvasMapRef.current.delete(idx);
  }

  function clearOne(idx: number) {
    const c = canvasMapRef.current.get(idx);
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
  }

  function clearAll() {
    canvasMapRef.current.forEach((_, idx) => clearOne(idx));
  }

  function celebrate() {
    setShowCelebrate(true);
  }

  function reset() {
    setShowCelebrate(false);
    clearAll();
  }

  function updateRow(idx: number, next: Row) {
    setRows((prev) => prev.map((r, i) => (i === idx ? next : r)));
    // Wipe just that row's strokes — the letters are about to change.
    clearOne(idx);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    canvasMapRef.current.delete(idx);
  }

  function addRow() {
    setRows((prev) => [...prev, { label: `Row ${prev.length + 1}`, word: "Editable Tracing" }]);
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#FFE2C2] text-[#A66B41] mb-3">
              <Sparkles size={11} strokeWidth={2.5} />
              Trace & Learn
            </span>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ink tracking-tight mb-2">
              Editable Tracing Sheet
            </h1>
            <p className="text-sm md:text-base text-ink-muted">
              Type any label, type any word — trace each row with your finger or stylus.
            </p>
          </div>

          {/* Color picker — applies to every row. */}
          <div className="flex justify-center gap-2 mb-6">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                aria-label={`${c.name} crayon`}
                className={`w-9 h-9 rounded-full transition-all duration-150 ${
                  color === c.value ? "ring-4 ring-offset-2 ring-offset-cream scale-110" : "hover:scale-105"
                }`}
                style={{
                  background: c.value,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ["--tw-ring-color" as any]: c.value,
                }}
              />
            ))}
          </div>

          {/* Worksheet rows */}
          <div className="bg-white/40 rounded-3xl border-2 border-dashed border-border-muted p-4 md:p-6">
            {rows.map((row, idx) => (
              <TraceRow
                key={idx}
                row={row}
                index={idx}
                color={color}
                onChange={(next) => updateRow(idx, next)}
                onRemove={() => removeRow(idx)}
                canRemove={rows.length > 1}
                registerCanvas={registerCanvas}
                onClear={() => clearOne(idx)}
              />
            ))}

            <button
              onClick={addRow}
              className="w-full inline-flex items-center justify-center gap-2 mt-2 py-3 rounded-2xl border-2 border-dashed border-border-muted text-ink-muted text-sm font-medium hover:bg-cream hover:text-ink hover:border-ink transition-colors duration-150"
            >
              <Plus size={14} strokeWidth={2} />
              Add another row
            </button>
          </div>

          {/* Bottom controls */}
          <div className="flex justify-center gap-3 mt-8">
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-border-muted text-ink text-sm font-medium hover:bg-card-hover transition-colors duration-200"
            >
              <Eraser size={14} strokeWidth={2} />
              Clear all
            </button>
            <button
              onClick={celebrate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ink text-cream text-sm font-semibold hover:bg-[#3a3a3a] transition-colors duration-200"
            >
              <Sparkles size={14} strokeWidth={2.5} />
              I&apos;m done!
            </button>
          </div>

          <p className="text-center text-xs text-ink-muted mt-6">
            Tip: works great with a finger on a tablet, or a stylus on iPad.
          </p>
        </div>

        {/* Celebration overlay — fullscreen so it covers every row. */}
        {showCelebrate && (
          <div
            className="fixed inset-0 z-50 bg-cream/95 backdrop-blur-sm flex items-center justify-center"
            onClick={reset}
          >
            <div className="text-center px-6 animate-[pop_400ms_ease-out]">
              <div className="flex justify-center gap-2 mb-4 text-[#F59E0B]">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Sparkles
                    key={i}
                    size={36}
                    strokeWidth={2.5}
                    className="animate-[twinkle_900ms_ease-in-out_infinite]"
                    style={{ animationDelay: `${i * 90}ms` }}
                  />
                ))}
              </div>
              <h2 className="font-serif text-4xl md:text-5xl font-semibold text-ink mb-2">Great job!</h2>
              <p className="text-sm text-ink-muted mb-6">You finished your tracing sheet.</p>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ink text-cream text-sm font-semibold hover:bg-[#3a3a3a] transition-colors duration-200"
              >
                <RotateCcw size={14} strokeWidth={2.5} />
                Start over
              </button>
            </div>
          </div>
        )}

        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap"
        />
        <style>{`
          @keyframes twinkle {
            0%, 100% { transform: scale(1)   rotate(0deg); opacity: 1;   }
            50%      { transform: scale(1.3) rotate(15deg); opacity: 0.6; }
          }
          @keyframes pop {
            from { transform: scale(0.85); opacity: 0; }
            to   { transform: scale(1);    opacity: 1; }
          }
        `}</style>
      </main>
      <Footer />
    </>
  );
}
