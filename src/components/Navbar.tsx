"use client";

import { useState } from "react";
import { Search, Heart, ShoppingCart, Menu, X, User, ChevronDown } from "lucide-react";
import UbenLogo from "@/components/UbenLogo";
import { useCategory } from "@/context/CategoryContext";

const categories = [
  { label: "Printables" },
  { label: "Worksheets" },
  { label: "Coloring" },
  { label: "Activities" },
  { label: "Storybooks" },
  { label: "Flashcards" },
  { label: "Party Kits" },
  { label: "Classroom" },
  { label: "Holiday", badge: "New" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const { active, setActive } = useCategory();

  return (
    <header className="sticky top-0 z-50 bg-cream">

      {/* ── Row 1: Logo · Search · Auth ── */}
      <div className="max-w-7xl mx-auto px-6 h-[68px] flex items-center gap-3">

        {/* Logo */}
        <a href="/" className="shrink-0 mr-1" aria-label="Uben — home">
          <UbenLogo variant="dark" size={34} />
        </a>

        {/* Browse pill — desktop */}
        <button className="hidden lg:flex items-center gap-1.5 shrink-0 h-9 px-4 rounded-full border border-border-muted text-[13px] font-medium text-ink hover:bg-card-hover transition-colors duration-200">
          Browse
          <ChevronDown size={12} strokeWidth={2.5} />
        </button>

        {/* ── Search bar ── */}
        <div
          className={[
            "flex-1 flex items-center min-w-0 bg-white rounded-full transition-all duration-200",
            focused
              ? "border border-brand/60 shadow-[0_0_0_3px_rgba(184,135,58,0.10)]"
              : "border border-border-muted",
          ].join(" ")}
        >
          {/* Left search icon */}
          <Search
            size={15}
            strokeWidth={2}
            className="shrink-0 ml-4 text-ink-muted"
          />

          {/* Input */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search printables, worksheets, activity packs…"
            className="flex-1 min-w-0 bg-transparent text-[13.5px] text-ink placeholder:text-ink-muted outline-none px-3 py-[10px]"
          />

          {/* Category filter — visible on xl */}
          <div className="hidden xl:flex items-center shrink-0 pr-1">
            <div className="w-px h-4 bg-border-muted mr-2" />
            <button className="flex items-center gap-1 text-[12px] font-medium text-ink-muted hover:text-ink transition-colors duration-200 px-2 py-1 rounded-full hover:bg-card-hover whitespace-nowrap">
              All categories
              <ChevronDown size={11} strokeWidth={2.5} />
            </button>
          </div>

          {/* Search button */}
          <button
            type="submit"
            className="shrink-0 flex items-center gap-1.5 h-8 px-4 m-1 rounded-full bg-transparent text-ink text-[12.5px] font-medium hover:bg-ink hover:text-cream active:scale-95 transition-all duration-150 whitespace-nowrap"
          >
            <Search size={12} strokeWidth={2.5} />
            Search
          </button>
        </div>

        {/* ── Auth actions — desktop ── */}
        <nav className="hidden md:flex items-center shrink-0 gap-0.5">
          <button className="flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-medium text-ink rounded-full hover:bg-card-hover transition-colors duration-200 whitespace-nowrap">
            <User size={14} strokeWidth={1.75} />
            Sign in
          </button>

          <div className="w-px h-4 bg-border-muted mx-1" />

          <button className="p-2.5 text-ink rounded-full hover:bg-card-hover transition-colors duration-200">
            <Heart size={17} strokeWidth={1.75} />
          </button>

          {/* Cart with item count */}
          <button className="relative p-2.5 text-ink rounded-full hover:bg-card-hover transition-colors duration-200">
            <ShoppingCart size={17} strokeWidth={1.75} />
            <span className="absolute top-[5px] right-[5px] min-w-[14px] h-[14px] rounded-full bg-red-500 flex items-center justify-center text-white text-[9px] font-bold leading-none px-[3px]">
              3
            </span>
          </button>
        </nav>

        {/* ── Mobile: compact icons + hamburger ── */}
        <div className="flex md:hidden items-center shrink-0 gap-0.5">
          <button className="p-2 text-ink rounded-full hover:bg-card-hover transition-colors duration-200">
            <Heart size={17} strokeWidth={1.75} />
          </button>
          <button className="relative p-2 text-ink rounded-full hover:bg-card-hover transition-colors duration-200">
            <ShoppingCart size={17} strokeWidth={1.75} />
            <span className="absolute top-[3px] right-[3px] w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center text-white text-[8px] font-bold">
              3
            </span>
          </button>
          <button
            className="p-2 text-ink rounded-full hover:bg-card-hover transition-colors duration-200"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {/* ── Row 2: Category strip — desktop ── */}
      <div className="hidden md:block border-t border-border-muted">
        <div className="max-w-7xl mx-auto px-6">
          <ul className="flex items-center gap-1 h-10">
            {categories.map(({ label, badge }) => {
              const isActive = active === label;
              return (
                <li key={label}>
                  <button
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
                    {/* Bottom line indicator */}
                    <span
                      className="absolute bottom-0 left-2 right-2 h-[2px] bg-ink rounded-full origin-center transition-transform duration-200"
                      style={{ transform: isActive ? "scaleX(1)" : "scaleX(0)" }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Bottom border line */}
      <div className="border-b border-border-muted" />

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
            {categories.map(({ label, badge }) => (
              <a
                key={label}
                href="#"
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
    </header>
  );
}
