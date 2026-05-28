"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, Heart, ShoppingCart, Menu, X, User, TrendingUp, LogOut, ChevronDown, Download, RefreshCw } from "lucide-react";
import UbenLogo from "@/components/UbenLogo";
import { useCategory } from "@/context/CategoryContext";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import { useCurrency, CURRENCIES, type Currency } from "@/context/CurrencyContext";
import { allProducts } from "@/data/products";

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

const DEFAULT_SUGGESTIONS = [
  { label: "Worksheets",    slug: "worksheets",  image: "/images/Alphabet Tracing.png" },
  { label: "Coloring Pages", slug: "coloring",   image: "/images/Under-the-Sea Coloring Book.png" },
  { label: "Storybooks",    slug: "storybooks",  image: "/images/Bedtime Storybook.png" },
  { label: "Flashcards",    slug: "flashcards",  image: "/images/ABC Flash Card Set (26 cards).png" },
  { label: "Activity Packs", slug: "activities", image: "/images/Nature Explorer Activity Book.png" },
  { label: "Party Kits",    slug: "party-kits",  image: "/images/Birthday Party Printable Kit.png" },
];

// ── Search suggestions dropdown ───────────────────────────────────────────────
function SearchDropdown({ query, onClose }: { query: string; onClose: () => void }) {
  const q = query.trim().toLowerCase();
  const { formatPrice } = useCurrency();

  const matchedProducts = q
    ? allProducts
        .filter((p) => p.title.toLowerCase().includes(q) || p.seller.toLowerCase().includes(q))
        .slice(0, 5)
    : [];

  const matchedCategories = q
    ? DEFAULT_SUGGESTIONS.filter((c) => c.label.toLowerCase().includes(q))
    : [];

  const isEmpty = !q;

  function go(href: string) {
    onClose();
    window.location.href = href;
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-border-muted shadow-xl overflow-hidden z-50">

      {/* Default state — popular categories */}
      {isEmpty && (
        <div className="p-3">
          <p className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-ink-muted uppercase flex items-center gap-1.5">
            <TrendingUp size={11} strokeWidth={2.5} />
            Popular searches
          </p>
          {DEFAULT_SUGGESTIONS.map(({ label, slug, image }) => (
            <button
              key={slug}
              onMouseDown={(e) => { e.preventDefault(); go(`/all?category=${slug}`); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-card-hover transition-colors duration-150 text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={label}
                className="w-8 h-8 rounded-lg object-cover bg-card-hover shrink-0"
              />
              <span className="text-sm font-medium text-ink">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Typed state — product + category matches */}
      {!isEmpty && (matchedProducts.length > 0 || matchedCategories.length > 0) && (
        <div className="p-3 space-y-1">
          {/* Category matches */}
          {matchedCategories.map(({ label, slug, image }) => (
            <button
              key={slug}
              onMouseDown={(e) => { e.preventDefault(); go(`/all?category=${slug}`); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-card-hover transition-colors duration-150 text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={label}
                className="w-7 h-7 rounded-lg object-cover bg-card-hover shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="text-[10px] text-ink-muted">Browse category</p>
              </div>
            </button>
          ))}

          {/* Product matches */}
          {matchedProducts.length > 0 && (
            <>
              {matchedCategories.length > 0 && (
                <div className="h-px bg-border-muted my-1" />
              )}
              {matchedProducts.map((product) => (
                <button
                  key={product.id}
                  onMouseDown={(e) => { e.preventDefault(); go(`/product/${product.id}`); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-card-hover transition-colors duration-150 text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-9 h-9 rounded-lg object-cover bg-card-hover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{product.title}</p>
                    <p className="text-[10px] text-ink-muted truncate">{product.seller}</p>
                  </div>
                  <span className="text-xs font-semibold text-sale-green shrink-0">{formatPrice(product.salePrice)}</span>
                </button>
              ))}
            </>
          )}

          {/* Search all results */}
          <div className="h-px bg-border-muted my-1" />
          <button
            onMouseDown={(e) => { e.preventDefault(); go(`/all?search=${encodeURIComponent(query.trim())}`); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-card-hover transition-colors duration-150 text-left"
          >
            <span className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center shrink-0">
              <Search size={13} color="white" strokeWidth={2.5} />
            </span>
            <p className="text-sm font-medium text-ink">
              Search for <span className="font-semibold">&ldquo;{query.trim()}&rdquo;</span>
            </p>
          </button>
        </div>
      )}

      {/* No matches */}
      {!isEmpty && matchedProducts.length === 0 && matchedCategories.length === 0 && (
        <div className="p-3">
          <button
            onMouseDown={(e) => { e.preventDefault(); go(`/all?search=${encodeURIComponent(query.trim())}`); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-card-hover transition-colors duration-150 text-left"
          >
            <span className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center shrink-0">
              <Search size={13} color="white" strokeWidth={2.5} />
            </span>
            <p className="text-sm font-medium text-ink">
              Search for <span className="font-semibold">&ldquo;{query.trim()}&rdquo;</span>
            </p>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Category strip ─────────────────────────────────────────────────────────────
function CategoryStrip({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const { active, setActive } = useCategory();
  const { currency, setCurrency } = useCurrency();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSlug = pathname === "/all" ? (searchParams.get("category") ?? "") : "";

  return (
    <>
      {/* Desktop category strip */}
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

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-b border-border-muted bg-cream">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-[11px] font-bold tracking-widest text-ink uppercase">
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

// ── Navbar ─────────────────────────────────────────────────────────────────────
export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen2, setMobileOpen2] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { cartCount } = useCart();
  const { favoriteCount } = useFavorites();
  const { user, signOut } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencyDesktopRef = useRef<HTMLDivElement>(null);
  const currencyMobileRef = useRef<HTMLDivElement>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const currentCurrency = CURRENCIES.find((c) => c.code === currency)!;

  function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setDesktopOpen(false);
    setMobileOpen2(false);
    window.location.href = `/all?search=${encodeURIComponent(q)}`;
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (desktopRef.current && !desktopRef.current.contains(e.target as Node)) {
        setDesktopOpen(false);
      }
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) {
        setMobileOpen2(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      const inDesktop = currencyDesktopRef.current?.contains(e.target as Node);
      const inMobile  = currencyMobileRef.current?.contains(e.target as Node);
      if (!inDesktop && !inMobile) setCurrencyOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-cream">

      {/* ── Row 1: Logo · Search · Auth ── */}
      <div className="max-w-7xl mx-auto px-6 h-[68px] flex items-center gap-3">

        {/* Logo */}
        <a href="/" className="shrink-0 mr-1" aria-label="Uben — home">
          <UbenLogo variant="dark" size={34} />
        </a>

        {/* Desktop search bar with dropdown */}
        <div ref={desktopRef} className="hidden md:flex relative flex-1 min-w-0">
          <div
            className={[
              "w-full flex items-center bg-white rounded-full transition-all duration-200",
              desktopOpen
                ? "border border-brand/60 shadow-[0_0_0_3px_rgba(184,135,58,0.10)]"
                : "border border-border-muted",
            ].join(" ")}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setDesktopOpen(true)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search printables, worksheets, activity packs…"
              className="flex-1 min-w-0 bg-transparent text-[13.5px] text-ink placeholder:text-ink-muted outline-none px-3 py-[10px]"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setDesktopOpen(true); }}
                className="shrink-0 p-2 mr-1 text-ink-muted hover:text-ink transition-colors duration-200"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            )}
            <button
              type="button"
              onClick={handleSearch}
              className="shrink-0 flex items-center gap-1.5 h-8 px-4 m-1 rounded-full bg-transparent text-ink text-[12.5px] font-medium hover:bg-ink hover:text-cream active:scale-95 transition-all duration-150 whitespace-nowrap"
            >
              <Search size={12} strokeWidth={2.5} />
              Search
            </button>
          </div>
          {desktopOpen && (
            <SearchDropdown query={query} onClose={() => setDesktopOpen(false)} />
          )}
        </div>

        {/* Auth — desktop */}
        <nav className="hidden md:flex items-center shrink-0 gap-0.5">
          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium text-ink rounded-full hover:bg-card-hover transition-colors duration-200"
              >
                <div className="w-6 h-6 rounded-full bg-ink text-cream flex items-center justify-center text-[11px] font-bold shrink-0">
                  {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
                </div>
                <span className="max-w-[100px] truncate">{user.user_metadata?.full_name || user.email?.split("@")[0]}</span>
                <ChevronDown size={12} strokeWidth={2.5} className={`transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-border-muted shadow-xl overflow-hidden z-[60]">
                  <div className="px-4 py-3 border-b border-border-muted">
                    <p className="text-xs font-semibold text-ink truncate">{user.user_metadata?.full_name || "My Account"}</p>
                    <p className="text-[11px] text-ink-muted truncate">{user.email}</p>
                  </div>
                  <a
                    href="/downloads"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-ink hover:bg-card-hover transition-colors duration-150"
                  >
                    <Download size={14} strokeWidth={1.75} />
                    My Downloads
                  </a>
                  <div className="h-px bg-border-muted" />
                  <button
                    onClick={() => { setUserMenuOpen(false); signOut(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-ink hover:bg-card-hover transition-colors duration-150"
                  >
                    <LogOut size={14} strokeWidth={1.75} />
                    Sign out
                  </button>
                  <button
                    onClick={async () => {
                      setUserMenuOpen(false);
                      const { createClient: makeClient } = await import("@/lib/supabase/client");
                      await makeClient().auth.signOut();
                      window.location.href = "/signin";
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-ink-muted hover:bg-card-hover hover:text-ink transition-colors duration-150"
                  >
                    <RefreshCw size={14} strokeWidth={1.75} />
                    Switch account
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a href="/signin" className="flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-medium text-ink rounded-full hover:bg-card-hover transition-colors duration-200 whitespace-nowrap">
              <User size={14} strokeWidth={1.75} />
              Sign in
            </a>
          )}
          {/* Currency picker */}
          <div ref={currencyDesktopRef} className="relative">
            <button
              onClick={() => setCurrencyOpen(!currencyOpen)}
              className="flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium text-ink rounded-full hover:bg-card-hover transition-colors duration-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://flagcdn.com/20x15/${currentCurrency.flagCode}.png`} alt={currentCurrency.label} width={20} height={15} className="rounded-sm shrink-0" />
              <span>{currentCurrency.label}</span>
              <span className="text-ink-muted">{currentCurrency.symbol}</span>
              <ChevronDown size={11} strokeWidth={2.5} className={`transition-transform duration-200 ${currencyOpen ? "rotate-180" : ""}`} />
            </button>
            {currencyOpen && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-2xl border border-border-muted shadow-xl overflow-hidden z-50">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => { setCurrency(c.code as Currency); setCurrencyOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors duration-150 ${
                      currency === c.code ? "bg-card-hover font-semibold text-ink" : "text-ink-muted hover:bg-card-hover hover:text-ink"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://flagcdn.com/20x15/${c.flagCode}.png`} alt={c.label} width={20} height={15} className="rounded-sm shrink-0" />
                    <span>{c.label}</span>
                    <span className="ml-auto text-xs text-ink-muted">{c.symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
        <div className="flex md:hidden items-center shrink-0 gap-0.5 ml-auto">
          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-ink text-cream text-[11px] font-bold hover:bg-[#3a3a3a] transition-colors duration-200"
              >
                {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-border-muted shadow-xl overflow-hidden z-[60]">
                  <div className="px-4 py-3 border-b border-border-muted">
                    <p className="text-xs font-semibold text-ink truncate">{user.user_metadata?.full_name || "My Account"}</p>
                    <p className="text-[11px] text-ink-muted truncate">{user.email}</p>
                  </div>
                  <a
                    href="/downloads"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-ink hover:bg-card-hover transition-colors duration-150"
                  >
                    <Download size={14} strokeWidth={1.75} />
                    My Downloads
                  </a>
                  <div className="h-px bg-border-muted" />
                  <button
                    onClick={() => { setUserMenuOpen(false); signOut(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-ink hover:bg-card-hover transition-colors duration-150"
                  >
                    <LogOut size={14} strokeWidth={1.75} />
                    Sign out
                  </button>
                  <button
                    onClick={async () => {
                      setUserMenuOpen(false);
                      const { createClient: makeClient } = await import("@/lib/supabase/client");
                      await makeClient().auth.signOut();
                      window.location.href = "/signin";
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-ink-muted hover:bg-card-hover hover:text-ink transition-colors duration-150"
                  >
                    <RefreshCw size={14} strokeWidth={1.75} />
                    Switch account
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a href="/signin" className="flex items-center gap-1 h-8 px-3 text-[12px] font-medium text-ink rounded-full hover:bg-card-hover transition-colors duration-200 whitespace-nowrap">
              <User size={13} strokeWidth={1.75} />
              Sign in
            </a>
          )}
          {/* Mobile currency picker */}
          <div ref={currencyMobileRef} className="relative">
            <button
              onClick={() => setCurrencyOpen(!currencyOpen)}
              className="flex items-center gap-1 h-8 px-2 rounded-full hover:bg-card-hover transition-colors duration-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://flagcdn.com/20x15/${currentCurrency.flagCode}.png`} alt={currentCurrency.label} width={18} height={13} className="rounded-sm" />
              <ChevronDown size={10} strokeWidth={2.5} className={`text-ink-muted transition-transform duration-200 ${currencyOpen ? "rotate-180" : ""}`} />
            </button>
            {currencyOpen && (
              <div className="absolute right-0 top-full mt-2 w-36 bg-white rounded-2xl border border-border-muted shadow-xl overflow-hidden z-50">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => { setCurrency(c.code as Currency); setCurrencyOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors duration-150 ${
                      currency === c.code ? "bg-card-hover font-semibold text-ink" : "text-ink-muted hover:bg-card-hover hover:text-ink"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://flagcdn.com/20x15/${c.flagCode}.png`} alt={c.label} width={20} height={15} className="rounded-sm shrink-0" />
                    <span>{c.label}</span>
                    <span className="ml-auto text-xs text-ink-muted">{c.symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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

      {/* ── Mobile search row with dropdown ── */}
      <div ref={mobileRef} className="md:hidden px-4 pb-3 relative">
        <div
          className={[
            "flex items-center bg-white rounded-full transition-all duration-200",
            mobileOpen2
              ? "border border-brand/60 shadow-[0_0_0_3px_rgba(184,135,58,0.10)]"
              : "border border-border-muted",
          ].join(" ")}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setMobileOpen2(true)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search products…"
            className="flex-1 min-w-0 bg-transparent text-[13.5px] text-ink placeholder:text-ink-muted outline-none px-4 py-2.5"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setMobileOpen2(true); }}
              className="shrink-0 p-2 text-ink-muted hover:text-ink transition-colors duration-200"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          )}
          <button
            type="button"
            onClick={handleSearch}
            className="shrink-0 flex items-center justify-center w-9 h-9 m-1 rounded-full bg-ink text-cream hover:bg-[#3a3a3a] active:scale-95 transition-all duration-150"
          >
            <Search size={14} strokeWidth={2.5} />
          </button>
        </div>
        {mobileOpen2 && (
          <SearchDropdown query={query} onClose={() => setMobileOpen2(false)} />
        )}
      </div>

      {/* Category strip + mobile drawer */}
      <Suspense fallback={<div className="h-10 border-t border-border-muted" />}>
        <CategoryStrip mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      </Suspense>

      <div className="border-b border-border-muted" />
    </header>
  );
}
