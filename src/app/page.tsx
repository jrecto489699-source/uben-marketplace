import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProductCarousel from "@/components/ProductCarousel";
import FeatureCards from "@/components/FeatureCards";
import Footer from "@/components/Footer";
import {
  printableProducts,
  worksheetProducts,
  coloringProducts,
  storybookProducts,
  activityProducts,
  flashcardProducts,
  partyKitProducts,
  classroomProducts,
} from "@/data/products";

function Divider() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <hr className="border-border-muted" />
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Divider />

        <ProductCarousel
          title="Trending in Printables"
          dynamicTitle
          viewAllHref="/all?category=printables"
          products={printableProducts}
        />
        <Divider />

        <ProductCarousel
          title="Worksheets"
          viewAllHref="/all?category=worksheets"
          products={worksheetProducts}
        />
        <Divider />

        <FeatureCards />
        <Divider />

        <ProductCarousel
          title="Coloring Books & Pages"
          viewAllHref="/all?category=coloring"
          products={coloringProducts}
        />
        <Divider />

        <ProductCarousel
          title="Storybooks"
          viewAllHref="/all?category=storybooks"
          products={storybookProducts}
        />
        <Divider />

        <ProductCarousel
          title="Activities"
          viewAllHref="/all?category=activities"
          products={activityProducts}
        />
        <Divider />

        <ProductCarousel
          title="Flashcards"
          viewAllHref="/all?category=flashcards"
          products={flashcardProducts}
        />
        <Divider />

        <ProductCarousel
          title="Party Kits"
          viewAllHref="/all?category=party-kits"
          products={partyKitProducts}
        />
        <Divider />

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
