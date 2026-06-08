"use client";

/**
 * Strawberry Banana Smoothie — Cook Along!
 *
 * Per-purchase recipe player. Six interactive steps + checklist + a
 * celebration. Built so that recipe #2 onwards can plug into the
 * same component by passing a different recipe config — the engine
 * itself doesn't care which recipe it's playing.
 *
 * Engine interaction types used here:
 *   - tap-multi    (tap N copies of an item, each flies into target)
 *   - tap-single   (tap one item, it flies into target)
 *   - tap-button   (tap a button; target image swaps after a beat)
 *   - tap-targets  (tap each of N targets; each swaps from "empty" to "full")
 *
 * Reusable for fruit pizza, no-bake cookies, etc. — just supply
 * different art + a different sequence.
 */

import { use, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChefHat, Sparkles, RotateCcw, Volume2, VolumeX, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { allProducts, cookingProducts } from "@/data/products";

// ── Recipe config (for product 45) ───────────────────────────────────────────
// All paths live under /public/images/cook/strawberry-smoothie/ so we
// only need the slug here; the asset URLs are built off it.
const RECIPE_SLUG = "strawberry-smoothie";
const ASSET = `/images/cook/${RECIPE_SLUG}`;

const RECIPE = {
  title: "Strawberry Banana Smoothie",
  ageRange: "4–9",
  totalMinutes: 5,
  allergens: ["Dairy"],
  servings: 2,
  ingredients: [
    "1 ripe banana",
    "1 cup fresh strawberries",
    "½ cup milk",
    "½ cup vanilla yogurt",
    "1 tsp honey (optional)",
  ],
  equipment: ["Blender", "Measuring cup", "2 cups"],
};

const STRAWBERRY_COUNT = 5;

type StepKind =
  | "checklist"
  | "tap-strawberries"
  | "drag-banana"
  | "tap-milk"
  | "drag-yogurt"
  | "tap-blend"
  | "pour-cups"
  | "done";

const STEPS: StepKind[] = [
  "checklist",
  "tap-strawberries",
  "drag-banana",
  "tap-milk",
  "drag-yogurt",
  "tap-blend",
  "pour-cups",
  "done",
];

const STEP_TITLES: Record<StepKind, string> = {
  "checklist":         "Ready to cook?",
  "tap-strawberries":  "Tap the strawberries!",
  "drag-banana":       "Tap the banana!",
  "tap-milk":          "Pour the milk!",
  "drag-yogurt":       "Add the yogurt!",
  "tap-blend":         "Press the BLEND button!",
  "pour-cups":         "Pour into the cups!",
  "done":              "You did it!",
};

const STEP_HINTS: Record<StepKind, string> = {
  "checklist":         "Get your ingredients ready, then start.",
  "tap-strawberries":  "Drop all 5 strawberries into the blender.",
  "drag-banana":       "Tap the banana to add it to the blender.",
  "tap-milk":          "Tap the milk to pour it in.",
  "drag-yogurt":       "Tap the yogurt cup to add it.",
  "tap-blend":         "Tap the red button and watch it blend!",
  "pour-cups":         "Tap each cup to fill it up.",
  "done":              "Great job, chef!",
};

interface FlyingItem {
  id: number;
  src: string;
  startX: number;  // % of stage
  startY: number;  // % of stage
  rotation: number; // deg
  scale: number;
}

export default function CookPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  const purchase = purchases.find((p) => p.id === purchaseId);
  const product  = purchase ? allProducts.find((p) => p.id === purchase.product_id) : null;
  const isCookingProduct = !!product && cookingProducts.some((c) => c.id === product.id);

  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];

  // Strawberry step — track which strawberries are still on the
  // counter. Five fixed scattered positions for visual variety; we
  // hide each one as it gets tapped.
  const strawberryPositions = useRef<Array<{ x: number; y: number; rot: number; scale: number }>>(
    Array.from({ length: STRAWBERRY_COUNT }, (_, i) => ({
      x: 10 + i * 18 + ((i % 2) * 4),
      y: 55 + ((i % 3) * 10),
      rot: -15 + i * 8,
      scale: 0.85 + ((i % 3) * 0.1),
    }))
  );
  const [strawberriesGone, setStrawberriesGone] = useState<Set<number>>(new Set());

  // Pour step — which cups have been filled.
  const [cupsFilled, setCupsFilled] = useState<Set<number>>(new Set());

  // "Flying" items animation — when something gets added to the
  // blender we push a flying clone onto this array; it animates to
  // the blender mouth and is removed.
  const [flying, setFlying] = useState<FlyingItem[]>([]);
  const flyingIdRef = useRef(0);

  // Blender state — for the blend step.
  const [blending, setBlending] = useState(false);
  const [blended, setBlended] = useState(false);

  // Audio — optional narration. Fetches /api/cook/{purchaseId}/audio/{step}
  // when the step changes. Silently falls back to no audio if missing.
  const [audioOn, setAudioOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioOn) return;
    if (!purchase?.id) return;
    if (step === "checklist" || step === "done") return;
    let cancelled = false;
    fetch(`/api/cook/${purchase.id}/audio/${step}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { url: null }))
      .then((data: { url: string | null }) => {
        if (cancelled) return;
        const el = audioRef.current;
        if (!el || !data.url) return;
        el.src = data.url;
        el.play().catch(() => {});
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [step, audioOn, purchase?.id]);

  // ── Step transitions ─────────────────────────────────────────────────────
  function advance() {
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function restart() {
    setStepIdx(0);
    setStrawberriesGone(new Set());
    setCupsFilled(new Set());
    setBlending(false);
    setBlended(false);
    setFlying([]);
  }

  // Spawn a "flying" copy of an ingredient that animates from its
  // current spot to the blender mouth.
  function flyToBlender(src: string, startX: number, startY: number) {
    const id = ++flyingIdRef.current;
    setFlying((prev) => [...prev, { id, src, startX, startY, rotation: 0, scale: 1 }]);
    // Remove the flying item after the animation duration.
    setTimeout(() => {
      setFlying((prev) => prev.filter((f) => f.id !== id));
    }, 700);
  }

  function tapStrawberry(idx: number) {
    if (strawberriesGone.has(idx)) return;
    const pos = strawberryPositions.current[idx];
    flyToBlender(`${ASSET}/ingredients/strawberry.png`, pos.x, pos.y);
    setStrawberriesGone((prev) => {
      const next = new Set(prev);
      next.add(idx);
      if (next.size === STRAWBERRY_COUNT) {
        // All five collected — auto-advance after the last fly-in lands.
        setTimeout(advance, 800);
      }
      return next;
    });
  }

  function tapSimpleItem(src: string, startX: number, startY: number) {
    flyToBlender(src, startX, startY);
    setTimeout(advance, 800);
  }

  function tapBlend() {
    if (blending || blended) return;
    setBlending(true);
    setTimeout(() => {
      setBlending(false);
      setBlended(true);
      setTimeout(advance, 900);
    }, 1600);
  }

  function tapCup(idx: number) {
    if (cupsFilled.has(idx)) return;
    setCupsFilled((prev) => {
      const next = new Set(prev);
      next.add(idx);
      if (next.size === 2) setTimeout(advance, 700);
      return next;
    });
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-cream flex items-center justify-center">
          <p className="text-sm text-ink-muted">Loading…</p>
        </main>
      </>
    );
  }

  if (!purchase || !product || !isCookingProduct) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-cream flex items-center justify-center px-4">
          <div className="text-center">
            <p className="font-serif text-2xl text-ink mb-2">Recipe not found</p>
            <p className="text-sm text-ink-muted mb-6">This purchase isn&apos;t in your library.</p>
            <a href="/downloads" className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-medium hover:bg-[#3a3a3a] transition-colors duration-200">
              Back to library
            </a>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-[#FFEEF5] via-cream to-[#FFE4F1]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <a
              href="/downloads"
              className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors duration-150"
            >
              <ArrowLeft size={14} strokeWidth={2} />
              Back to library
            </a>
            <button
              onClick={() => setAudioOn((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-border-muted hover:bg-card-hover transition-colors duration-150"
              title={audioOn ? "Turn narration off" : "Turn narration on"}
            >
              {audioOn ? <Volume2 size={12} strokeWidth={2} /> : <VolumeX size={12} strokeWidth={2} />}
              <span className="hidden sm:inline">{audioOn ? "Narration on" : "Narration off"}</span>
            </button>
          </div>

          {/* Title */}
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#FFE2C2] text-[#A66B41] mb-3">
              <ChefHat size={11} strokeWidth={2.5} />
              Cook Along
            </span>
            <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink tracking-tight">
              {STEP_TITLES[step]}
            </h1>
            <p className="text-sm md:text-base text-ink-muted mt-1">{STEP_HINTS[step]}</p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mb-4">
            {STEPS.slice(1, -1).map((s, i) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i + 1 < stepIdx
                    ? "w-6 bg-[#E91E63]"
                    : i + 1 === stepIdx
                    ? "w-10 bg-[#E91E63]"
                    : "w-6 bg-white border border-border-muted"
                }`}
              />
            ))}
          </div>

          {/* Stage */}
          <div
            className="relative w-full bg-white rounded-3xl border-2 border-[#FFC1D8] overflow-hidden shadow-xl"
            style={{ aspectRatio: "4 / 3" }}
          >
            {step === "checklist" && <Checklist recipe={RECIPE} onStart={advance} />}

            {step === "tap-strawberries" && (
              <Scene>
                <Counter />
                <BlenderTarget blendedSrc={null} stage="empty" added={[]} />
                {strawberryPositions.current.map((pos, i) =>
                  strawberriesGone.has(i) ? null : (
                    <button
                      key={i}
                      onClick={() => tapStrawberry(i)}
                      className="absolute pointer-events-auto hover:scale-110 active:scale-95 transition-transform duration-100"
                      style={{
                        left:  `${pos.x}%`,
                        top:   `${pos.y}%`,
                        transform: `translate(-50%, -50%) rotate(${pos.rot}deg) scale(${pos.scale})`,
                        width: "12%",
                      }}
                      aria-label="Strawberry"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${ASSET}/ingredients/strawberry.png`}
                        alt="strawberry"
                        className="w-full h-auto select-none drop-shadow-md animate-[bounce_2s_ease-in-out_infinite]"
                        style={{ animationDelay: `${i * 150}ms` }}
                        draggable={false}
                      />
                    </button>
                  )
                )}
              </Scene>
            )}

            {step === "drag-banana" && (
              <SimpleAddScene
                itemSrc={`${ASSET}/ingredients/banana.png`}
                itemLabel="Banana"
                onTap={() => tapSimpleItem(`${ASSET}/ingredients/banana.png`, 25, 70)}
                addedSoFar={["strawberry"]}
              />
            )}

            {step === "tap-milk" && (
              <SimpleAddScene
                itemSrc={`${ASSET}/ingredients/milk-carton.png`}
                itemLabel="Milk"
                onTap={() => tapSimpleItem(`${ASSET}/ingredients/milk-carton.png`, 25, 70)}
                addedSoFar={["strawberry", "banana"]}
              />
            )}

            {step === "drag-yogurt" && (
              <SimpleAddScene
                itemSrc={`${ASSET}/ingredients/yogurt-cup.png`}
                itemLabel="Yogurt"
                onTap={() => tapSimpleItem(`${ASSET}/ingredients/yogurt-cup.png`, 25, 70)}
                addedSoFar={["strawberry", "banana", "milk"]}
              />
            )}

            {step === "tap-blend" && (
              <Scene>
                <Counter />
                {/* The blender takes center stage — gets bigger so the
                    button is an obvious target. */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: "55%" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={blended ? `${ASSET}/ingredients/blender-full.png` : `${ASSET}/ingredients/blender-empty.png`}
                    alt="blender"
                    className={`w-full h-auto select-none drop-shadow-2xl ${blending ? "animate-[shake_120ms_linear_infinite]" : ""}`}
                    draggable={false}
                  />
                </div>
                {/* Big tappable BLEND button */}
                {!blended && (
                  <button
                    onClick={tapBlend}
                    className="absolute left-1/2 bottom-6 -translate-x-1/2 px-8 py-4 rounded-full bg-gradient-to-b from-[#FF4757] to-[#C92038] text-white font-bold text-lg shadow-xl hover:scale-105 active:scale-95 transition-transform duration-100 border-2 border-white/60"
                    disabled={blending}
                  >
                    {blending ? "Blending…" : "BLEND!"}
                  </button>
                )}
              </Scene>
            )}

            {step === "pour-cups" && (
              <Scene>
                <Counter />
                {/* The full blender — tilts a bit when a cup gets a pour */}
                <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2" style={{ width: "40%" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${ASSET}/ingredients/blender-full.png`}
                    alt="blender"
                    className="w-full h-auto select-none drop-shadow-xl"
                    draggable={false}
                  />
                </div>
                {/* Two cups along the bottom */}
                {[0, 1].map((i) => {
                  const filled = cupsFilled.has(i);
                  return (
                    <button
                      key={i}
                      onClick={() => tapCup(i)}
                      disabled={filled}
                      className={`absolute bottom-[8%] ${i === 0 ? "left-[18%]" : "right-[18%]"} pointer-events-auto ${filled ? "" : "hover:scale-110 active:scale-95"} transition-transform duration-150`}
                      style={{ width: "22%" }}
                      aria-label={filled ? "Filled cup" : "Tap to fill"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={filled ? `${ASSET}/ingredients/cup-full.png` : `${ASSET}/ingredients/cup-empty.png`}
                        alt={filled ? "Full cup" : "Empty cup"}
                        className={`w-full h-auto select-none drop-shadow-md ${filled ? "" : "animate-[bounce_2s_ease-in-out_infinite]"}`}
                        draggable={false}
                      />
                    </button>
                  );
                })}
              </Scene>
            )}

            {step === "done" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${ASSET}/done.png`}
                  alt="Done!"
                  className="max-h-full max-w-full object-contain animate-[pop_500ms_ease-out]"
                  draggable={false}
                />
              </div>
            )}

            {/* Flying-item layer — sits above the scene to animate
                ingredient-to-blender flights. */}
            <div className="absolute inset-0 pointer-events-none">
              {flying.map((f) => (
                <div
                  key={f.id}
                  className="absolute"
                  style={{
                    left:  `${f.startX}%`,
                    top:   `${f.startY}%`,
                    width: "12%",
                    transform: "translate(-50%, -50%)",
                    animation: "flyToBlender 700ms cubic-bezier(0.3, 0.7, 0.4, 1) forwards",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.src}
                    alt=""
                    className="w-full h-auto"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom controls */}
          <div className="flex justify-center gap-3 mt-6">
            {step === "done" ? (
              <button
                onClick={restart}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ink text-cream text-sm font-semibold hover:bg-[#3a3a3a] transition-colors duration-200"
              >
                <RotateCcw size={14} strokeWidth={2.5} />
                Make it again
              </button>
            ) : step !== "checklist" ? (
              <button
                onClick={restart}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-border-muted text-ink text-sm font-medium hover:bg-card-hover transition-colors duration-200"
              >
                <RotateCcw size={14} strokeWidth={2} />
                Start over
              </button>
            ) : null}
          </div>
        </div>

        <audio ref={audioRef} preload="auto" style={{ display: "none" }} />

        <style>{`
          @keyframes flyToBlender {
            0%   { transform: translate(-50%, -50%) scale(1)   rotate(0deg); opacity: 1; }
            60%  { transform: translate(-50%, -180%) scale(0.8) rotate(180deg); opacity: 1; }
            100% { transform: translate(-50%, -200%) scale(0.3) rotate(360deg); opacity: 0; }
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-4px) rotate(-1deg); }
            75% { transform: translateX(4px) rotate(1deg); }
          }
          @keyframes pop {
            from { transform: scale(0.5); opacity: 0; }
            to   { transform: scale(1);   opacity: 1; }
          }
        `}</style>
      </main>
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Scene({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 select-none">{children}</div>;
}

function Counter() {
  // Wooden counter line — purely decorative, sits at the bottom.
  return (
    <div
      className="absolute left-0 right-0 bottom-0 pointer-events-none"
      style={{
        height: "8%",
        background: "linear-gradient(to bottom, #E8C9A8, #B88555)",
        borderTop: "2px solid #8B5A2B",
      }}
    />
  );
}

function BlenderTarget({ stage, added, blendedSrc }: {
  stage: "empty" | "full";
  added: string[];
  blendedSrc: string | null;
}) {
  void added; // reserved for future "show ingredients piling up" variant
  return (
    <div className="absolute right-[8%] top-1/2 -translate-y-1/2" style={{ width: "32%" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={stage === "empty" ? `${ASSET}/ingredients/blender-empty.png` : (blendedSrc ?? `${ASSET}/ingredients/blender-full.png`)}
        alt="blender"
        className="w-full h-auto drop-shadow-xl animate-[bounce_3s_ease-in-out_infinite]"
        draggable={false}
      />
    </div>
  );
}

function SimpleAddScene({ itemSrc, itemLabel, onTap, addedSoFar }: {
  itemSrc: string;
  itemLabel: string;
  onTap: () => void;
  addedSoFar: string[];
}) {
  return (
    <Scene>
      <Counter />
      <BlenderTarget stage="empty" added={addedSoFar} blendedSrc={null} />
      <button
        onClick={onTap}
        className="absolute left-[25%] top-[50%] -translate-x-1/2 -translate-y-1/2 hover:scale-110 active:scale-95 transition-transform duration-100"
        style={{ width: "26%" }}
        aria-label={`Add ${itemLabel}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={itemSrc}
          alt={itemLabel}
          className="w-full h-auto drop-shadow-lg animate-[bounce_1.6s_ease-in-out_infinite]"
          draggable={false}
        />
      </button>
    </Scene>
  );
}

