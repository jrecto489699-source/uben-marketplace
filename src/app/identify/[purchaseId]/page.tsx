"use client";

import { use, useEffect, useRef, useState } from "react";
import { ArrowLeft, Volume2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { allProducts } from "@/data/products";

// Per-product tap-region layouts. Each region is in percent of the
// product image's intrinsic dimensions, so the buttons scale with
// the image regardless of viewport.
//
// Naming: the `name` field is the MP3 base name. Upload
// identification-assets/{productId}/{name}.mp3 and that region
// will play it on tap.
interface Region {
  name: string;
  label: string;
  left: number;   // %
  top: number;    // %
  width: number;  // %
  height: number; // %
}

// Product 41 — Animal Identification. 3x3 grid laid out as:
//   Lion / Elephant / Giraffe
//   Panda / Zebra / Deer
//   Fox / Rabbit / Koala
const LAYOUT_41: Region[] = [
  { name: "lion",     label: "Lion",     left: 0,    top: 0,    width: 33.34, height: 33.34 },
  { name: "elephant", label: "Elephant", left: 33.33, top: 0,    width: 33.34, height: 33.34 },
  { name: "giraffe",  label: "Giraffe",  left: 66.66, top: 0,    width: 33.34, height: 33.34 },
  { name: "panda",    label: "Panda",    left: 0,    top: 33.33, width: 33.34, height: 33.34 },
  { name: "zebra",    label: "Zebra",    left: 33.33, top: 33.33, width: 33.34, height: 33.34 },
  { name: "deer",     label: "Deer",     left: 66.66, top: 33.33, width: 33.34, height: 33.34 },
  { name: "fox",      label: "Fox",      left: 0,    top: 66.66, width: 33.34, height: 33.34 },
  { name: "rabbit",   label: "Rabbit",   left: 33.33, top: 66.66, width: 33.34, height: 33.34 },
  { name: "koala",    label: "Koala",    left: 66.66, top: 66.66, width: 33.34, height: 33.34 },
];

const LAYOUTS_BY_PRODUCT: Record<number, Region[]> = {
  41: LAYOUT_41,
};

export default function IdentifyPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  const purchase = purchases.find((p) => p.id === purchaseId);
  const product  = purchase ? allProducts.find((p) => p.id === purchase.product_id) : null;

  const regions: Region[] = product ? (LAYOUTS_BY_PRODUCT[product.id] ?? []) : [];

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

  async function playAnimal(region: Region) {
    const el = audioRef.current;
    if (!el || !purchase) return;
    let url = urlCacheRef.current.get(region.name);
    if (!url) {
      try {
        const r = await fetch(
          `/api/identify/${purchase.id}/asset?animal=${encodeURIComponent(region.name)}&type=audio`,
          { credentials: "include", cache: "no-store" }
        );
        const d = (await r.json()) as { url: string | null };
        if (d.url) {
          url = d.url;
          urlCacheRef.current.set(region.name, url);
        }
      } catch {}
    }
    if (!url) {
      // No sound uploaded yet for this animal — flash the active
      // state briefly so the tap feels acknowledged, but stay silent.
      setActiveName(region.name);
      setTimeout(() => setActiveName((n) => (n === region.name ? null : n)), 400);
      return;
    }
    try {
      el.pause();
      el.currentTime = 0;
      el.src = url;
      setActiveName(region.name);
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      el.onended = () => setActiveName((n) => (n === region.name ? null : n));
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

          {regions.length === 0 ? (
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
              {/* Tap regions */}
              {regions.map((r) => {
                const isActive = activeName === r.name;
                return (
                  <button
                    key={r.name}
                    onClick={() => playAnimal(r)}
                    className={`absolute rounded-2xl transition-all duration-200 focus:outline-none ${
                      isActive
                        ? "bg-[#0F766E]/15 ring-4 ring-[#0F766E]/60 scale-[1.02]"
                        : "bg-transparent hover:bg-white/15 focus:ring-4 focus:ring-[#0F766E]/40"
                    }`}
                    style={{
                      left:   `${r.left}%`,
                      top:    `${r.top}%`,
                      width:  `${r.width}%`,
                      height: `${r.height}%`,
                    }}
                    aria-label={`Play ${r.label} sound`}
                  >
                    <span className="sr-only">{r.label}</span>
                    {isActive && (
                      <span
                        className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#0F766E] text-white text-[10px] font-semibold"
                      >
                        <Volume2 size={10} className="animate-pulse" />
                        {r.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Fallback list of buttons under the image — accessible row
              of named buttons, useful on small screens or if the
              picture overlay regions are hard to tap precisely. */}
          {regions.length > 0 && (
            <div className="mt-6 sm:mt-8">
              <p className="text-xs text-ink-muted uppercase tracking-wider font-semibold mb-3 text-center">
                Or pick one
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">
                {regions.map((r) => {
                  const isActive = activeName === r.name;
                  return (
                    <button
                      key={r.name}
                      onClick={() => playAnimal(r)}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-[#0F766E] text-white"
                          : "bg-white border border-border-muted text-ink hover:bg-card-hover"
                      }`}
                    >
                      <Volume2 size={12} className={isActive ? "animate-pulse" : ""} />
                      {r.label}
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
