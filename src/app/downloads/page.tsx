"use client";

import { FileText, ShoppingBag, Download, Palette, ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DownloadButton from "@/components/DownloadButton";
import { usePurchases } from "@/context/PurchasesContext";
import { useAuth } from "@/context/AuthContext";
import { allProducts, getCategoryLabel } from "@/data/products";

const CATEGORY_ORDER = [
  "Worksheets",
  "Coloring",
  "Storybooks",
  "Activities",
  "Flashcards",
  "Party Kits",
  "Scratch Art",
  "Printables",
];


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function DownloadsPage() {
  const { purchases, loading } = usePurchases();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (!user) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-cream flex items-center justify-center px-4">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-card-hover flex items-center justify-center mx-auto mb-4">
              <Download size={28} strokeWidth={1.5} className="text-ink-muted" />
            </div>
            <p className="font-serif text-2xl text-ink mb-2">Sign in to view your library</p>
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

  // Group purchases by category
  const grouped: Record<string, typeof purchases> = {};
  for (const purchase of purchases) {
    const prod = allProducts.find((p) => p.id === purchase.product_id);
    const cat = prod ? getCategoryLabel(prod) : "Printables";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(purchase);
  }

  // Sort categories by defined order; unknowns go last
  const categories = Object.keys(grouped).sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a) ?? 99) - (CATEGORY_ORDER.indexOf(b) ?? 99)
  );

  function toggleCollapse(cat: string) {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink tracking-tight mb-2">
            My Library
          </h1>
          <p className="text-sm text-ink-muted mb-8">
            {loading ? "Loading…" : `${purchases.length} ${purchases.length === 1 ? "purchase" : "purchases"} across ${categories.length} ${categories.length === 1 ? "category" : "categories"}`}
          </p>

          {/* Empty state */}
          {!loading && purchases.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-16 h-16 rounded-full bg-card-hover flex items-center justify-center mb-4">
                <ShoppingBag size={28} strokeWidth={1.5} className="text-ink-muted" />
              </div>
              <p className="font-serif text-2xl text-ink mb-2">No purchases yet</p>
              <p className="text-sm text-ink-muted mb-6">Browse our collection and start downloading.</p>
              <a href="/all" className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-medium hover:bg-[#3a3a3a] transition-colors duration-200">
                Browse products
              </a>
            </div>
          )}

          {/* Grouped by category */}
          {!loading && categories.length > 0 && (
            <div className="flex flex-col gap-6">
              {categories.map((cat) => {
                const items = grouped[cat];
                const isCollapsed = collapsed[cat];

                return (
                  <div key={cat} className="bg-white rounded-2xl border border-border-muted overflow-hidden">
                    {/* Category header */}
                    <button
                      onClick={() => toggleCollapse(cat)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-card-hover transition-colors duration-150 text-left"
                    >
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-ink text-cream">
                        {cat}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {items.length} {items.length === 1 ? "item" : "items"}
                      </span>
                      <ChevronDown
                        size={15}
                        strokeWidth={2}
                        className={`ml-auto text-ink-muted transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                      />
                    </button>

                    {/* Items */}
                    {!isCollapsed && (
                      <div className="divide-y divide-border-muted border-t border-border-muted">
                        {items.map((purchase) => {
                          const prod = allProducts.find((p) => p.id === purchase.product_id);
                          return (
                            <div key={purchase.id} className="flex gap-4 px-5 py-4">
                              {/* Thumbnail — prefer current product data, fall back to purchase snapshot */}
                              <a href={`/product/${purchase.product_id}`} className="shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={prod?.image ?? purchase.product_image}
                                  alt={prod?.title ?? purchase.product_title}
                                  className="w-16 h-16 rounded-xl object-cover bg-card-hover"
                                />
                              </a>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <a href={`/product/${purchase.product_id}`}>
                                  <h3 className="text-sm font-semibold text-ink leading-snug hover:underline underline-offset-2 mb-1 line-clamp-2">
                                    {prod?.title ?? purchase.product_title}
                                  </h3>
                                </a>
                                <p className="text-xs text-ink-muted mb-1">Paid {purchase.sale_price}</p>
                                <p className="text-xs text-ink-muted mb-2">{formatDate(purchase.created_at)}</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#134A4F] bg-[#134A4F]/10 px-2 py-0.5 rounded-full">
                                    <FileText size={9} strokeWidth={2} />
                                    PDF
                                  </span>
                                  {purchase.download_count != null && purchase.download_count > 0 && (
                                    <span className="text-[11px] text-ink-muted">
                                      {purchase.download_count} {purchase.download_count === 1 ? "download" : "downloads"}
                                      {purchase.last_downloaded_at && <> · Last {formatDate(purchase.last_downloaded_at)}</>}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex flex-col gap-2 shrink-0 justify-center">
                                <DownloadButton purchaseId={purchase.id} productTitle={purchase.product_title} />
                                {cat === "Coloring" && prod?.instantDownload && (
                                  <a
                                    href={`/color/${purchase.id}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#134A4F] text-[#134A4F] text-xs font-medium hover:bg-[#134A4F] hover:text-cream transition-colors duration-200 whitespace-nowrap justify-center"
                                  >
                                    <Palette size={12} strokeWidth={1.75} />
                                    Color Online
                                  </a>
                                )}
                                {cat === "Scratch Art" && prod?.instantDownload && (
                                  <a
                                    href={`/scratch/${purchase.id}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#7C3AED] text-[#7C3AED] text-xs font-medium hover:bg-[#7C3AED] hover:text-white transition-colors duration-200 whitespace-nowrap justify-center"
                                  >
                                    <Sparkles size={12} strokeWidth={1.75} />
                                    Scratch Online
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
