"use client";

import { Heart } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useFavorites } from "@/context/FavoritesContext";
import { useCart } from "@/context/CartContext";
import { getProductById } from "@/data/products";

function discountPct(sale: string, original: string) {
  const s = parseFloat(sale.replace(/[^0-9.]/g, ""));
  const o = parseFloat(original.replace(/[^0-9.]/g, ""));
  if (!o) return null;
  return Math.round((1 - s / o) * 100);
}

export default function FavoritesPage() {
  const { favoriteIds, toggleFavorite } = useFavorites();
  const { addToCart, isInCart } = useCart();

  const products = favoriteIds
    .map((id) => getProductById(id))
    .filter(Boolean) as NonNullable<ReturnType<typeof getProductById>>[];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink tracking-tight mb-2">
            Your Favorites
          </h1>
          <p className="text-sm text-ink-muted mb-8">
            {products.length} {products.length === 1 ? "item" : "items"} saved
          </p>

          {/* Empty state */}
          {products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-16 h-16 rounded-full bg-card-hover flex items-center justify-center mb-4">
                <Heart size={28} strokeWidth={1.5} className="text-ink-muted" />
              </div>
              <p className="font-serif text-2xl text-ink mb-2">Nothing saved yet</p>
              <p className="text-sm text-ink-muted mb-6">
                Tap the heart on any product to save it here.
              </p>
              <a
                href="/all"
                className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-medium hover:bg-[#3a3a3a] transition-colors duration-200"
              >
                Browse products
              </a>
            </div>
          )}

          {/* Grid */}
          {products.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
              {products.map((product) => {
                const pct = discountPct(product.salePrice, product.originalPrice);
                const inCart = isInCart(product.id);
                return (
                  <div key={product.id} className="group">
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-card-hover mb-3">
                      <a href={`/product/${product.id}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-105"
                        />
                      </a>
                      {pct !== null && (
                        <span className="absolute top-2 left-2 bg-sale-green text-cream text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          {pct}% off
                        </span>
                      )}
                      {product.instantDownload && (
                        <span className="absolute top-2 right-2 bg-[#134A4F] text-cream text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          PDF
                        </span>
                      )}
                      {/* Remove from favorites */}
                      <button
                        onClick={() => toggleFavorite(product.id)}
                        className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition-all duration-200"
                        aria-label="Remove from favorites"
                      >
                        <Heart size={14} strokeWidth={1.75} className="fill-red-500 text-red-500" />
                      </button>
                    </div>

                    <div>
                      <p className="text-xs text-ink-muted mb-0.5 truncate">{product.seller}</p>
                      <a href={`/product/${product.id}`}>
                        <h3 className="text-sm font-medium text-ink leading-snug line-clamp-2 hover:underline underline-offset-2 transition-all duration-200 mb-1">
                          {product.title}
                        </h3>
                      </a>
                      <div className="flex items-baseline gap-1.5 mb-2 flex-wrap">
                        <span className="text-sm font-semibold text-sale-green">{product.salePrice}</span>
                        <span className="text-xs text-ink-muted line-through">{product.originalPrice}</span>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        className={`w-full h-9 rounded-full text-xs font-semibold transition-all duration-200 active:scale-[0.98] ${
                          inCart
                            ? "bg-[#3a3a3a] text-cream"
                            : "bg-ink text-cream hover:bg-[#3a3a3a]"
                        }`}
                      >
                        {inCart ? "Added to Cart ✓" : "Add to Cart"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
