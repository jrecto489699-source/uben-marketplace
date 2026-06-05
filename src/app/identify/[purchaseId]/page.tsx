"use client";

import { use, useEffect, useRef, useState } from "react";
import { ArrowLeft, Volume2, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { allProducts } from "@/data/products";

interface AnimalCard {
  name: string;          // base filename, e.g. "dog"
  label: string;         // human display, e.g. "Dog"
  imageUrl: string | null;
  audioUrl: string | null;
}

function titleCase(s: string): string {
  return s
    .split(/[-_ ]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function IdentifyPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  const purchase = purchases.find((p) => p.id === purchaseId);
  const product  = purchase ? allProducts.find((p) => p.id === purchase.product_id) : null;

  const [animals, setAnimals]   = useState<AnimalCard[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError,   setPageError]   = useState<string | null>(null);
  const [activeName,  setActiveName]  = useState<string | null>(null);

  // One shared audio element so a new tap interrupts the previous play.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
    const a = audioRef.current;
    return () => { try { a.pause(); } catch {} };
  }, []);

  // Load the list of animals, then pre-fetch the signed image URLs so
  // the grid can render without N round-trips. Audio URLs are fetched
  // on demand (one per tap) to keep the initial load lean.
  useEffect(() => {
    if (!purchase?.id) return;
    let cancelled = false;
    async function load() {
      setPageLoading(true); setPageError(null);
      try {
        const res = await fetch(`/api/identify/${purchase!.id}/animals`, { credentials: "include", cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (cancelled) return;
          setPageError(body.error ?? "Couldn't load this pack yet.");
          setPageLoading(false);
          return;
        }
        const { animals: names } = (await res.json()) as { animals: string[] };
        if (cancelled) return;
        if (!names.length) {
          setPageError("No animals uploaded for this pack yet.");
          setPageLoading(false);
          return;
        }
        // Fetch image URLs in parallel
        const imageUrls = await Promise.all(
          names.map((n) =>
            fetch(`/api/identify/${purchase!.id}/asset?animal=${encodeURIComponent(n)}&type=image`, {
              credentials: "include", cache: "no-store",
            })
              .then((r) => r.ok ? r.json() : { url: null })
              .then((d: { url: string | null }) => d.url)
              .catch(() => null)
          )
        );
        if (cancelled) return;
        setAnimals(
          names.map((n, i) => ({
            name: n,
            label: titleCase(n),
            imageUrl: imageUrls[i],
            audioUrl: null,
          }))
        );
        setPageLoading(false);
      } catch (e) {
        if (cancelled) return;
        setPageError(e instanceof Error ? e.message : "Failed to load");
        setPageLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [purchase?.id]);

  async function playAnimal(card: AnimalCard) {
    const el = audioRef.current;
    if (!el || !purchase) return;
    // Resolve audio URL lazily and cache on the card so re-taps don't
    // re-fetch.
    let url = card.audioUrl;
    if (!url) {
      try {
        const r = await fetch(
          `/api/identify/${purchase.id}/asset?animal=${encodeURIComponent(card.name)}&type=audio`,
          { credentials: "include", cache: "no-store" }
        );
        const d = (await r.json()) as { url: string | null };
        url = d.url;
        setAnimals((prev) => prev.map((a) => a.name === card.name ? { ...a, audioUrl: url } : a));
      } catch {}
    }
    if (!url) return;
    try {
      el.pause();
      el.currentTime = 0;
      el.src = url;
      setActiveName(card.name);
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      el.onended = () => setActiveName((n) => (n === card.name ? null : n));
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

        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="font-serif text-2xl md:text-3xl font-semibold text-ink mb-2">
            Tap an animal to hear it
          </h1>
          <p className="text-sm text-ink-muted mb-8">
            Each card plays its sound when you tap. Works great on a tablet.
          </p>

          {pageLoading && (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-ink-muted">Loading animals…</p>
              </div>
            </div>
          )}

          {!pageLoading && pageError && (
            <div className="flex items-center justify-center py-24">
              <div className="text-center max-w-sm">
                <AlertCircle size={40} strokeWidth={1.5} className="text-ink-muted mx-auto mb-3" />
                <p className="font-serif text-xl text-ink mb-2">Not ready yet</p>
                <p className="text-sm text-ink-muted">{pageError}</p>
              </div>
            </div>
          )}

          {!pageLoading && !pageError && animals.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
              {animals.map((card) => {
                const isActive = activeName === card.name;
                return (
                  <button
                    key={card.name}
                    onClick={() => playAnimal(card)}
                    className={`group relative aspect-square rounded-2xl overflow-hidden bg-white border-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-4 ${
                      isActive
                        ? "border-[#0F766E] ring-2 ring-[#0F766E]/30 shadow-lg"
                        : "border-border-muted hover:border-[#0F766E]/40 hover:shadow-md focus:ring-[#0F766E]/30"
                    }`}
                    aria-label={`Play ${card.label} sound`}
                  >
                    {card.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={card.imageUrl}
                        alt={card.label}
                        className="absolute inset-0 w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-card-hover">
                        <p className="text-xs text-ink-muted">Image missing</p>
                      </div>
                    )}
                    {/* Label strip at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm px-3 py-2 border-t border-border-muted">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink truncate">{card.label}</span>
                        <Volume2
                          size={14}
                          className={isActive ? "text-[#0F766E] animate-pulse" : "text-ink-muted group-hover:text-[#0F766E]"}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
