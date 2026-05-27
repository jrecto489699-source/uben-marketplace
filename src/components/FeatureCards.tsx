export default function FeatureCards() {
  return (
    <section className="py-12 md:py-14">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-5">
          {/* Editorial card — teal */}
          <div className="rounded-2xl bg-teal-deep p-10 md:p-12 flex flex-col justify-between min-h-72">
            <div className="flex flex-col gap-5">
              <p className="text-xs font-medium tracking-widest text-cream/60 uppercase">
                Curated Bundles
              </p>
              <h2 className="font-serif text-3xl md:text-4xl leading-tight tracking-tight text-cream">
                Learning that lives
                <br />on paper.
                <br />
                <span className="text-cream/70 font-light italic">Every page is made with intention.</span>
              </h2>
            </div>
            <a
              href="#"
              className="mt-8 self-start inline-flex items-center px-6 py-3 rounded-full bg-cream text-teal-deep text-sm font-medium hover:bg-[#EDE8E0] transition-colors duration-200"
            >
              Explore bundles
            </a>
          </div>

          {/* Flat color card — warm amber */}
          <div className="rounded-2xl min-h-72 p-10 md:p-12 flex flex-col justify-between cursor-pointer" style={{ backgroundColor: "#C4955A" }}>
            <div className="flex flex-col gap-5">
              <p className="text-xs font-medium tracking-widest text-[#F5F1EA]/70 uppercase">
                New this week
              </p>
              <h2 className="font-serif text-3xl md:text-4xl leading-tight tracking-tight text-[#F5F1EA]">
                Storybooks &amp;
                <br />Reading Packs
                <br />
                <span className="text-[#F5F1EA]/70 font-light italic">Stories worth reading again and again.</span>
              </h2>
            </div>
            <a
              href="#"
              className="mt-8 self-start inline-flex items-center px-6 py-3 rounded-full bg-[#F5F1EA] text-[#C4955A] text-sm font-medium hover:bg-[#EDE8E0] transition-colors duration-200"
            >
              Shop now →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
