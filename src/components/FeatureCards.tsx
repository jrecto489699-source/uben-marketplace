import Image from "next/image";

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

          {/* Image-led card */}
          <div className="relative rounded-2xl overflow-hidden min-h-72 group cursor-pointer">
            <Image
              src="https://picsum.photos/seed/storybook-reading-child-bed/800/600"
              alt="Storybooks and reading packs for kids"
              fill
              className="object-cover transition-transform duration-200 ease-out group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-ink/30" />
            <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-10">
              <p className="text-xs font-medium tracking-widest text-cream/75 uppercase mb-2">
                New this week
              </p>
              <h2 className="font-serif text-3xl md:text-4xl leading-tight tracking-tight text-cream mb-4">
                Storybooks &amp; Reading Packs
              </h2>
              <a
                href="#"
                className="self-start text-sm font-medium text-cream underline underline-offset-4 hover:text-cream/80 transition-colors duration-200"
              >
                Shop now →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
