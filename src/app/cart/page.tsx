"use client";

import { ShoppingCart, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart } from "@/context/CartContext";

function discountPct(sale: string, original: string) {
  const s = parseFloat(sale.replace(/[^0-9.]/g, ""));
  const o = parseFloat(original.replace(/[^0-9.]/g, ""));
  if (!o) return null;
  return Math.round((1 - s / o) * 100);
}

export default function CartPage() {
  const { items, removeFromCart, cartCount } = useCart();

  const subtotal = items.reduce((sum, { product }) => {
    return sum + parseFloat(product.salePrice.replace(/[^0-9.]/g, ""));
  }, 0);

  const savings = items.reduce((sum, { product }) => {
    const sale = parseFloat(product.salePrice.replace(/[^0-9.]/g, ""));
    const orig = parseFloat(product.originalPrice.replace(/[^0-9.]/g, ""));
    return sum + (orig - sale);
  }, 0);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink tracking-tight mb-2">
            Your Cart
          </h1>
          <p className="text-sm text-ink-muted mb-8">
            {cartCount} {cartCount === 1 ? "item" : "items"}
          </p>

          {/* Empty state */}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-16 h-16 rounded-full bg-card-hover flex items-center justify-center mb-4">
                <ShoppingCart size={28} strokeWidth={1.5} className="text-ink-muted" />
              </div>
              <p className="font-serif text-2xl text-ink mb-2">Your cart is empty</p>
              <p className="text-sm text-ink-muted mb-6">
                Add some products to get started.
              </p>
              <a
                href="/all"
                className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-medium hover:bg-[#3a3a3a] transition-colors duration-200"
              >
                Browse products
              </a>
            </div>
          )}

          {items.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-8">

              {/* Cart items */}
              <div className="flex-1 space-y-4">
                {items.map(({ product }) => {
                  const pct = discountPct(product.salePrice, product.originalPrice);
                  return (
                    <div
                      key={product.id}
                      className="flex gap-4 p-4 bg-white rounded-2xl border border-border-muted"
                    >
                      {/* Image */}
                      <a href={`/product/${product.id}`} className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-20 h-20 rounded-xl object-cover bg-card-hover"
                        />
                      </a>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-ink-muted mb-0.5 truncate">{product.seller}</p>
                        <a href={`/product/${product.id}`}>
                          <h3 className="text-sm font-medium text-ink leading-snug line-clamp-2 hover:underline underline-offset-2 mb-1">
                            {product.title}
                          </h3>
                        </a>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-semibold text-sale-green">{product.salePrice}</span>
                          <span className="text-xs text-ink-muted line-through">{product.originalPrice}</span>
                          {pct !== null && (
                            <span className="text-[10px] font-bold text-sale-green">{pct}% off</span>
                          )}
                        </div>
                        {product.instantDownload && (
                          <span className="inline-block mt-1 text-[10px] font-semibold text-[#134A4F] bg-[#134A4F]/10 px-2 py-0.5 rounded-full">
                            Instant Download
                          </span>
                        )}
                      </div>

                      {/* Remove */}
                      <div className="shrink-0 flex items-center">
                        <button
                          onClick={() => removeFromCart(product.id)}
                          className="p-1.5 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-full transition-colors duration-200"
                          aria-label="Remove"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order summary */}
              <div className="lg:w-80 shrink-0">
                <div className="bg-white border border-border-muted rounded-2xl p-6 sticky top-24">
                  <h2 className="font-serif text-lg font-semibold text-ink mb-4">Order Summary</h2>

                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between text-ink-muted">
                      <span>Subtotal ({items.length} {items.length === 1 ? "item" : "items"})</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    {savings > 0 && (
                      <div className="flex justify-between text-sale-green font-medium">
                        <span>You save</span>
                        <span>−${savings.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-ink-muted">
                      <span>Delivery</span>
                      <span className="text-sale-green font-medium">Free</span>
                    </div>
                  </div>

                  <div className="border-t border-border-muted pt-4 mb-5">
                    <div className="flex justify-between font-semibold text-ink text-base">
                      <span>Total</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button className="w-full h-12 rounded-full bg-ink text-cream text-sm font-semibold hover:bg-[#3a3a3a] active:scale-[0.98] transition-all duration-200 mb-3">
                    Proceed to Checkout
                  </button>
                  <a
                    href="/all"
                    className="block text-center text-xs text-ink-muted hover:text-ink underline underline-offset-2 transition-colors duration-200"
                  >
                    Continue shopping
                  </a>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
