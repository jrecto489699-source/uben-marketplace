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

const LAYOUTS_BY_PRODUCT: Record<number, Spot[]> = {
  41: LAYOUT_41,
};

export default function IdentifyPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  const purchase = purchases.find((p) => p.id === purchaseId);
  const product  = purchase ? allProducts.find((p) => p.id === purchase.product_id) : null;

  const spots: Spot[] = product ? (LAYOUTS_BY_PRODUCT[product.id] ?? []) : [];

  const [activeName, setActiveName]   = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Cached audio URLs per animal, fetched lazily on first tap.
  const urlCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
    const a = audioRef.current;
    return () => { try { a.pause(); } catch {} };
  }, []);

  async function playAnimal(spot: Spot) {
    const el = audioRef.current;
    if (!el || !purchase) return;
    let url = urlCacheRef.current.get(spot.name);
    if (!url) {
      try {
        const r = await fetch(
          `/api/identify/${purchase.id}/asset?animal=${encodeURIComponent(spot.name)}&type=audio`,
          { credentials: "include", cache: "no-store" }
        );
        const d = (await r.json()) as { url: string | null };
        if (d.url) {
          url = d.url;
          urlCacheRef.current.set(spot.name, url);
        }
      } catch {}
    }
    if (!url) {
      // No sound uploaded yet — flash the active state so the tap
      // feels acknowledged, but stay silent.
      setActiveName(spot.name);
      setTimeout(() => setActiveName((n) => (n === spot.name ? null : n)), 400);
      return;
    }
    try {
      el.pause();
      el.currentTime = 0;
      el.src = url;
      setActiveName(spot.name);
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      el.onended = () => setActiveName((n) => (n === spot.name ? null : n));
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
              {/* Small circular speaker buttons placed over each animal */}
              {spots.map((s) => {
                const isActive = activeName === s.name;
                return (
                  <button
                    key={s.name}
                    onClick={() => playAnimal(s)}
                    className={`absolute flex items-center justify-center rounded-full shadow-lg ring-2 transition-all duration-200 focus:outline-none focus:ring-4 ${
                      isActive
                        ? "bg-[#0F766E] text-white ring-white scale-110 focus:ring-[#0F766E]/40"
                        : "bg-white text-[#0F766E] ring-[#0F766E]/30 hover:bg-[#0F766E] hover:text-white hover:scale-110 active:scale-95 focus:ring-[#0F766E]/30"
                    }`}
                    style={{
                      left: `${s.x}%`,
                      top:  `${s.y}%`,
                      width: 44,
                      height: 44,
                      transform: "translate(-50%, -50%)",
                    }}
                    aria-label={`Play ${s.label} sound`}
                  >
                    <Volume2 size={20} className={isActive ? "animate-pulse" : ""} />
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
