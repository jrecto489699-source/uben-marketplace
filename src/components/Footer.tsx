import UbenLogo from "@/components/UbenLogo";

const footerLinks = {
  Shop: ["Printables", "Worksheets", "Coloring Pages", "Storybooks", "Party Kits", "Flashcards"],
  Sell: ["Open a Shop", "Designer Handbook", "Forums", "Teams", "Success Stories", "Affiliates"],
  About: ["Press", "Investors", "Policies", "Privacy", "Help Center", "Blog"],
  Community: ["Gift cards", "Sitemap", "School & Teacher Discounts", "Impact", "Partnerships", "Sustainability"],
};

export default function Footer() {
  return (
    <footer className="border-t border-border-muted mt-4">
      <div className="max-w-7xl mx-auto px-6 py-14">
        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <p className="text-xs font-semibold tracking-widest text-ink uppercase mb-4">
                {heading}
              </p>
              <ul className="flex flex-col gap-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-ink-muted hover:text-ink transition-colors duration-200"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border-muted pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <a href="/" aria-label="Uben — home">
            <UbenLogo variant="dark" size={28} />
          </a>
          <div className="flex flex-wrap gap-4">
            <a href="#" className="text-xs text-ink-muted hover:text-ink transition-colors duration-200">
              Privacy Policy
            </a>
            <a href="#" className="text-xs text-ink-muted hover:text-ink transition-colors duration-200">
              Terms of Use
            </a>
            <a href="#" className="text-xs text-ink-muted hover:text-ink transition-colors duration-200">
              Cookie Preferences
            </a>
            <a href="#" className="text-xs text-ink-muted hover:text-ink transition-colors duration-200">
              Accessibility
            </a>
          </div>
          <p className="text-xs text-ink-muted">
            © {new Date().getFullYear()} Uben. Digital products for curious kids.
          </p>
        </div>
      </div>
    </footer>
  );
}
