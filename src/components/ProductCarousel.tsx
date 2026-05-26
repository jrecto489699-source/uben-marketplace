"use client";

import { useRef } from "react";
import { ChevronRight } from "lucide-react";
import { useCategory } from "@/context/CategoryContext";

export interface Product {
  id: number;
  title: string;
  salePrice: string;
  originalPrice: string;
  seller: string;
  /** Local path e.g. "/images/My Product.png" or a full https:// URL */
  image: string;
}

interface ProductCarouselProps {
  title: string;
  /** When true, the title becomes "Trending in <active category>" */
  dynamicTitle?: boolean;
  viewAllHref?: string;
  products: Product[];
}

export default function ProductCarousel({
  title,
  dynamicTitle = false,
  viewAllHref = "#",
  products,
}: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { active } = useCategory();
  const displayTitle = dynamicTitle ? `Trending in ${active}` : title;

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 232, behavior: "smooth" });
    }
  };

  return (
    <section className="py-12 md:py-14">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-semibold text-ink tracking-tight">
            {displayTitle}
          </h2>
          <a
            href={viewAllHref}
            className="inline-flex items-center px-4 py-2 rounded-full bg-ink text-cream text-xs font-medium hover:bg-[#3a3a3a] transition-colors duration-200"
          >
            View all
          </a>
        </div>

        {/* Carousel wrapper */}
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
          >
            {products.map((product) => (
              <article
                key={product.id}
                className="snap-start shrink-0 w-52 group cursor-pointer"
              >
                {/* Image */}
                <div className="aspect-square rounded-xl overflow-hidden bg-card-hover mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.image}
                    alt={product.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-105"
                  />
                </div>

                {/* Meta */}
                <div className="px-0.5">
                  <p className="text-xs text-ink-muted mb-0.5 truncate">{product.seller}</p>
                  <h3 className="text-sm font-medium text-ink truncate leading-snug group-hover:underline underline-offset-2 transition-all duration-200">
                    {product.title}
                  </h3>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-sm font-semibold text-sale-green">
                      {product.salePrice}
                    </span>
                    <span className="text-xs text-ink-muted line-through">
                      {product.originalPrice}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Arrow button */}
          <button
            onClick={scrollRight}
            className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-ink items-center justify-center shadow-lg hover:bg-[#3a3a3a] transition-colors duration-200 z-10"
            aria-label="Scroll right"
          >
            <ChevronRight size={18} color="white" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </section>
  );
}
