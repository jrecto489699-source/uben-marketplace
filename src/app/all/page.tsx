"use client";

import { useState } from "react";
import { Star, SlidersHorizontal, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { allProducts, printableProducts, classroomProducts, type Product } from "@/data/products";

const CATEGORY_SETS: Record<string, Product[]> = {
  all: allProducts,
  printables: printableProducts,
  classroom: classroomProducts,
};

const FILTERS = ["On sale", "Uben's Picks", "Instant Download", "Under $5"];

function discountPct(sale: string, original: string) {
  const s = parseFloat(sale.replace(/[^0-9.]/g, ""));
  const o = parseFloat(original.replace(/[^0-9.]/g, ""));
  if (!o) return null;
  return Math.round((1 - s / o) * 100);
}

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function AllProductsPage() {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("Relevancy");

  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const categoryKey = params?.get("category") ?? "all";
  const products = CATEGORY_SETS[categoryKey] ?? allProducts;

  const pageTitle =
    categoryKey === "printables"
      ? "Printable Downloads"
      : categoryKey === "classroom"
      ? "Classroom Picks"
      : "All Products";

  function toggleFilter(f: string) {
    setActiveFilters((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }

  const displayed =
    activeFilters.includes("On sale") ? products : products;

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-10">
          {/* Page title */}
          <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink tracking-tight text-center mb-8">
            {pageTitle}
          </h1>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mb-8">
            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none pl-4 pr-8 py-2 rounded-full border border-border-muted text-sm text-ink bg-cream cursor-pointer hover:border-ink transition-colors duration-200 focus:outline-none"
              >
                <option>Relevancy</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Most Popular</option>
                <option>Newest</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted text-xs">▾</span>
            </div>

            {/* Filter chips */}
            {FILTERS.map((f) => {
              const active = activeFilters.includes(f);
              return (
                <button
                  key={f}
                  onClick={() => toggleFilter(f)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-colors duration-200 ${
                    active
                      ? "bg-ink text-cream border-ink"
                      : "bg-cream text-ink border-border-muted hover:border-ink"
                  }`}
                >
                  {f}
                  {active && <X size={12} strokeWidth={2.5} />}
                </button>
              );
            })}

            <button className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border-muted text-sm text-ink hover:border-ink transition-colors duration-200">
              <SlidersHorizontal size={14} />
              Filters
            </button>
          </div>

          {/* Result count */}
          <p className="text-xs text-ink-muted mb-6">
            {displayed.length} results
          </p>

          {/* Product grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
            {displayed.map((product) => {
              const pct = discountPct(product.salePrice, product.originalPrice);
              return (
                <article key={product.id} className="group cursor-pointer">
                  {/* Image */}
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-card-hover mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.image}
                      alt={product.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-105"
                    />
                    {pct && (
                      <span className="absolute top-2 left-2 bg-sale-green text-cream text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        {pct}% off
                      </span>
                    )}
                  </div>

                  {/* Meta */}
                  <div>
                    <p className="text-xs text-ink-muted mb-0.5 truncate">{product.seller}</p>
                    <h3 className="text-sm font-medium text-ink leading-snug line-clamp-2 group-hover:underline underline-offset-2 transition-all duration-200 mb-1">
                      {product.title}
                    </h3>

                    {/* Rating */}
                    {product.rating && (
                      <div className="flex items-center gap-1 mb-1">
                        <Star size={11} className="fill-[#D4A017] text-[#D4A017]" strokeWidth={0} />
                        <span className="text-xs font-semibold text-ink">{product.rating.toFixed(1)}</span>
                        <span className="text-xs text-ink-muted">({formatCount(product.reviewCount ?? 0)})</span>
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-sale-green">{product.salePrice}</span>
                      <span className="text-xs text-ink-muted line-through">{product.originalPrice}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