function Checklist({ recipe, onStart }: { recipe: typeof RECIPE; onStart: () => void }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  const total = recipe.ingredients.length + recipe.equipment.length;
  const ready = checked.size === total;

  return (
    <div className="absolute inset-0 overflow-auto p-5 sm:p-8 bg-gradient-to-br from-white to-[#FFF5F9]">
      <div className="max-w-2xl mx-auto">
        <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink mb-1">{recipe.title}</h2>
        <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px] font-medium text-ink-muted">
          <span className="px-2 py-0.5 rounded-full bg-card-hover">Ages {recipe.ageRange}</span>
          <span className="px-2 py-0.5 rounded-full bg-card-hover">{recipe.totalMinutes} min</span>
          <span className="px-2 py-0.5 rounded-full bg-card-hover">{recipe.servings} servings</span>
          {recipe.allergens.map((a) => (
            <span key={a} className="px-2 py-0.5 rounded-full bg-[#FFE0E6] text-[#B0314D]">⚠ {a}</span>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-xs font-bold tracking-widest text-ink uppercase mb-2">Ingredients</h3>
            <ul className="flex flex-col gap-1">
              {recipe.ingredients.map((ing) => (
                <li key={ing}>
                  <button
                    onClick={() => toggle(`i:${ing}`)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-white/80 transition-colors duration-150 text-left"
                  >
                    <span className={`flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 ${
                      checked.has(`i:${ing}`) ? "bg-[#E91E63] border-[#E91E63]" : "border-border-muted"
                    }`}>
                      {checked.has(`i:${ing}`) && <Check size={12} strokeWidth={3} className="text-white" />}
                    </span>
                    <span className={`text-sm ${checked.has(`i:${ing}`) ? "text-ink-muted line-through" : "text-ink"}`}>
                      {ing}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-widest text-ink uppercase mb-2">Equipment</h3>
            <ul className="flex flex-col gap-1">
              {recipe.equipment.map((eq) => (
                <li key={eq}>
                  <button
                    onClick={() => toggle(`e:${eq}`)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-white/80 transition-colors duration-150 text-left"
                  >
                    <span className={`flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 ${
                      checked.has(`e:${eq}`) ? "bg-[#E91E63] border-[#E91E63]" : "border-border-muted"
                    }`}>
                      {checked.has(`e:${eq}`) && <Check size={12} strokeWidth={3} className="text-white" />}
                    </span>
                    <span className={`text-sm ${checked.has(`e:${eq}`) ? "text-ink-muted line-through" : "text-ink"}`}>
                      {eq}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          onClick={onStart}
          className={`w-full inline-flex items-center justify-center gap-2 py-4 rounded-full text-sm font-semibold transition-colors duration-200 ${
            ready
              ? "bg-gradient-to-b from-[#FF4757] to-[#C92038] text-white shadow-lg hover:scale-[1.01]"
              : "bg-card-hover text-ink-muted hover:bg-border-muted"
          }`}
        >
          <Sparkles size={14} strokeWidth={2.5} />
          {ready ? "Start cooking!" : "Skip and start cooking"}
        </button>
      </div>
    </div>
  );
}
