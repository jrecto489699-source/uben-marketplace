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
  dx: number;      // delta to target (stage %)
  dy: number;      // delta to target (stage %)
}

// Blender position (centre of jug opening) for the add-ingredient
// scenes. The blender container is anchored to the counter surface
// at bottom-[14%], so its horizontal centre is still at 76% of
// stage but its vertical jug-opening centre is around 52% — that's
// where the fly-to-blender arcs need to terminate.
const BLENDER_TARGET_X = 76;
const BLENDER_TARGET_Y = 52;

// Pre-rendered blender state images. Each shows the cumulative
// contents of the jug at a point in the recipe. Picking the right
// state image is just a function of which ingredients have been
// added so far — no per-chunk positioning to keep aligned.
type IngredientId = "strawberry" | "banana" | "milk" | "yogurt";

function blenderImageFor(added: Set<IngredientId>): string {
  const has = (k: IngredientId) => added.has(k);
  if (has("yogurt"))     return `${ASSET}/ingredients/blender-strawberry-banana-milk-yogurt.png`;
  if (has("milk"))       return `${ASSET}/ingredients/blender-strawberry-banana-milk.png`;
  if (has("banana"))     return `${ASSET}/ingredients/blender-strawberry-banana.png`;
  if (has("strawberry")) return `${ASSET}/ingredients/blender-strawberry.png`;
  return `${ASSET}/ingredients/blender-empty.png`;
}

// Preload every blender + pour-stream image on mount so the
// state-swap during the add-ingredient steps is instant — no
// download flash where the blender disappears for a frame.
const PRELOAD_SRCS = [
  `${ASSET}/ingredients/blender-empty.png`,
  `${ASSET}/ingredients/blender-strawberry.png`,
  `${ASSET}/ingredients/blender-strawberry-banana.png`,
  `${ASSET}/ingredients/blender-strawberry-banana-milk.png`,
  `${ASSET}/ingredients/blender-strawberry-banana-milk-yogurt.png`,
  `${ASSET}/ingredients/blender-blending.png`,
  `${ASSET}/ingredients/blender-full.png`,
  `${ASSET}/ingredients/blender-pouring.png`,
  `${ASSET}/ingredients/cup-empty.png`,
  `${ASSET}/ingredients/cup-full.png`,
];

