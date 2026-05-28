"use client";

import { notFound } from "next/navigation";
import { use, useState } from "react";
import { Star, Heart, ShoppingCart, Download, ChevronRight, Check, FileText, Infinity, Shield, LibraryBig } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getProductById, getRelatedProducts, getCategoryLabel } from "@/data/products";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import { usePurchases } from "@/context/PurchasesContext";
import { useCurrency } from "@/context/CurrencyContext";
import AuthModal from "@/components/AuthModal";
import InstantCheckoutModal from "@/components/InstantCheckoutModal";

function discountPct(sale: string, original: string) {
  const s = parseFloat(sale.replace(/[^0-9.]/g, ""));
  const o = parseFloat(original.replace(/[^0-9.]/g, ""));
  if (!o) return null;
  return Math.round((1 - s / o) * 100);
}

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

const TAGS_BY_CATEGORY: Record<string, string[]> = {
  Worksheets:  ["Ages 3–8", "K–2", "Printable PDF", "Instant Download"],
  Coloring:    ["Ages 4–10", "Creativity", "Printable PDF", "Instant Download"],
  Storybooks:  ["Ages 3–7", "Read-Aloud", "Printable PDF"],
  Activities:  ["Ages 4–9", "Educational", "Printable PDF", "Instant Download"],
  Flashcards:  ["Ages 3–7", "Literacy", "Printable PDF", "Instant Download"],
  "Party Kits":["Ages 3–10", "Celebration", "Printable PDF", "Instant Download"],
  Printables:  ["Ages 3–8", "Educational", "Printable PDF"],
};

const DESCRIPTION_BY_CATEGORY: Record<string, string> = {
  Worksheets:  "A beautifully designed, print-ready worksheet pack perfect for early learners. Each page is crafted to build foundational skills in a fun, engaging way — ideal for home learning, classroom use, or supplementary practice.",
  Coloring:    "A vibrant, print-ready coloring pack filled with charming illustrations that spark creativity and imagination. Perfect for quiet time, classroom art sessions, or rainy-day activities.",
  Storybooks:  "An enchanting printable storybook designed to inspire a love of reading in young children. Rich illustrations and age-appropriate language make it perfect for bedtime stories or read-aloud sessions.",
  Activities:  "An engaging activity pack packed with hands-on learning experiences. Designed to make education feel like play, with curriculum-aligned content that parents and teachers love.",
  Flashcards:  "A comprehensive flashcard set designed to build vocabulary, recognition, and memory skills. Bright visuals and clear text make learning intuitive and effective for early learners.",
  "Party Kits":"A complete printable party kit packed with everything you need for an unforgettable celebration. Just download, print, and delight — no running to the store required.",
  Printables:  "A carefully designed printable resource that makes learning at home or in the classroom easy, beautiful, and effective.",
};

