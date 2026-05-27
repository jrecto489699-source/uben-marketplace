export default function FeatureCards() {
  return (
    <section className="py-12 md:py-14">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-5">

          {/* Editorial card — teal */}
          <div className="rounded-2xl bg-teal-deep px-8 py-6 flex flex-row items-center justify-between gap-6">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium tracking-widest text-cream/60 uppercase">
                Curated Bundles
              </p>
              <h2 className="font-serif text-2xl md:text-3xl leading-tight tracking-tight text-cream">
                Learning that lives on paper.
                <br />
                <span className="text-cream/70 font-light italic text-xl md:text-2xl">Every page is made with intention.</span>
              </h2>
            </div>
            <a
              href="#"
              className="shrink-0 inline-flex items-center px-5 py-2.5 rounded-full bg-cream text-teal-deep text-sm font-medium hover:bg-[#EDE8E0] transition-colors duration-200"
            >
              Explore bundles
            </a>
          </div>

          {/* Storybook card — illustrated peach */}
          <div
            className="relative rounded-2xl px-8 py-6 flex flex-row items-center justify-between gap-6 overflow-hidden cursor-pointer"
            style={{ backgroundColor: "#FEF3E2" }}
          >
            {/* Decorative background blobs */}
            <div className="absolute right-10 top-1/2 -translate-y-1/2 w-28 h-28 rounded-full opacity-30" style={{ backgroundColor: "#F5C97A" }} />
            <div className="absolute right-4 bottom-0 w-16 h-10 rounded-full opacity-20" style={{ backgroundColor: "#F5C97A" }} />

            {/* Left: text content */}
            <div className="relative flex flex-col gap-2.5 z-10">
              {/* Badge */}
              <span className="self-start inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E8A87C] text-[10px] font-semibold tracking-widest text-[#C4622D] uppercase">
                <svg width="10" height="10" viewBox="0 0 20 20" fill="#E8A87C"><path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.51.91-5.32L2.27 6.62l5.34-.78z"/></svg>
                New this week
              </span>

              <h2 className="font-serif text-2xl md:text-3xl leading-tight tracking-tight" style={{ color: "#3D1800" }}>
                Storybooks &amp; Reading Packs
              </h2>
              <p className="font-serif italic text-base" style={{ color: "#A0693A" }}>
                Stories worth reading again and again.
              </p>
            </div>

            {/* Right: decorative illustration cluster */}
            <div className="relative shrink-0 flex items-center justify-center w-28 h-16 z-10">
              {/* Rainbow arc (CSS) */}
              <div className="absolute bottom-0 left-0 w-12 h-6 rounded-t-full border-4 opacity-70" style={{ borderColor: "#F28C63", borderBottom: "none" }} />
              <div className="absolute bottom-0 left-1.5 w-9 h-5 rounded-t-full border-4 opacity-60" style={{ borderColor: "#F5C45A", borderBottom: "none" }} />
              <div className="absolute bottom-0 left-3 w-6 h-3.5 rounded-t-full border-4 opacity-50" style={{ borderColor: "#7DCE8C", borderBottom: "none" }} />
              {/* Stars */}
              <svg className="absolute top-0 right-2" width="14" height="14" viewBox="0 0 20 20" fill="#F5C45A"><path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.51.91-5.32L2.27 6.62l5.34-.78z"/></svg>
              <svg className="absolute top-3 right-8" width="9" height="9" viewBox="0 0 20 20" fill="#F5C45A" opacity="0.7"><path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.51.91-5.32L2.27 6.62l5.34-.78z"/></svg>
              {/* Book emoji */}
              <span className="absolute top-0 right-0 text-2xl select-none">📖</span>
              {/* Bunny emoji */}
              <span className="absolute bottom-0 right-6 text-xl select-none">🐰</span>
            </div>

            {/* CTA */}
            <a
              href="#"
              className="shrink-0 inline-flex items-center px-5 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity duration-200 z-10"
              style={{ backgroundColor: "#E8806A" }}
            >
              Shop now →
            </a>
          </div>

        </div>
      </div>
    </section>
  );
}
