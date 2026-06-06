"use client";

import { use, useEffect, useRef, useState } from "react";
import { ArrowLeft, Volume2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { allProducts } from "@/data/products";

// Per-product tap-point layouts. Each Spot is in percent of the
// product image (x and y are the BUTTON CENTER, so it scales with
// the image regardless of viewport). Position the spot just below
// the animal's face / on the body so the button doesn't obscure
// the artwork.
//
// Naming: the `name` field is the MP3 base name. Upload
// identification-assets/{productId}/{name}.mp3 and that spot
// will play it on tap.
interface Spot {
  name: string;
  label: string;
  x: number; // % — button center horizontal
  y: number; // % — button center vertical
}

// Product 41 — Animal Identification. 3x3 grid of nine animals.
// Lion / Elephant / Giraffe across the top, Panda / Zebra / Deer
// across the middle, Fox / Rabbit / Koala across the bottom. Each
// spot sits roughly on the animal's body, below its face.
const LAYOUT_41: Spot[] = [
  { name: "lion",     label: "Lion",     x: 17, y: 30 },
  { name: "elephant", label: "Elephant", x: 50, y: 30 },
  { name: "giraffe",  label: "Giraffe",  x: 83, y: 30 },
  { name: "panda",    label: "Panda",    x: 17, y: 60 },
  { name: "zebra",    label: "Zebra",    x: 50, y: 60 },
  { name: "deer",     label: "Deer",     x: 83, y: 60 },
  { name: "fox",      label: "Fox",      x: 17, y: 90 },
  { name: "rabbit",   label: "Rabbit",   x: 50, y: 90 },
  { name: "koala",    label: "Koala",    x: 83, y: 90 },
];

// Product 42 — Alphabet Chart. 26 letter cards in a 6-column grid
// (rows of 6 for A–X, then Y/Z alone on the final row). Each card
// has a big letter at the top, a centred illustration, and a word
// label at the bottom — all important details. The speaker button
// sits in the TOP-RIGHT CORNER of each card where there's dead
// space, so it doesn't cover anything important.
//
// The image has white margins around the grid; using literal 0–100%
// of the IMAGE put corner icons on top of the gaps between cards
// instead of inside the cards themselves. These offsets carve out
// the grid as it actually appears in the artwork.
//
// Each spot's `name` is the lowercase letter — upload
// identification-assets/42/a.mp3, b.mp3, … z.mp3 to pair sounds.
const LAYOUT_42: Spot[] = (() => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const cols = 6;
  const rows = 5;
  // Grid bounds in % of the image. Tuned to the actual artwork —
  // the grid starts ~1.5% from the left/top and is inset on the
  // right/bottom too (Y / Z row has empty cells, but the grid as a
  // whole still ends a bit before the image edge).
  const gridLeft = 1.5;
  const gridTop  = 2;
  const gridW    = 97;
  const gridH    = 90;
  const cardW    = gridW / cols;
  const cardH    = gridH / rows;
  return letters.map((L, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      name:  L.toLowerCase(),
      label: L,
      // 80% across the card, 22% down — comfortably inside the
      // coloured frame on the top-right, away from card borders /
      // inter-card gaps, and above the illustration.
      x: gridLeft + col * cardW + cardW * 0.80,
      y: gridTop  + row * cardH + cardH * 0.22,
    };
  });
})();

const LAYOUTS_BY_PRODUCT: Record<number, Spot[]> = {
  41: LAYOUT_41,
  42: LAYOUT_42,
};

