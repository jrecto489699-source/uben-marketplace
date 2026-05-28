"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Star, SlidersHorizontal, X, Heart } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useFavorites } from "@/context/FavoritesContext";
import { useCurrency } from "@/context/CurrencyContext";
import {
  allProducts, printableProducts, classroomProducts,
  worksheetProducts, coloringProducts, storybookProducts,
  activityProducts, flashcardProducts, partyKitProducts,
  type Product,
} from "@/data/products";

const CATEGORY_SETS: Record<string, Product[]> = {
  all:        allProducts,
  printables: printableProducts,
  worksheets: worksheetProducts,
  coloring:   coloringProducts,
  storybooks: storybookProducts,
  activities: activityProducts,
  flashcards: flashcardProducts,
  "party-kits": partyKitProducts,
  classroom:  classroomProducts,
};

const SORT_OPTIONS = [
  "Relevancy",
  "Price: Low to High",
  "Price: High to Low",
  "Most Popular",
  "Newest",
] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function parsePrice(str: string) {
  return parseFloat(str.replace(/[^0-9.]/g, "")) || 0;
}

function discountPct(sale: string, original: string) {
  const s = parsePrice(sale);
  const o = parsePrice(original);
  if (!o) return null;
  return Math.round((1 - s / o) * 100);
}

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function applyFilters(products: Product[], filters: string[]): Product[] {
  let result = [...products];
  if (filters.includes("On sale"))          result = result.filter((p) => p.onSale);
  if (filters.includes("Uben's Picks"))     result = result.filter((p) => (p.rating ?? 0) >= 4.8);
  if (filters.includes("Instant Download")) result = result.filter((p) => p.instantDownload);
  if (filters.includes("Under $5"))         result = result.filter((p) => parsePrice(p.salePrice) <= 5);
  return result;
}

function applySort(products: Product[], sort: SortOption): Product[] {
  const arr = [...products];
  switch (sort) {
    case "Price: Low to High":  return arr.sort((a, b) => parsePrice(a.salePrice) - parsePrice(b.salePrice));
    case "Price: High to Low":  return arr.sort((a, b) => parsePrice(b.salePrice) - parsePrice(a.salePrice));
    case "Most Popular":        return arr.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    case "Newest":              return arr.sort((a, b) => b.id - a.id);
    default:                    return arr;
  }
}

// ── Inner component (needs useSearchParams → must be inside Suspense) ──────────
function ProductGrid() {
  const searchParams = useSearchParams();
  const categoryKey = searchParams.get("category") ?? "all";
  const searchQuery = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const baseProducts = CATEGORY_SETS[categoryKey] ?? allProducts;

  const PAGE_TITLES: Record<string, string> = {
    printables:   "Printable Downloads",
    worksheets:   "Worksheets",
    coloring:     "Coloring Books & Pages",
    storybooks:   "Storybooks",
    activities:   "Activities",
    flashcards:   "Flashcards",
    "party-kits": "Party Kits",
    classroom:    "Top Classroom Picks",
  };
  const pageTitle = searchQuery
    ? `Results for "${searchParams.get("search")}"`
    : (PAGE_TITLES[categoryKey] ?? "All Products");

  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("Relevancy");
  const { toggleFavorite, isFavorited } = useFavorites();
  const { formatPrice } = useCurrency();

  function toggleFilter(f: string) {
    setActiveFilters((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }

  const searchFiltered = useMemo(() => {
    if (!searchQuery) return baseProducts;
    return allProducts.filter(
      (p) =>
        p.title.toLowerCase().includes(searchQuery) ||
        p.seller.toLowerCase().includes(searchQuery)
    );
  }, [baseProducts, searchQuery]);

  const displayed = useMemo(
    () => applySort(applyFilters(searchFiltered, activeFilters), sortBy),
    [searchFiltered, activeFilters, sortBy]
  );

  const FILTERS = ["On sale", "Uben's Picks", "Instant Download", "Under $5"];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Page title */}
      <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink tracking-tight text-center mb-8">
        {pageTitle}
      </h1>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {/* Sort */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="appearance-none pl-4 pr-8 py-2 rounded-full border border-border-muted text-sm text-ink bg-cream cursor-pointer hover:border-ink transition-colors duration-200 focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
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

        {activeFilters.length > 0 && (
          <button
            onClick={() => setActiveFilters([])}
            className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink transition-colors duration-200 ml-1"
          >
            Clear all
          </button>
        )}

        <button className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border-muted text-sm text-ink hover:border-ink transition-colors duration-200">
          <SlidersHorizontal size={14} />
          Filters
        </button>
      </div>

      {/* Result count */}
      <p className="text-xs text-ink-muted mb-6">
        {displayed.length} {displayed.length === 1 ? "result" : "results"}
        {searchQuery && <span className="ml-1">· searching across all products</span>}
        {activeFilters.length > 0 && !searchQuery && (
          <span className="ml-1">· filtered from {baseProducts.length}</span>
        )}
      </p>

      {/* Empty state */}
      {displayed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-serif text-2xl text-ink mb-2">No products found</p>
          <p className="text-sm text-ink-muted mb-6">
            {searchQuery
              ? `No results for "${searchParams.get("search")}". Try a different search term.`
              : "Try removing a filter to see more results."}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setActiveFilters([])}
              className="px-6 py-2.5 rounded-full bg-ink text-cream text-sm font-medium hover:bg-[#3a3a3a] transition-colors duration-200"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {displayed.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
          {displayed.map((product) => {
            const pct = discountPct(product.salePrice, product.originalPrice);
            return (
              <a key={product.id} href={`/product/${product.id}`} className="group cursor-pointer block">
                <div className="relative aspect-square rounded-xl overflow-hidden bg-card-hover mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.image}
                    alt={product.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-105"
                  />
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
                  <button
                    onClick={(e) => { e.preventDefault(); toggleFavorite(product.id); }}
                    className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 hover:bg-white hover:scale-110"
                    aria-label="Save to favorites"
                  >
                    <Heart
                      size={14}
                      strokeWidth={1.75}
                      className={isFavorited(product.id) ? "fill-red-500 text-red-500" : "text-ink"}
                    />
                  </button>
                </div>

                <div>
                  <p className="text-xs text-ink-muted mb-0.5 truncate">{product.seller}</p>
                  <h3 className="text-sm font-medium text-ink leading-snug line-clamp-2 group-hover:underline underline-offset-2 transition-all duration-200 mb-1">
                    {product.title}
                  </h3>
                  {product.rating && (
                    <div className="flex items-center gap-1 mb-1">
                      <Star size={11} className="fill-[#D4A017] text-[#D4A017]" strokeWidth={0} />
                      <span className="text-xs font-semibold text-ink">{product.rating.toFixed(1)}</span>
                      <span className="text-xs text-ink-muted">({formatCount(product.reviewCount ?? 0)})</span>
                    </div>
                  )}
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-sale-green">{formatPrice(product.salePrice)}</span>
                    <span className="text-xs text-ink-muted line-through">{formatPrice(product.originalPrice)}</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page shell — Suspense required for useSearchParams ─────────────────────────
export default function AllProductsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <Suspense fallback={
          <div className="max-w-7xl mx-auto px-6 py-24 text-center">
            <p className="text-sm text-ink-muted">Loading products…</p>
          </div>
        }>
          <ProductGrid />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