const WHATS_INCLUDED: Record<string, string[]> = {
  Worksheets:  ["Multiple practice pages (PDF format)", "Answer key included", "US Letter & A4 sizes", "Black & white printer-friendly version"],
  Coloring:    ["High-resolution coloring pages (PDF)", "Single-sided design for no bleed-through", "US Letter & A4 sizes", "Printer-friendly black & white"],
  Storybooks:  ["Full illustrated story (PDF format)", "Read-aloud tips for parents", "US Letter & A4 sizes", "Color + grayscale versions"],
  Activities:  ["Activity sheets (PDF format)", "Instructions & tips included", "US Letter & A4 sizes", "Color + black & white versions"],
  Flashcards:  ["Printable flash cards (PDF)", "Cut lines included", "US Letter & A4 sizes", "Color + black & white versions"],
  "Party Kits":["Invitations, banners & decorations (PDF)", "Food labels & favor tags", "US Letter & A4 sizes", "Editable text fields"],
  Printables:  ["PDF download (US Letter & A4)", "High-resolution print-ready files", "Instant access after purchase"],
};

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const product = getProductById(Number(id));
  if (!product) notFound();

  const { addToCart, removeFromCart, isInCart } = useCart();
  const { toggleFavorite, isFavorited } = useFavorites();
  const { user } = useAuth();
  const { isOwned } = usePurchases();
  const { formatPrice } = useCurrency();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showInstantCheckout, setShowInstantCheckout] = useState(false);
  const owned = isOwned(product.id);

  const related = getRelatedProducts(product, 6);
  const category = getCategoryLabel(product);
  const pct = discountPct(product.salePrice, product.originalPrice);
  const tags = TAGS_BY_CATEGORY[category] ?? TAGS_BY_CATEGORY["Printables"];
  const description = DESCRIPTION_BY_CATEGORY[category] ?? DESCRIPTION_BY_CATEGORY["Printables"];
  const included = WHATS_INCLUDED[category] ?? WHATS_INCLUDED["Printables"];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream">
        <div className="max-w-7xl mx-auto px-6 py-8">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-ink-muted mb-8">
            <a href="/" className="hover:text-ink transition-colors duration-200">Home</a>
            <ChevronRight size={12} strokeWidth={2} />
            <a href={`/all?category=${category.toLowerCase().replace(/\s+/g, "-")}`} className="hover:text-ink transition-colors duration-200">{category}</a>
            <ChevronRight size={12} strokeWidth={2} />
            <span className="text-ink truncate max-w-[200px]">{product.title}</span>
          </nav>

          {/* Main product layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">

            {/* Left: Image */}
            <div className="space-y-3">
              <div className="aspect-square rounded-2xl overflow-hidden bg-card-hover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Trust badges */}
              <div className="flex items-center justify-center gap-6 py-3 border border-border-muted rounded-xl bg-white">
                <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <Shield size={13} strokeWidth={1.75} className="text-ink" />
                  Secure checkout
                </div>
                <div className="w-px h-4 bg-border-muted" />
                <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <Infinity size={13} strokeWidth={1.75} className="text-ink" />
                  Unlimited access
                </div>
                <div className="w-px h-4 bg-border-muted" />
                <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <Download size={13} strokeWidth={1.75} className="text-ink" />
                  Instant access
                </div>
              </div>
            </div>

            {/* Right: Details */}
            <div className="flex flex-col">
              {/* Category + seller */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold tracking-widest text-ink-muted uppercase">{category}</span>
                <span className="text-border-muted">·</span>
                <span className="text-xs text-ink-muted">{product.seller}</span>
              </div>

              {/* Title */}
              <h1 className="font-serif text-2xl md:text-3xl font-semibold text-ink tracking-tight leading-snug mb-3">
                {product.title}
              </h1>

              {/* Rating */}
              {product.rating && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={13}
                        strokeWidth={0}
                        className={i <= Math.round(product.rating!) ? "fill-[#D4A017] text-[#D4A017]" : "fill-border-muted text-border-muted"}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-ink">{product.rating.toFixed(1)}</span>
                  <span className="text-sm text-ink-muted">({formatCount(product.reviewCount ?? 0)} reviews)</span>
                </div>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold text-sale-green">{formatPrice(product.salePrice)}</span>
                <span className="text-base text-ink-muted line-through">{formatPrice(product.originalPrice)}</span>
                {pct !== null && (
                  <span className="px-2.5 py-0.5 rounded-full bg-sale-green text-cream text-xs font-bold">
                    {pct}% off
                  </span>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-6">
                {tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full border border-border-muted text-xs font-medium text-ink-muted">
                    {tag}
                  </span>
                ))}
                {product.instantDownload && (
                  <span className="px-3 py-1 rounded-full bg-[#134A4F] text-cream text-xs font-semibold flex items-center gap-1">
                    <Download size={10} /> PDF Download
                  </span>
                )}
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col gap-3 mb-6">
                {owned ? (
                  <a
                    href="/downloads"
                    className="w-full h-12 rounded-full bg-sale-green text-cream text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-200"
                  >
                    <LibraryBig size={16} strokeWidth={2} />
                    Go to My Library
                  </a>
                ) : (
                  <>
                    <button
                      onClick={() => { if (!isInCart(product.id)) { addToCart(product); } window.location.href = "/cart"; }}
                      disabled={isInCart(product.id)}
                      className={`w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
                        isInCart(product.id)
                          ? "bg-[#3a3a3a] text-cream cursor-default"
                          : "bg-ink text-cream hover:bg-[#3a3a3a] active:scale-[0.98]"
                      }`}
                    >
                      <ShoppingCart size={16} strokeWidth={2} />
                      {isInCart(product.id) ? "Added to Cart ✓" : "Add to Cart"}
                    </button>
                    {product.instantDownload && (
                      <button
                        onClick={() => user ? setShowInstantCheckout(true) : setShowAuthModal(true)}
                        className="w-full h-12 rounded-full border-2 border-[#134A4F] text-[#134A4F] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#134A4F] hover:text-cream active:scale-[0.98] transition-all duration-200"
                      >
                        <Download size={16} strokeWidth={2} />
                        Instant Download — {formatPrice(product.salePrice)}
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => toggleFavorite(product.id)}
                  className={`w-full h-11 rounded-full border text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-200 ${
                    isFavorited(product.id)
                      ? "border-red-400 bg-red-50 text-red-500"
                      : "border-border-muted text-ink hover:border-ink hover:bg-card-hover"
                  }`}
                >
                  <Heart
                    size={15}
                    strokeWidth={1.75}
                    className={isFavorited(product.id) ? "fill-red-500 text-red-500" : ""}
                  />
                  {isFavorited(product.id) ? "Saved to Favorites" : "Save to Favorites"}
                </button>
              </div>

              {/* Description */}
              <div className="border-t border-border-muted pt-5 mb-5">
                <h2 className="font-serif text-base font-semibold text-ink mb-2">About this product</h2>
                <p className="text-sm text-ink-muted leading-relaxed">{description}</p>
              </div>

              {/* What's included */}
              <div className="border-t border-border-muted pt-5 mb-5">
                <h2 className="font-serif text-base font-semibold text-ink mb-3">What&apos;s included</h2>
                <ul className="space-y-2">
                  {included.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-ink-muted">
                      <Check size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 text-sale-green" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* File details */}
              <div className="border-t border-border-muted pt-5">
                <h2 className="font-serif text-base font-semibold text-ink mb-3">File details</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Format", value: "PDF" },
                    { label: "File size", value: "~4–8 MB" },
                    { label: "Pages", value: product.instantDownload ? "10–40 pages" : "15–30 pages" },
                    { label: "Delivery", value: product.instantDownload ? "Instant download" : "Digital file" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-2 p-3 rounded-xl bg-white border border-border-muted">
                      <FileText size={13} strokeWidth={1.75} className="text-ink-muted shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
                        <p className="text-xs font-medium text-ink">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* About the seller */}
          <div className="border-t border-border-muted pt-10 mb-14">
            <h2 className="font-serif text-xl font-semibold text-ink mb-5">About the seller</h2>
            <div className="flex items-start gap-5 p-6 rounded-2xl bg-white border border-border-muted">
              <div className="w-14 h-14 rounded-full bg-card-hover flex items-center justify-center shrink-0 text-xl font-serif font-bold text-ink-muted select-none">
                {product.seller.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-ink mb-0.5">{product.seller}</p>
                <p className="text-xs text-ink-muted mb-3">Digital educator · Uben seller since 2023</p>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {product.seller} creates high-quality printable resources for early childhood education. Their designs are trusted by thousands of parents, teachers, and homeschoolers worldwide.
                </p>
                <a href="#" className="inline-flex items-center mt-3 text-xs font-medium text-ink underline underline-offset-2 hover:no-underline transition-all duration-200">
                  View all products from {product.seller}
                </a>
              </div>
            </div>
          </div>

          {/* Related products */}
          {related.length > 0 && (
            <div className="border-t border-border-muted pt-10">
              <h2 className="font-serif text-xl font-semibold text-ink mb-6">You might also like</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {related.map((rel) => {
                  const relPct = discountPct(rel.salePrice, rel.originalPrice);
                  return (
                    <div key={rel.id} className="group cursor-pointer">
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-card-hover mb-2">
                        <a href={`/product/${rel.id}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={rel.image}
                            alt={rel.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-105"
                          />
                        </a>
                        {relPct !== null && (
                          <span className="absolute top-1.5 left-1.5 bg-sale-green text-cream text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            {relPct}% off
                          </span>
                        )}
                      </div>
                      <a href={`/product/${rel.id}`}>
                        <p className="text-[11px] text-ink-muted truncate mb-0.5">{rel.seller}</p>
                        <h3 className="text-xs font-medium text-ink truncate leading-snug group-hover:underline underline-offset-2 transition-all duration-200 mb-1">
                          {rel.title}
                        </h3>
                        <div className="flex items-baseline gap-1 mb-2">
                          <span className="text-xs font-semibold text-sale-green">{formatPrice(rel.salePrice)}</span>
                          <span className="text-[10px] text-ink-muted line-through">{formatPrice(rel.originalPrice)}</span>
                        </div>
                      </a>
                      {/* Add to cart button on hover */}
                      <button
                        onClick={() => isInCart(rel.id) ? removeFromCart(rel.id) : addToCart(rel)}
                        className={`w-full h-8 rounded-full text-[11px] font-semibold border transition-all duration-200 md:opacity-0 md:translate-y-1 md:group-hover:opacity-100 md:group-hover:translate-y-0 ${
                          isInCart(rel.id)
                            ? "bg-ink text-cream border-ink hover:bg-[#3a3a3a] hover:border-[#3a3a3a]"
                            : "bg-transparent text-ink border-ink/30 hover:border-ink hover:bg-card-hover"
                        }`}
                      >
                        {isInCart(rel.id) ? "Added ✓" : "Add to cart"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </main>
      <Footer />
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          message="You need to sign in to download this product."
        />
      )}
      {showInstantCheckout && (
        <InstantCheckoutModal
          product={product}
          onClose={() => setShowInstantCheckout(false)}
        />
      )}
    </>
  );
}