export default function IdentifyPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  const purchase = purchases.find((p) => p.id === purchaseId);
  const product  = purchase ? allProducts.find((p) => p.id === purchase.product_id) : null;

  const spots: Spot[] = product ? (LAYOUTS_BY_PRODUCT[product.id] ?? []) : [];
  // Alphabet's cards are denser than the 3x3 animal grid, so the
  // corner-positioned speaker buttons are shrunk further to keep
  // them unobtrusive. Animals stay at 28 — the body of each
  // animal swallows that size comfortably.
  const buttonPx = product?.id === 42 ? 22 : 28;
  const iconPx   = product?.id === 42 ? 11 : 14;

  const [activeName, setActiveName]   = useState<string | null>(null);
  // One preloaded HTMLAudioElement per animal — keyed by spot.name.
  // Built on mount: we fetch every signed URL in parallel and stand
  // up an Audio object for each with preload="auto", so by the time
  // the user taps anything the browser already has the bytes (or is
  // most of the way through fetching them). Taps then just call
  // play() synchronously inside the gesture — no fetch on the
  // critical path, no decode-on-tap delay.
  const audioMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (!purchase?.id || !product) return;
    const layout = LAYOUTS_BY_PRODUCT[product.id] ?? [];
    if (!layout.length) return;
    let cancelled = false;

    Promise.all(
      layout.map((s) =>
        fetch(`/api/identify/${purchase.id}/asset?animal=${encodeURIComponent(s.name)}&type=audio`, {
          credentials: "include", cache: "no-store",
        })
          .then((r) => (r.ok ? r.json() : { url: null }))
          .then((d: { url: string | null }) => ({ name: s.name, url: d.url }))
          .catch(() => ({ name: s.name, url: null }))
      )
    ).then((results) => {
      if (cancelled) return;
      results.forEach(({ name, url }) => {
        if (!url) return;
        const a = new Audio();
        a.preload = "auto";
        a.src = url;
        audioMapRef.current.set(name, a);
      });
    });

    const cleanupMap = audioMapRef.current;
    return () => {
      cancelled = true;
      cleanupMap.forEach((a) => { try { a.pause(); } catch {} });
      cleanupMap.clear();
    };
  }, [purchase?.id, product]);

  function playAnimal(spot: Spot) {
    const audio = audioMapRef.current.get(spot.name);
    if (!audio) {
      // No sound uploaded for this animal — flash the active state so
      // the tap feels acknowledged, but stay silent.
      setActiveName(spot.name);
      setTimeout(() => setActiveName((n) => (n === spot.name ? null : n)), 400);
      return;
    }
    // Stop any other animal that's currently mid-play so the new tap
    // takes over cleanly.
    audioMapRef.current.forEach((other, otherName) => {
      if (otherName !== spot.name) {
        try { other.pause(); other.currentTime = 0; } catch {}
      }
    });
    try {
      audio.currentTime = 0;
      setActiveName(spot.name);
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      audio.onended = () => setActiveName((n) => (n === spot.name ? null : n));
    } catch {}
  }

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
            <a href="/downloads" className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-medium">My Library</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream">
        {/* Top bar */}
        <div className="bg-cream border-b border-border-muted px-4 py-2.5 flex items-center gap-3">
          <a href="/downloads" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors shrink-0">
            <ArrowLeft size={13} />My Library
          </a>
          <span className="text-border-muted text-xs shrink-0">·</span>
          <p className="text-sm font-medium text-ink truncate flex-1">{product.title}</p>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <h1 className="font-serif text-2xl md:text-3xl font-semibold text-ink mb-1 text-center">
            Tap an animal to hear it
          </h1>
          <p className="text-sm text-ink-muted text-center mb-6 sm:mb-8">
            Each animal plays its own sound.
          </p>

          {spots.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border-muted p-8 text-center">
              <p className="text-sm text-ink-muted">
                This pack&apos;s tap layout isn&apos;t set up yet.
              </p>
            </div>
          ) : (
            <div className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-lg bg-white border border-border-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.image}
                alt={product.title}
                className="block w-full h-auto select-none pointer-events-none"
                draggable={false}
              />
              {/* Small circular speaker buttons placed over each animal /
                  card. 28px so they don't dominate the artwork on a
                  card-dense layout like the alphabet chart, but still
                  give a clear touch target. */}
              {spots.map((s) => {
                const isActive = activeName === s.name;
                return (
                  <button
                    key={s.name}
                    onClick={() => playAnimal(s)}
                    className={`absolute flex items-center justify-center rounded-full shadow-md ring-1 transition-all duration-200 focus:outline-none focus:ring-2 ${
                      isActive
                        ? "bg-[#0F766E] text-white ring-white scale-110 focus:ring-[#0F766E]/40"
                        : "bg-white/95 text-[#0F766E] ring-[#0F766E]/30 hover:bg-[#0F766E] hover:text-white hover:scale-110 active:scale-95 focus:ring-[#0F766E]/30"
                    }`}
                    style={{
                      left: `${s.x}%`,
                      top:  `${s.y}%`,
                      width: buttonPx,
                      height: buttonPx,
                      transform: "translate(-50%, -50%)",
                    }}
                    aria-label={`Play ${s.label} sound`}
                  >
                    <Volume2 size={iconPx} className={isActive ? "animate-pulse" : ""} />
                    <span className="sr-only">{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Backup row of named pills under the picture — useful as
              a visible inventory of what's in the pack and as a fall-
              back on tiny screens where the circle buttons sit on top
              of each other. */}
          {spots.length > 0 && (
            <div className="mt-6 sm:mt-8">
              <p className="text-xs text-ink-muted uppercase tracking-wider font-semibold mb-3 text-center">
                Or pick one
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">
                {spots.map((s) => {
                  const isActive = activeName === s.name;
                  return (
                    <button
                      key={s.name}
                      onClick={() => playAnimal(s)}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-[#0F766E] text-white"
                          : "bg-white border border-border-muted text-ink hover:bg-card-hover"
                      }`}
                    >
                      <Volume2 size={12} className={isActive ? "animate-pulse" : ""} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
