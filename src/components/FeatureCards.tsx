export default function FeatureCards() {
  return (
    <section className="py-12 md:py-14">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-5">

          {/* Editorial card — teal */}
          <div className="rounded-2xl bg-teal-deep px-8 py-6 flex flex-row items-center justify-between gap-6 border border-[#0f3a3f]">
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
            className="relative rounded-2xl px-8 py-5 flex flex-row items-center gap-5 overflow-hidden cursor-pointer border-2"
            style={{ backgroundColor: "#FEF3E2", borderColor: "#F0C08A" }}
          >
            {/* Large warm blob behind animals */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-48 h-48 rounded-full opacity-25"
              style={{ backgroundColor: "#F5A84A", transform: "translate(30%, -50%)" }}
            />
            {/* Small dot accents */}
            <div className="absolute top-3 right-36 w-2 h-2 rounded-full opacity-50" style={{ backgroundColor: "#F28C63" }} />
            <div className="absolute bottom-4 right-52 w-1.5 h-1.5 rounded-full opacity-40" style={{ backgroundColor: "#F5C45A" }} />
            <div className="absolute top-5 right-56 w-1 h-1 rounded-full opacity-30" style={{ backgroundColor: "#E8806A" }} />

            {/* Left: text content */}
            <div className="relative flex flex-col gap-2 z-10 flex-1">
              {/* Badge */}
              <span className="self-start inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E8A87C] text-[10px] font-bold tracking-widest uppercase" style={{ color: "#C4622D" }}>
                <svg width="9" height="9" viewBox="0 0 20 20" fill="#E8A87C">
                  <path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.51.91-5.32L2.27 6.62l5.34-.78z"/>
                </svg>
                New this week
              </span>

              <h2 className="font-serif text-2xl md:text-3xl leading-tight tracking-tight" style={{ color: "#3D1800" }}>
                Storybooks &amp;<br />Reading Packs
              </h2>
              <p className="font-serif italic text-sm" style={{ color: "#A0693A" }}>
                Stories worth reading again and again.
              </p>

              <a
                href="#"
                className="mt-1 self-start inline-flex items-center px-5 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity duration-200"
                style={{ backgroundColor: "#E8806A" }}
              >
                Shop now →
              </a>
            </div>

            {/* Right: illustration cluster */}
            <div className="relative shrink-0 w-36 h-24 z-10">
              {/* Rainbow (layered arcs) */}
              <div className="absolute bottom-0 left-0 w-16 h-8 rounded-t-full border-[5px] border-b-0" style={{ borderColor: "#F28C63" }} />
              <div className="absolute bottom-0 left-2 w-12 h-6 rounded-t-full border-[4px] border-b-0" style={{ borderColor: "#F5C45A" }} />
              <div className="absolute bottom-0 left-4 w-8 h-4 rounded-t-full border-[4px] border-b-0" style={{ borderColor: "#7DCE8C" }} />
              <div className="absolute bottom-0 left-6 w-4 h-2.5 rounded-t-full border-[3px] border-b-0" style={{ borderColor: "#7BB8F0" }} />

              {/* Stars */}
              <svg className="absolute top-0 right-4" width="16" height="16" viewBox="0 0 20 20" fill="#F5C45A">
                <path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.51.91-5.32L2.27 6.62l5.34-.78z"/>
              </svg>
              <svg className="absolute top-4 right-1" width="10" height="10" viewBox="0 0 20 20" fill="#F5C45A" opacity="0.6">
                <path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.51.91-5.32L2.27 6.62l5.34-.78z"/>
              </svg>

              {/* Animals — big emoji */}
              <span className="absolute top-0 right-0 text-5xl leading-none select-none drop-shadow-sm">🐰</span>
              <span className="absolute bottom-1 right-14 text-3xl leading-none select-none drop-shadow-sm">🐻</span>
              <span className="absolute top-1 right-16 text-2xl leading-none select-none">📖</span>

              {/* Heart accent */}
              <span className="absolute bottom-2 right-1 text-sm select-none" style={{ color: "#F28C63" }}>♥</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
