"use client";

import { useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, Heart, ShoppingCart, Menu, X, User, ChevronDown } from "lucide-react";
import UbenLogo from "@/components/UbenLogo";
import { useCategory } from "@/context/CategoryContext";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";

const categories = [
  { label: "Printables",  slug: "printables"  },
  { label: "Worksheets",  slug: "worksheets"  },
  { label: "Coloring",    slug: "coloring"    },
  { label: "Activities",  slug: "activities"  },
  { label: "Storybooks",  slug: "storybooks"  },
  { label: "Flashcards",  slug: "flashcards"  },
  { label: "Party Kits",  slug: "party-kits"  },
  { label: "Classroom",   slug: "classroom"   },
  { label: "Holiday",     slug: "holiday",    badge: "New" },
];

// Isolated component so useSearchParams gets its own Suspense boundary
function CategoryStrip({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const { active, setActive } = useCategory();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSlug = pathname === "/all" ? (searchParams.get("category") ?? "") : "";

  return (
    <>
      {/* ── Row 2: Category strip — desktop ── */}
      <div className="hidden md:block border-t border-border-muted">
        <div className="max-w-7xl mx-auto px-6">
          <ul className="flex items-center gap-1 h-10">
            {categories.map(({ label, slug, badge }) => {
              const isActive = currentSlug === slug || (currentSlug === "" && active === label);
              return (
                <li key={label}>
                  <a
                    href={`/all?category=${slug}`}
                    onClick={() => setActive(label)}
                    className={[
                      "relative flex items-center gap-1.5 px-3 h-7 rounded-full text-[13px] transition-colors duration-200 whitespace-nowrap",
                      isActive
                        ? "font-semibold text-ink"
                        : "font-medium text-ink-muted hover:text-ink hover:bg-card-hover",
                    ].join(" ")}
                  >
                    {label}
                    {badge && (
                      <span className="px-1.5 py-px rounded text-[9px] font-bold tracking-wide bg-red-100 text-red-600">
                        {badge}
                      </span>
                    )}
                    <span
                      className="absolute bottom-0 left-2 right-2 h-[2px] bg-ink rounded-full origin-center transition-transform duration-200"
                      style={{ transform: isActive ? "scaleX(1)" : "scaleX(0)" }}
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden border-b border-border-muted bg-cream">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-0.5">
            <button className="flex items-center gap-2.5 px-3 py-3 text-sm font-medium text-ink rounded-xl hover:bg-card-hover transition-colors duration-200 text-left">
              <User size={15} strokeWidth={1.75} />
              Sign in
            </button>
            <div className="my-2 h-px bg-border-muted" />
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-widest text-ink-muted uppercase">
              Browse
            </p>
            {categories.map(({ label, slug, badge }) => (
              <a
                key={label}
                href={`/all?category=${slug}`}
                onClick={() => { setActive(label); setMobileOpen(false); }}
                className="flex items-center justify-between px-3 py-2.5 text-sm text-ink-muted rounded-xl hover:bg-card-hover hover:text-ink transition-colors duration-200"
              >
                {label}
                {badge && (
                  <span className="px-1.5 py-px rounded text-[10px] font-bold bg-red-100 text-red-600">
                    {badge}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const { cartCount } = useCart();
  const { favoriteCount } = useFavorites();

  function handleSearch() {
    const q = query.trim();
    if (!q) return;
    window.location.href = `/all?search=${encodeURIComponent(q)}`;
  }

  return (
    <header className="sticky top-0 z-50 bg-cream">

      {/* ── Row 1: Logo · Search · Auth ── */}
      <div className="max-w-7xl mx-auto px-6 h-[68px] flex items-center gap-3">

        {/* Logo */}
        <a href="/" className="shrink-0 mr-1" aria-label="Uben — home">
          <UbenLogo variant="dark" size={34} />
        </a>

        {/* Browse pill */}
        <button className="hidden lg:flex items-center gap-1.5 shrink-0 h-9 px-4 rounded-full border border-border-muted text-[13px] font-medium text-ink hover:bg-card-hover transition-colors duration-200">
          Browse
          <ChevronDown size={12} strokeWidth={2.5} />
        </button>

        {/* Search bar */}
        <div
          className={[
            "flex-1 flex items-center min-w-0 bg-white rounded-full transition-all duration-200",
            focused
              ? "border border-brand/60 shadow-[0_0_0_3px_rgba(184,135,58,0.10)]"
              : "border border-border-muted",
          ].join(" ")}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search printables, worksheets, activity packs…"
            className="flex-1 min-w-0 bg-transparent text-[13.5px] text-ink placeholder:text-ink-muted outline-none px-3 py-[10px]"
          />
          <div className="hidden xl:flex items-center shrink-0 pr-1">
            <div className="w-px h-4 bg-border-muted mr-2" />
            <button className="flex items-center gap-1 text-[12px] font-medium text-ink-muted hover:text-ink transition-colors duration-200 px-2 py-1 rounded-full hover:bg-card-hover whitespace-nowrap">
              All categories
              <ChevronDown size={11} strokeWidth={2.5} />
            </button>
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="shrink-0 flex items-center gap-1.5 h-8 px-4 m-1 rounded-full bg-transparent text-ink text-[12.5px] font-medium hover:bg-ink hover:text-cream active:scale-95 transition-all duration-150 whitespace-nowrap"
          >
            <Search size={12} strokeWidth={2.5} />
            Search
          </button>
        </div>

        {/* Auth — desktop */}
        <nav className="hidden md:flex items-center shrink-0 gap-0.5">
          <button className="flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-medium text-ink rounded-full hover:bg-card-hover transition-colors duration-200 whitespace-nowrap">
            <User size={14} strokeWidth={1.75} />
            Sign in
          </button>
          <div className="w-px h-4 bg-border-muted mx-1" />
          <div className="relative group">
            <a href="/favorites" className="relative p-2.5 text-ink rounded-full hover:bg-card-hover transition-colors duration-200 flex items-center justify-center">
              <Heart size={17} strokeWidth={1.75} />
              {favoriteCount > 0 && (
                <span className="absolute top-[5px] right-[5px] min-w-[14px] h-[14px] rounded-full bg-red-500 flex items-center justify-center text-white text-[9px] font-bold leading-none px-[3px]">
                  {favoriteCount}
                </span>
              )}
            </a>
            <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-ink text-cream text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              Favorites
            </span>
          </div>
          <div className="relative group">
            <a href="/cart" className="relative p-2.5 text-ink rounded-full hover:bg-card-hover transition-colors duration-200 flex items-center justify-center">
              <ShoppingCart size={17} strokeWidth={1.75} />
              {cartCount > 0 && (
                <span className="absolute top-[5px] right-[5px] min-w-[14px] h-[14px] rounded-full bg-red-500 flex items-center justify-center text-white text-[9px] font-bold leading-none px-[3px]">
                  {cartCount}
                </span>
              )}
            </a>
            <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 rounded-md bg-ink text-cream text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              Cart
            </span>
          </div>
        </nav>

        {/* Mobile icons */}
        <div className="flex md:hidden items-center shrink-0 gap-0.5">
          <a href="/favorites" className="relative p-2 text-ink rounded-full hover:bg-card-hover transition-colors duration-200 flex items-center justify-center">
            <Heart size={17} strokeWidth={1.75} />
            {favoriteCount > 0 && (
              <span className="absolute top-[3px] right-[3px] w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center text-white text-[8px] font-bold">
                {favoriteCount}
              </span>
            )}
          </a>
          <a href="/cart" className="relative p-2 text-ink rounded-full hover:bg-card-hover transition-colors duration-200 flex items-center justify-center">
            <ShoppingCart size={17} strokeWidth={1.75} />
            {cartCount > 0 && (
              <span className="absolute top-[3px] right-[3px] w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center text-white text-[8px] font-bold">
                {cartCount}
              </span>
            )}
          </a>
          <button
            className="p-2 text-ink rounded-full hover:bg-card-hover transition-colors duration-200"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {/* Category strip + mobile drawer — wrapped in Suspense for useSearchParams */}
      <Suspense fallback={<div className="h-10 border-t border-border-muted" />}>
        <CategoryStrip mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      </Suspense>

      <div className="border-b border-border-muted" />
    </header>
  );
}
