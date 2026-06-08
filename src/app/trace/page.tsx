"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Sparkles, RotateCcw } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const MAX_CHARS = 8;
const DEFAULT_WORD = "TRACE";

// Color palette the kid can pick from for their tracing pencil.
const COLORS = [
  { name: "Ink",   value: "#222222" },
  { name: "Sky",   value: "#1E88E5" },
  { name: "Rose",  value: "#E91E63" },
  { name: "Leaf",  value: "#16A34A" },
  { name: "Sun",   value: "#F59E0B" },
  { name: "Plum",  value: "#7C3AED" },
];

const STROKE_WIDTH = 14;

export default function TracePage() {
  const [word, setWord] = useState(DEFAULT_WORD);
  const [color, setColor] = useState(COLORS[1].value);
  const [showCelebrate, setShowCelebrate] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef  = useRef<HTMLDivElement  | null>(null);

  // Active pointer state — Map keyed by pointerId so multi-touch on
  // tablets doesn't snarl up the strokes.
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // ── Canvas setup — DPR-aware resize ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage  = stageRef.current;
    if (!canvas || !stage) return;

    function resize() {
      if (!canvas || !stage) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = stage.getBoundingClientRect();
      // Preserve the existing drawing through a resize so the trace
      // doesn't get wiped just because the user rotated their tablet.
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
    return () => ro.disconnect();
  }, []);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const p = pointerPos(e);
    activePointersRef.current.set(e.pointerId, p);
    // Draw a tiny dot at the start so tap-without-drag still shows
    // something — feels responsive.
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, STROKE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const last = activePointersRef.current.get(e.pointerId);
    if (!last) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
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
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function celebrate() {
    setShowCelebrate(true);
  }

  function newWord() {
    setShowCelebrate(false);
    clearCanvas();
  }

  // Reset the canvas whenever the word changes so old strokes don't
  // overlap with the new letters.
  useEffect(() => {
    clearCanvas();
  }, [word]);

  const displayWord = (word || DEFAULT_WORD).toUpperCase();

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
              Trace your name!
            </h1>
            <p className="text-sm md:text-base text-ink-muted">
              Type a name or word, then trace the letters with your finger.
            </p>
          </div>

          {/* Name input */}
          <div className="flex justify-center mb-6">
            <div className="relative w-full max-w-md">
              <input
                value={word}
                onChange={(e) => {
                  const next = e.target.value
                    .replace(/[^A-Za-z ]/g, "")
                    .slice(0, MAX_CHARS);
                  setWord(next);
                }}
                placeholder="Type a name…"
                maxLength={MAX_CHARS}
                aria-label="Word to trace"
                className="w-full text-center text-2xl md:text-3xl font-serif font-semibold text-ink bg-white border-2 border-border-muted rounded-full px-6 py-3 outline-none focus:border-ink transition-colors duration-150 placeholder:text-ink-muted/50"
              />
              {word && (
                <button
                  onClick={() => setWord("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-card-hover hover:bg-border-muted flex items-center justify-center text-ink-muted text-xs font-bold"
                  aria-label="Clear word"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Color picker */}
          <div className="flex justify-center gap-2 mb-4">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                aria-label={`${c.name} crayon`}
                className={`w-9 h-9 rounded-full transition-all duration-150 ${
                  color === c.value
                    ? "ring-4 ring-offset-2 ring-offset-cream scale-110"
                    : "hover:scale-105"
                }`}
                style={{
                  background: c.value,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ["--tw-ring-color" as any]: c.value,
                }}
              />
            ))}
          </div>

          {/* Tracing stage */}
          <div
            ref={stageRef}
            className="relative w-full bg-white rounded-3xl border border-border-muted overflow-hidden shadow-sm"
            style={{ aspectRatio: "16 / 7" }}
          >
            {/* Decorative dotted baseline rows — like ruled paper */}
            <div className="absolute inset-0 pointer-events-none">
              {[35, 65].map((y) => (
                <div
                  key={y}
                  className="absolute left-0 right-0 border-t border-dashed"
                  style={{ top: `${y}%`, borderColor: "#E5E0D8" }}
                />
              ))}
            </div>

            {/* Letters — SVG covers the whole stage. The text element
                uses an outlined dashed stroke for the "trace me"
                effect; viewBox is fixed at 800x350 so the text scales
                naturally with the container regardless of viewport. */}
            <svg
              viewBox="0 0 800 350"
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              <defs>
                {/* Small green arrow + start dot per letter to hint at
                    stroke direction. Placed at each char's left edge. */}
                <marker
                  id="startDot"
                  viewBox="0 0 10 10"
                  refX="5" refY="5"
                  markerWidth="6" markerHeight="6"
                >
                  <circle cx="5" cy="5" r="4" fill="#16A34A" />
                </marker>
              </defs>
              <text
                x="400" y="240"
                textAnchor="middle"
                fontFamily="'Fredoka', 'Baloo 2', 'Comic Sans MS', system-ui, sans-serif"
                fontSize="220"
                fontWeight="700"
                fill="none"
                stroke="#9CA3AF"
                strokeWidth="4"
                strokeDasharray="12 10"
                strokeLinecap="round"
                strokeLinejoin="round"
                letterSpacing="6"
                style={{ paintOrder: "stroke" }}
              >
                {displayWord}
              </text>
              {/* Faint guide fill underneath so it reads as a letter,
                  not just dashes floating in space. */}
              <text
                x="400" y="240"
                textAnchor="middle"
                fontFamily="'Fredoka', 'Baloo 2', 'Comic Sans MS', system-ui, sans-serif"
                fontSize="220"
                fontWeight="700"
                fill="#F3F0EA"
                letterSpacing="6"
                style={{ opacity: 0.7 }}
              >
                {displayWord}
              </text>
            </svg>

            {/* Drawing canvas — sits on top of the SVG. Pointer events
                are routed here; the SVG behind it is pointer-events:none. */}
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
            />

            {/* Celebration overlay */}
            {showCelebrate && (
              <div className="absolute inset-0 bg-cream/95 flex items-center justify-center backdrop-blur-sm">
                <div className="text-center px-6 animate-[pop_400ms_ease-out]">
                  <div className="flex justify-center gap-2 mb-4 text-[#F59E0B]">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Sparkles
                        key={i}
                        size={28}
                        strokeWidth={2.5}
                        className="animate-[twinkle_900ms_ease-in-out_infinite]"
                        style={{ animationDelay: `${i * 90}ms` }}
                      />
                    ))}
                  </div>
                  <h2 className="font-serif text-4xl md:text-5xl font-semibold text-ink mb-2">
                    Great job!
                  </h2>
                  <p className="text-sm text-ink-muted mb-6">
                    You traced <span className="font-semibold text-ink">{displayWord}</span>.
                  </p>
                  <button
                    onClick={newWord}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ink text-cream text-sm font-semibold hover:bg-[#3a3a3a] transition-colors duration-200"
                  >
                    <RotateCcw size={14} strokeWidth={2.5} />
                    Try again
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={clearCanvas}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-border-muted text-ink text-sm font-medium hover:bg-card-hover transition-colors duration-200"
            >
              <Eraser size={14} strokeWidth={2} />
              Clear
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

        {/* Google Font + animation keyframes */}
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