export default function CookPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  // Warm the browser image cache for every blender state up front.
  // Triggered on mount; subsequent <img src=…> swaps hit the cache
  // and paint immediately instead of unmounting+downloading.
  useEffect(() => {
    PRELOAD_SRCS.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  const purchase = purchases.find((p) => p.id === purchaseId);
  const product  = purchase ? allProducts.find((p) => p.id === purchase.product_id) : null;
  const isCookingProduct = !!product && cookingProducts.some((c) => c.id === product.id);

  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];

  // Strawberry step — five strawberries clustered on the LEFT half
  // of the counter so the fly-to-blender arc heads right-and-up
  // toward the blender (which sits on the right).
  const strawberryPositions = useRef<Array<{ x: number; y: number; rot: number; scale: number }>>([
    { x: 12, y: 78, rot: -18, scale: 0.95 },
    { x: 26, y: 72, rot:   8, scale: 1.05 },
    { x: 18, y: 64, rot: -10, scale: 0.85 },
    { x: 34, y: 80, rot:  15, scale: 0.92 },
    { x: 38, y: 65, rot:  -5, scale: 1.00 },
  ]);
  const [strawberriesGone, setStrawberriesGone] = useState<Set<number>>(new Set());

  // Which ingredients have landed in the blender (for splash drops).
  const [addedIngredients, setAddedIngredients] = useState<Set<IngredientId>>(new Set());

  // Pour step — which cups have been filled, and which (if any) is
  // currently mid-pour for the tilt + stream animation.
  const [cupsFilled, setCupsFilled] = useState<Set<number>>(new Set());
  const [pouringCup, setPouringCup] = useState<number | null>(null);

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
    setAddedIngredients(new Set());
    setCupsFilled(new Set());
    setPouringCup(null);
    setBlending(false);
    setBlended(false);
    setFlying([]);
  }

  // Spawn a flying clone that arcs from (startX, startY) toward the
  // blender's actual position. We pre-compute the delta so the CSS
  // keyframe can scale to any starting spot.
  function flyToBlender(src: string, startX: number, startY: number, ingredient?: IngredientId) {
    const id = ++flyingIdRef.current;
    const dx = BLENDER_TARGET_X - startX;
    const dy = BLENDER_TARGET_Y - startY;
    setFlying((prev) => [...prev, { id, src, startX, startY, dx, dy }]);
    // Drop the flying clone after it lands.
    setTimeout(() => {
      setFlying((prev) => prev.filter((f) => f.id !== id));
      // Splash drop appears inside the blender as it "lands" —
      // timed so it pops in just as the clone fades out.
      if (ingredient) {
        setAddedIngredients((prev) => {
          const next = new Set(prev);
          next.add(ingredient);
          return next;
        });
      }
    }, 750);
  }

  function tapStrawberry(idx: number) {
    if (strawberriesGone.has(idx)) return;
    const pos = strawberryPositions.current[idx];
    flyToBlender(`${ASSET}/ingredients/strawberry.png`, pos.x, pos.y, "strawberry");
    setStrawberriesGone((prev) => {
      const next = new Set(prev);
      next.add(idx);
      if (next.size === STRAWBERRY_COUNT) {
        // All five collected — auto-advance after the last fly-in lands.
        setTimeout(advance, 950);
      }
      return next;
    });
  }

  function tapSimpleItem(src: string, ingredient: IngredientId) {
    // The ingredient button sits on the counter at left 25%, top 70%
    // in SimpleAddScene, so that's the start of the arc up to the
    // blender on the right.
    flyToBlender(src, 25, 70, ingredient);
    setTimeout(advance, 950);
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
    if (cupsFilled.has(idx) || pouringCup !== null) return;
    // Phase 1: blender tilts toward cup, stream appears. Phase 2:
    // after the stream finishes (~1.2s), swap empty cup → full cup
    // and straighten the blender. Phase 3: if both cups full, advance.
    setPouringCup(idx);
    setTimeout(() => {
      setCupsFilled((prev) => {
        const next = new Set(prev);
        next.add(idx);
        if (next.size === 2) setTimeout(advance, 900);
        return next;
      });
      setPouringCup(null);
    }, 1200);
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
      <main className="min-h-screen bg-cream">
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
            {/* Kitchen backdrop — shows under every interactive
                step. Excluded from the checklist and done screens
                because they have their own backgrounds (pink panel
                and done.png respectively). */}
            {step !== "checklist" && step !== "done" && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`${ASSET}/extras/counter-bg.png`}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                draggable={false}
              />
            )}

            {/* Chef mascot — friendly cheerleader in the top-left
                corner of every interactive step. Gentle bob keeps her
                feeling alive without competing with the tap targets.
                Hidden on the checklist (own scene) and done
                (own celebration). Keyed by step so she re-pops with a
                little scale-in each time the step changes — reads as
                "good job, here's the next thing!". */}
            {step !== "checklist" && step !== "done" && (
              <div
                key={`mascot-${step}`}
                className="absolute top-[2%] left-[2%] pointer-events-none z-20 animate-[mascotPop_500ms_cubic-bezier(0.34,1.56,0.64,1)]"
                style={{ width: "24%" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${ASSET}/chef-mascot.png`}
                  alt="Chef mascot"
                  className="w-full h-auto drop-shadow-lg animate-[mascotBob_3s_ease-in-out_infinite]"
                  draggable={false}
                />
              </div>
            )}

            {step === "checklist" && <Checklist recipe={RECIPE} onStart={advance} />}

            {step === "tap-strawberries" && (
              <Scene>
                <Counter />
                <BlenderTarget added={addedIngredients} />
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
                onTap={() => tapSimpleItem(`${ASSET}/ingredients/banana.png`, "banana")}
                added={addedIngredients}
              />
            )}

            {step === "tap-milk" && (
              <SimpleAddScene
                itemSrc={`${ASSET}/ingredients/milk-carton.png`}
                itemLabel="Milk"
                onTap={() => tapSimpleItem(`${ASSET}/ingredients/milk-carton.png`, "milk")}
                added={addedIngredients}
              />
            )}

            {step === "drag-yogurt" && (
              <SimpleAddScene
                itemSrc={`${ASSET}/ingredients/yogurt-cup.png`}
                itemLabel="Yogurt"
                onTap={() => tapSimpleItem(`${ASSET}/ingredients/yogurt-cup.png`, "yogurt")}
                added={addedIngredients}
              />
            )}

            {step === "tap-blend" && (
              <Scene>
                <Counter />
                {/* Blender takes centre stage. Pre-blend we still show
                    the splash drops from all the added ingredients
                    inside the jug — so the kid sees what they're about
                    to blend. During the blend it shakes and the drops
                    spin; afterwards the contents are swapped to the
                    fully-blended pink smoothie image. */}
                <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${blending ? "animate-[shake_120ms_linear_infinite]" : ""}`} style={{ width: "55%" }}>
                  {/* Three-state blender: full pre-blend state (showing
                      all 4 ingredients waiting to be blended) → blending
                      (motion-blur PNG) → full (blended pink smoothie).
                      The pre-blend state always shows the
                      four-ingredient image because the kid only reaches
                      this step after adding everything. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      blended  ? `${ASSET}/ingredients/blender-full.png` :
                      blending ? `${ASSET}/ingredients/blender-blending.png` :
                                 blenderImageFor(addedIngredients)
                    }
                    alt="blender"
                    className="w-full h-auto select-none drop-shadow-2xl"
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
                {/* Pour scene
                    Two visual states per cup:
                      RESTING — blender-full sits centered, upright,
                        hovering above the counter; both cups await
                        a tap below.
                      POURING — blender-pouring.png slides directly
                        above the target cup. The image itself is
                        pre-tilted with the smoothie stream attached
                        to the spout, so no CSS rotation or separate
                        stream sprite is needed. Mirrored via
                        scaleX(-1) when pouring the RIGHT cup so the
                        same artwork covers both directions.
                    Geometry (% of stage):
                      Cup centres   left=25, right=75; cup mouth Y≈63
                      Blender X     resting 50, pouring 25 / 75
                      Blender top   4% (hovers high so pour drops down) */}
                <div
                  className="absolute transition-all duration-500 ease-out z-10"
                  style={{
                    // Vertical position: when pouring, the blender
                    // drops down so its stream-end sits just above the
                    // cup mouth — the pour image's built-in stream
                    // naturally feeds INTO the cup, no separate
                    // bridging animation needed. When idle, the
                    // blender sits higher up centred on the stage.
                    top: pouringCup !== null ? "20%" : "8%",
                    // The pour PNG has its smoothie stream offset to
                    // the RIGHT of the blender body (the spout extends
                    // out the right side in the source artwork). Shift
                    // the wrapper LEFT for cup-0 so the stream lands
                    // on the cup; for cup-1 the image is mirrored, so
                    // shift RIGHT to compensate. Cup centres are at
                    // 25% / 75%; offsetting by ~7% in the right
                    // direction puts the stream exactly over the cup
                    // mouth instead of past it.
                    left:
                      pouringCup === 0 ? "18%" :
                      pouringCup === 1 ? "82%" :
                                         "50%",
                    width: "30%",
                    transform: pouringCup === 1
                      ? "translateX(-50%) scaleX(-1)"
                      : "translateX(-50%)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      pouringCup === null
                        ? `${ASSET}/ingredients/blender-full.png`
                        : `${ASSET}/ingredients/blender-pouring.png`
                    }
                    alt="blender"
                    className="w-full h-auto select-none drop-shadow-2xl"
                    draggable={false}
                  />
                </div>


                {/* Two cups along the bottom. The cup-full image is
                    revealed via a clip-path that travels from bottom
                    to top, so the smoothie level visibly rises. */}
                {[0, 1].map((i) => {
                  const filled = cupsFilled.has(i);
                  const isThisPouring = pouringCup === i;
                  return (
                    <button
                      key={i}
                      onClick={() => tapCup(i)}
                      disabled={filled || pouringCup !== null}
                      className={`absolute bottom-[8%] pointer-events-auto ${filled || pouringCup !== null ? "" : "hover:scale-105 active:scale-95"} transition-transform duration-150`}
                      style={{
                        left: i === 0 ? "12%" : "62%",
                        width: "26%",
                      }}
                      aria-label={filled ? "Filled cup" : "Tap to fill"}
                    >
                      <div className="relative">
                        {/* Empty cup base — shown while the cup is
                            empty OR being poured (so the rising fill
                            has an outline behind it). Hidden once
                            the cup is fully filled so we don't get
                            the empty-cup rim peeking around the
                            full-cup image (the two PNGs have slightly
                            different silhouettes). */}
                        {!filled && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={`${ASSET}/ingredients/cup-empty.png`}
                            alt=""
                            className={`w-full h-auto select-none drop-shadow-md ${pouringCup !== null ? "" : "animate-[bounce_2s_ease-in-out_infinite]"}`}
                            draggable={false}
                          />
                        )}
                        {/* Cup-full image. Two render modes:
                              FILLED   — full opacity, no clip, sits
                                          alone (no empty cup behind).
                              POURING — clip-path rises from bottom
                                          via the cupFill animation,
                                          overlaid on the empty cup.
                              EMPTY   — not rendered. */}
                        {(filled || isThisPouring) && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={`${ASSET}/ingredients/cup-full.png`}
                            alt={filled ? "Full cup" : ""}
                            className={filled ? "w-full h-auto select-none drop-shadow-md" : "absolute inset-0 w-full h-auto select-none drop-shadow-md"}
                            style={
                              filled
                                ? undefined
                                : {
                                    clipPath: "inset(100% 0 0 0)",
                                    animation: "cupFill 1200ms ease-out forwards",
                                  }
                            }
                            draggable={false}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </Scene>
            )}

            {step === "done" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 bg-gradient-to-br from-[#FFEAF3] via-[#FFF5FA] to-[#FFE0EC]">
                {/* Confetti — settles in behind the done image with a
                    gentle fade so the celebration reads as "the room
                    filled with confetti the moment you finished". */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${ASSET}/extras/confetti.png`}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none animate-[confettiIn_700ms_ease-out]"
                  draggable={false}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${ASSET}/done.png`}
                  alt="Done!"
                  className="relative max-h-full max-w-full object-contain animate-[pop_500ms_ease-out]"
                  draggable={false}
                />
              </div>
            )}

            {/* Flying-item layer — sits above the scene to animate
                ingredient-to-blender flights. Each flying item carries
                its own dx/dy (% of stage) so the keyframe can arc to
                whatever the actual blender position is for this scene.
                The stage container is `position: relative`, so absolute
                children positioned in % use the stage as the reference
                box — that's what makes the delta math work. */}
            <div className="absolute inset-0 pointer-events-none">
              {flying.map((f) => (
                <div
                  key={f.id}
                  className="absolute"
                  style={{
                    left:  `${f.startX}%`,
                    top:   `${f.startY}%`,
                    width: "12%",
                    // Use the actual stage-relative end coordinates as
                    // CSS custom properties; the keyframe interpolates
                    // top/left changes which use the parent's box.
                    ["--end-left" as string]:  `${f.startX + f.dx}%`,
                    ["--end-top"  as string]:  `${f.startY + f.dy}%`,
                    animation: "flyToBlender 750ms cubic-bezier(0.3, 0.6, 0.4, 1) forwards",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.src}
                    alt=""
                    className="w-full h-auto"
                    style={{
                      transform: "translate(-50%, -50%)",
                      animation: "flySpin 750ms linear forwards",
                    }}
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
          /* Flying-item container slides from the ingredient's start
             position to the blender mouth using the inline custom
             properties --end-top / --end-left. Combined with the
             inner <img>'s spin/scale, the result is an arc that lands
             inside the blender jug and fades out as if dropped in. */
          @keyframes flyToBlender {
            0%   { opacity: 1; }
            85%  { opacity: 1; }
            100% { top: var(--end-top); left: var(--end-left); opacity: 0; }
          }
          @keyframes flySpin {
            0%   { transform: translate(-50%, -50%) scale(1)   rotate(0deg); }
            50%  { transform: translate(-50%, -130%) scale(0.8) rotate(180deg); }
            100% { transform: translate(-50%, -50%) scale(0.25) rotate(540deg); }
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
          /* Subtle "thump" pulse around the blender each time a new
             ingredient lands inside (e.g. strawberry added → image
             swaps + this fires). Scale-only, no opacity change so
             the blender never disappears mid-transition. The wrapper
             is keyed by addedCount so it replays per ingredient. */
          @keyframes blenderThump {
            0%   { transform: scale(1); }
            35%  { transform: scale(0.95); }
            70%  { transform: scale(1.06); }
            100% { transform: scale(1); }
          }
          @keyframes pourWiggle {
            0%   { transform: translateX(-50%) skewX(-3deg); }
            100% { transform: translateX(-50%) skewX(3deg); }
          }
          /* Moving smoothie stripes — the repeating gradient slides
             downward at 350ms/loop, so the column reads as continuously
             flowing liquid instead of a static pink bar. */
          @keyframes pourFlow {
            0%   { background-position: 0 0; }
            100% { background-position: 0 16px; }
          }
          /* Splash bloom at the cup mouth — the spot where the stream
             lands brightens + grows on every loop, mimicking smoothie
             pulsing against the cup's rising surface. */
          @keyframes splashPulse {
            0%, 100% { transform: translate(-50%, -50%) scale(0.9);  opacity: 0.6; }
            50%      { transform: translate(-50%, -50%) scale(1.15); opacity: 1;   }
          }
          /* Smoothie rises in the cup. clip-path inset(top right bottom left)
             — animating the TOP value from 100% down to 0% reveals the
             cup-full image from bottom upward, like liquid filling.
             ease-out front-loads the animation so the cup looks like
             it's filling fastest at the start, slowing as it tops off. */
          @keyframes cupFill {
            0%   { clip-path: inset(100% 0 0 0); }
            100% { clip-path: inset(0 0 0 0); }
          }
          @keyframes confettiIn {
            0%   { opacity: 0; transform: scale(1.15); }
            100% { opacity: 1; transform: scale(1); }
          }
          /* Mascot enters with a bouncy scale-in when the step changes
             (keyed wrapper triggers this), then bobs gently forever. */
          @keyframes mascotPop {
            0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
            70%  { transform: scale(1.08) rotate(3deg); opacity: 1; }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          @keyframes mascotBob {
            0%, 100% { transform: translateY(0); }
            50%      { transform: translateY(-6px); }
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
  // Reserved for future scene-specific overlays; the actual kitchen
  // counter background is now painted on the stage container itself
  // via counter-bg.png so it shows on every step without each Scene
  // having to repeat it.
  return null;
}

function BlenderTarget({ added }: { added: Set<IngredientId> }) {
  // Picks one of the pre-rendered cumulative-state blender PNGs.
  // The <img> element is NOT keyed — swapping the same element's src
  // is instant once images are preloaded, so the blender never
  // disappears mid-transition. A keyed sibling wrapper triggers a
  // small "thump" pulse around the blender each time the state
  // changes — visual feedback without unmounting the image.
  const src = blenderImageFor(added);
  const addedCount = added.size;
  return (
    <div className="absolute right-[8%] bottom-[14%]" style={{ width: "32%" }}>
      <div
        key={`thump-${addedCount}`}
        className="relative animate-[blenderThump_420ms_cubic-bezier(0.34,1.56,0.64,1)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="blender"
          className="w-full h-auto drop-shadow-xl"
          draggable={false}
        />
      </div>
    </div>
  );
}

function SimpleAddScene({ itemSrc, itemLabel, onTap, added }: {
  itemSrc: string;
  itemLabel: string;
  onTap: () => void;
  added: Set<IngredientId>;
}) {
  return (
    <Scene>
      <Counter />
      <BlenderTarget added={added} />
      <button
        onClick={onTap}
        className="absolute left-[25%] top-[70%] -translate-x-1/2 -translate-y-1/2 hover:scale-110 active:scale-95 transition-transform duration-100"
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
