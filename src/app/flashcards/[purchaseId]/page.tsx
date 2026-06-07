"use client";

import { use, useEffect, useRef, useState } from "react";
import { ArrowLeft, Play, X, Video } from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePurchases } from "@/context/PurchasesContext";
import { allProducts } from "@/data/products";

interface CardEntry {
  name: string;       // base name (matches the mp4 / thumbnail base)
  thumbUrl: string | null;
}

export default function FlashcardsPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = use(params);
  const { purchases, loading } = usePurchases();

  const purchase = purchases.find((p) => p.id === purchaseId);
  const product  = purchase ? allProducts.find((p) => p.id === purchase.product_id) : null;

  const [cards, setCards] = useState<CardEntry[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [activeCard, setActiveCard]   = useState<string | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load the list of cards from the bucket once we know the purchase.
  // Then resolve each card's thumbnail URL in parallel so the grid
  // can render with the artwork instead of a blank placeholder.
  useEffect(() => {
    if (!purchase?.id) return;
    let cancelled = false;
    setCardsLoading(true);
    setListError(null);

    (async () => {
      try {
        const res = await fetch(`/api/flashcards/${purchase.id}/cards`);
        if (!res.ok) {
          setListError("Could not load cards.");
          setCardsLoading(false);
          return;
        }
        const { cards: names } = (await res.json()) as { cards: string[] };

        const entries = await Promise.all(
          names.map(async (name): Promise<CardEntry> => {
            try {
              const thumbRes = await fetch(
                `/api/flashcards/${purchase.id}/asset?card=${encodeURIComponent(name)}&type=thumb`
              );
              const { url } = (await thumbRes.json()) as { url: string | null };
              return { name, thumbUrl: url };
            } catch {
              return { name, thumbUrl: null };
            }
          })
        );

        if (cancelled) return;
        setCards(entries);
        setCardsLoading(false);
      } catch {
        if (cancelled) return;
        setListError("Could not load cards.");
        setCardsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [purchase?.id]);

  async function openCard(name: string) {
    if (!purchase?.id) return;
    setActiveCard(name);
    setActiveVideoUrl(null);
    setVideoLoading(true);
    try {
      const res = await fetch(
        `/api/flashcards/${purchase.id}/asset?card=${encodeURIComponent(name)}&type=video`
      );
      const { url } = (await res.json()) as { url: string | null };
      setActiveVideoUrl(url);
    } finally {
      setVideoLoading(false);
    }
  }

  function closeModal() {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setActiveCard(null);
    setActiveVideoUrl(null);
  }

  // Esc to close the modal
  useEffect(() => {
    if (!activeCard) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeCard]);

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

  if (!purchase || !product) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-cream flex items-center justify-center px-4">
          <div className="text-center">
            <p className="font-serif text-2xl text-ink mb-2">Flashcards not found</p>
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
        <div className="max-w-6xl mx-auto px-6 py-8">
          <a
            href="/downloads"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors duration-150 mb-6"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            Back to library
          </a>

          <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink tracking-tight mb-2">
            {product.title}
          </h1>
          <p className="text-sm text-ink-muted mb-8">
            Tap a card to watch the video.
          </p>

          {cardsLoading && (
            <p className="text-sm text-ink-muted">Loading cards…</p>
          )}

          {!cardsLoading && listError && (
            <p className="text-sm text-red-700">{listError}</p>
          )}

          {!cardsLoading && !listError && cards.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-border-muted">
              <div className="w-14 h-14 rounded-full bg-card-hover flex items-center justify-center mb-4">
                <Video size={24} strokeWidth={1.5} className="text-ink-muted" />
              </div>
              <p className="font-serif text-xl text-ink mb-1">No videos yet</p>
              <p className="text-sm text-ink-muted max-w-sm">
                Upload <code className="bg-card-hover px-1.5 py-0.5 rounded text-[12px]">name.mp4</code>{" "}
                + <code className="bg-card-hover px-1.5 py-0.5 rounded text-[12px]">name.png</code>{" "}
                pairs to <code className="bg-card-hover px-1.5 py-0.5 rounded text-[12px]">flashcard-videos/{product.id}/</code>{" "}
                and they&apos;ll appear here.
              </p>
            </div>
          )}

          {!cardsLoading && cards.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {cards.map((card) => (
                <button
                  key={card.name}
                  onClick={() => openCard(card.name)}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-card-hover border border-border-muted hover:border-ink transition-colors duration-200 text-left"
                >
                  {card.thumbUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={card.thumbUrl}
                      alt={card.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink-muted">
                      <Video size={28} strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Play size={18} strokeWidth={2} className="text-ink ml-0.5" />
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-xs font-medium text-white capitalize">{card.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {activeCard && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors duration-150"
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} />
          </button>
          <div
            className="relative max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {videoLoading && (
              <div className="aspect-video bg-black rounded-2xl flex items-center justify-center">
                <p className="text-sm text-white/70">Loading video…</p>
              </div>
            )}
            {!videoLoading && activeVideoUrl && (
              <video
                ref={videoRef}
                src={activeVideoUrl}
                controls
                autoPlay
                playsInline
                className="w-full rounded-2xl bg-black"
              />
            )}
            {!videoLoading && !activeVideoUrl && (
              <div className="aspect-video bg-black rounded-2xl flex items-center justify-center px-6 text-center">
                <p className="text-sm text-white/80">
                  No video uploaded for <span className="font-semibold capitalize">{activeCard}</span> yet.
                </p>
              </div>
            )}
            <p className="mt-3 text-center text-white font-medium capitalize">{activeCard}</p>
          </div>
        </div>
      )}
    </>
  );
}
