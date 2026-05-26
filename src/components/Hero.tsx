
export default function Hero() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-12 md:py-16">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        {/* Left: editorial copy */}
        <div className="flex flex-col gap-6 md:pr-8">
          <p className="text-xs font-medium tracking-widest text-ink-muted uppercase">
            For Curious Kids
          </p>
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight text-ink">
            Print something
            <br />
            <em className="not-italic text-ink-muted font-light">they&apos;ll love.</em>
          </h1>
          <p className="text-base text-ink-muted leading-relaxed max-w-sm">
            Discover printable activities, worksheets, and storybooks from
            independent designers who make learning feel like play.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="#"
              className="inline-flex items-center px-6 py-3 rounded-full bg-ink text-cream text-sm font-medium hover:bg-[#3a3a3a] transition-colors duration-200"
            >
              Start printing
            </a>
            <a
              href="#"
              className="inline-flex items-center px-6 py-3 rounded-full border border-border-muted text-ink text-sm font-medium hover:bg-card-hover transition-colors duration-200"
            >
              Sell on Uben
            </a>
          </div>
        </div>

        {/* Right: hero GIF */}
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/fish.gif"
            alt="Animated fish — hero illustration"
            className="w-auto h-auto max-h-[540px] max-w-full rounded-2xl"
          />
        </div>
      </div>
    </section>
  );
}
