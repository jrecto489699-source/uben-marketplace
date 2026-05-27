import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProductCarousel from "@/components/ProductCarousel";
import FeatureCards from "@/components/FeatureCards";
import Footer from "@/components/Footer";
import { printableProducts, classroomProducts } from "@/data/products";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />

        <div className="max-w-7xl mx-auto px-6">
          <hr className="border-border-muted" />
        </div>

        <ProductCarousel
          title="Trending in Printables"
          dynamicTitle
          viewAllHref="/all?category=printables"
          products={printableProducts}
        />

        <div className="max-w-7xl mx-auto px-6">
          <hr className="border-border-muted" />
        </div>

        <FeatureCards />

        <div className="max-w-7xl mx-auto px-6">
          <hr className="border-border-muted" />
        </div>

        <ProductCarousel
          title="Top Classroom Picks"
          viewAllHref="/all?category=classroom"
          products={classroomProducts}
        />
      </main>
      <Footer />
    </>
  );
}
