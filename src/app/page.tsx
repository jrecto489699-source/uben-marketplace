import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProductCarousel, { type Product } from "@/components/ProductCarousel";
import FeatureCards from "@/components/FeatureCards";
import Footer from "@/components/Footer";

const printableProducts: Product[] = [
  { id: 1, title: "Alphabet Tracing Pack (A–Z PDF)",      salePrice: "$4", originalPrice: "$7",  seller: "Tiny Sprout Studio",  image: "/images/Alphabet Tracing.png" },
  { id: 2, title: "Under-the-Sea Coloring Book",          salePrice: "$5", originalPrice: "$8",  seller: "Crayon & Co.",         image: "/images/Under-the-Sea Coloring Book.png" },
  { id: 3, title: "Phonics Starter Bundle (40 pages)",    salePrice: "$9", originalPrice: "$14", seller: "Acorn Learning Lab",   image: "/images/Phonics Starter Bundle.png" },
  { id: 4, title: "Bedtime Storybook: Lulu & the Moon",   salePrice: "$6", originalPrice: "$10", seller: "Sunshine Stories",     image: "/images/Bedtime Storybook.png" },
  { id: 5, title: "Birthday Party Printable Kit",         salePrice: "$8", originalPrice: "$13", seller: "Honey Bee Prints",     image: "/images/Birthday Party Printable Kit.png" },
  { id: 6, title: "Daily Routine Chart for Kids",         salePrice: "$3", originalPrice: "$5",  seller: "Bright Beans Studio",  image: "/images/Daily Routine Chart for Kids.png" },
  { id: 7, title: "ABC Flash Card Set (26 cards)",        salePrice: "$5", originalPrice: "$8",  seller: "Little Letter Co.",    image: "/images/ABC Flash Card Set (26 cards).png" },
];

const classroomProducts: Product[] = [
  { id: 8,  title: "Weather & Seasons Sorting Cards",       salePrice: "$4", originalPrice: "$7",  seller: "Meadow Lane Prints",  image: "/images/Weather & Seasons Sorting.png" },
  { id: 9,  title: "Dinosaur Coloring Bundle (30 pages)",   salePrice: "$6", originalPrice: "$10", seller: "The Crayon Atelier",  image: "/images/Dinosaur Coloring Bundle.png" },
  { id: 10, title: "Pre-K Writing Practice Pack",           salePrice: "$7", originalPrice: "$11", seller: "Paper Moon Studio",   image: "/images/Pre-K Writing Practice Pack.png" },
  { id: 11, title: "Nature Explorer Activity Book",         salePrice: "$8", originalPrice: "$12", seller: "Wild Oak Learning",   image: "/images/Nature Explorer Activity Book.png" },
  { id: 12, title: "Valentine's Day Party Kit",             salePrice: "$7", originalPrice: "$11", seller: "Sweet Pea Press",     image: "/images/Valentine's Day Party Kit for kids.png" },
  { id: 13, title: "Sight Words Flash Card Set",            salePrice: "$5", originalPrice: "$8",  seller: "Little Knot Co.",     image: "/images/Sight Words Flash Card Set.png" },
  { id: 14, title: "Daily Gratitude Journal for Kids",      salePrice: "$4", originalPrice: "$6",  seller: "Morning Light Studio",image: "/images/Daily Gratitude Journal for Kids.png" },
];

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
          viewAllHref="#"
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
          viewAllHref="#"
          products={classroomProducts}
        />
      </main>
      <Footer />
    </>
  );
}
