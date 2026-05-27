export default function FeatureCards() {
  return (
    <section className="py-8 md:py-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-5">

          {/* ── Teal card ─────────────────────────────────────────────── */}
          <div className="relative rounded-2xl bg-teal-deep px-8 py-4 flex flex-col justify-between gap-3 overflow-hidden border border-[#0f3a3f]">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium tracking-widest text-cream/60 uppercase">Curated Bundles</p>
              <h2 className="font-serif text-2xl md:text-3xl leading-tight tracking-tight text-cream">
                Learning that lives on paper.
                <br />
                <span className="text-cream/70 font-light italic text-xl md:text-2xl">Every page is made with intention.</span>
              </h2>
            </div>
            <a
              href="/all?category=printables"
              className="mt-1 self-start inline-flex items-center px-5 py-2.5 rounded-full bg-cream text-teal-deep text-sm font-semibold hover:bg-[#EDE8E0] transition-colors duration-200"
            >
              Explore bundles
            </a>
          </div>

          {/* ── Storybook card ────────────────────────────────────────── */}
          <div
            className="relative rounded-2xl px-8 py-4 flex flex-row items-end justify-between gap-4 overflow-hidden border-2"
            style={{ backgroundColor: "#FEF3E2", borderColor: "#F0C08A" }}
          >
            {/* Warm blob */}
            <div
              className="absolute right-0 top-1/2 w-48 h-48 rounded-full opacity-20"
              style={{ backgroundColor: "#F5A84A", transform: "translate(25%,-50%)" }}
            />
            {/* Dot accents */}
            <div className="absolute top-3 right-40 w-2 h-2 rounded-full opacity-40" style={{ backgroundColor: "#F28C63" }} />
            <div className="absolute bottom-3 right-52 w-1.5 h-1.5 rounded-full opacity-30" style={{ backgroundColor: "#F5C45A" }} />

            {/* Left: text + button */}
            <div className="relative z-10 flex flex-col gap-3 flex-1">
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
                href="/all?category=storybooks"
                className="mt-1 self-start inline-flex items-center px-5 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity duration-200"
                style={{ backgroundColor: "#E8806A" }}
              >
                Shop now →
              </a>
            </div>

            {/* Right: illustration cluster */}
            <div className="relative shrink-0 w-36 h-20 z-10">
              {/* Rainbow */}
              <div className="absolute bottom-0 left-0 w-20 h-10 rounded-t-full border-[6px] border-b-0" style={{ borderColor: "#F28C63" }} />
              <div className="absolute bottom-0 left-2.5 w-15 h-8 rounded-t-full border-[5px] border-b-0" style={{ borderColor: "#F5C45A" }} />
              <div className="absolute bottom-0 left-5 w-10 h-5 rounded-t-full border-[5px] border-b-0" style={{ borderColor: "#7DCE8C" }} />
              <div className="absolute bottom-0 left-7 w-6 h-3 rounded-t-full border-[4px] border-b-0" style={{ borderColor: "#7BB8F0" }} />

              {/* Stars */}
              <svg className="absolute top-0 right-6" width="18" height="18" viewBox="0 0 20 20" fill="#F5C45A">
                <path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.51.91-5.32L2.27 6.62l5.34-.78z"/>
              </svg>
              <svg className="absolute top-5 right-0" width="11" height="11" viewBox="0 0 20 20" fill="#F5C45A" opacity="0.5">
                <path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.51.91-5.32L2.27 6.62l5.34-.78z"/>
              </svg>

              {/* BIG animals */}
              <span className="absolute top-0 right-0 select-none leading-none drop-shadow-sm" style={{ fontSize: 58 }}>🐰</span>
              <span className="absolute bottom-0 right-14 select-none leading-none drop-shadow-sm" style={{ fontSize: 44 }}>🐻</span>
              <span className="absolute top-1 right-16 select-none leading-none" style={{ fontSize: 26 }}>📖</span>
              <span className="absolute bottom-1 right-0 select-none leading-none" style={{ fontSize: 20, color: "#F28C63" }}>♥</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
