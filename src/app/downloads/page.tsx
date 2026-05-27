"use client";

import { Download, FileText, ShoppingBag } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePurchases } from "@/context/PurchasesContext";
import { useAuth } from "@/context/AuthContext";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export default function DownloadsPage() {
  const { purchases, loading } = usePurchases();
  const { user } = useAuth();

  if (!user) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-cream flex items-center justify-center px-4">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-card-hover flex items-center justify-center mx-auto mb-4">
              <Download size={28} strokeWidth={1.5} className="text-ink-muted" />
            </div>
            <p className="font-serif text-2xl text-ink mb-2">Sign in to view your downloads</p>
            <p className="text-sm text-ink-muted mb-6">Your purchased products will appear here.</p>
            <a href="/signin" className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-medium hover:bg-[#3a3a3a] transition-colors duration-200">
              Sign in
            </a>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink tracking-tight mb-2">
            My Downloads
          </h1>
          <p className="text-sm text-ink-muted mb-8">
            {loading ? "Loading…" : `${purchases.length} ${purchases.length === 1 ? "purchase" : "purchases"}`}
          </p>

          {/* Empty state */}
          {!loading && purchases.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-16 h-16 rounded-full bg-card-hover flex items-center justify-center mb-4">
                <ShoppingBag size={28} strokeWidth={1.5} className="text-ink-muted" />
              </div>
              <p className="font-serif text-2xl text-ink mb-2">No purchases yet</p>
              <p className="text-sm text-ink-muted mb-6">
                Browse our collection and start downloading.
              </p>
              <a
                href="/all"
                className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-medium hover:bg-[#3a3a3a] transition-colors duration-200"
              >
                Browse products
              </a>
            </div>
          )}

          {/* Purchases grid */}
          {!loading && purchases.length > 0 && (
            <div className="flex flex-col gap-4">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex gap-4 p-5 bg-white rounded-2xl border border-border-muted"
                >
                  {/* Thumbnail */}
                  <a href={`/product/${purchase.product_id}`} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={purchase.product_image}
                      alt={purchase.product_title}
                      className="w-20 h-20 rounded-xl object-cover bg-card-hover"
                    />
                  </a>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <a href={`/product/${purchase.product_id}`}>
                      <h3 className="text-sm font-semibold text-ink leading-snug hover:underline underline-offset-2 mb-1 line-clamp-2">
                        {purchase.product_title}
                      </h3>
                    </a>
                    <p className="text-xs text-ink-muted mb-1">Paid {purchase.sale_price}</p>
                    <p className="text-xs text-ink-muted mb-3">Purchased {formatDate(purchase.created_at)}</p>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#134A4F] bg-[#134A4F]/10 px-2.5 py-1 rounded-full">
                        <FileText size={10} strokeWidth={2} />
                        PDF File
                      </span>
                    </div>
                  </div>

                  {/* Download button */}
                  <div className="shrink-0 flex items-center">
                    <button
                      onClick={() => alert("Your file is ready! In production this would download the PDF.")}
                      className="flex items-center gap-2 h-10 px-4 rounded-full bg-ink text-cream text-xs font-semibold hover:bg-[#3a3a3a] active:scale-95 transition-all duration-200 whitespace-nowrap"
                    >
                      <Download size={13} strokeWidth={2} />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
