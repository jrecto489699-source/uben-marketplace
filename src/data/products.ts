export interface Product {
  id: number;
  title: string;
  salePrice: string;
  originalPrice: string;
  seller: string;
  image: string;
  rating?: number;
  reviewCount?: number;
}

export const printableProducts: Product[] = [
  { id: 1, title: "Alphabet Tracing Pack (A–Z PDF)",    salePrice: "$4", originalPrice: "$7",  seller: "Tiny Sprout Studio",  image: "/images/Alphabet Tracing.png",                    rating: 4.9, reviewCount: 312 },
  { id: 2, title: "Under-the-Sea Coloring Book",        salePrice: "$5", originalPrice: "$8",  seller: "Crayon & Co.",         image: "/images/Under-the-Sea Coloring Book.png",          rating: 4.8, reviewCount: 204 },
  { id: 3, title: "Phonics Starter Bundle (40 pages)",  salePrice: "$9", originalPrice: "$14", seller: "Acorn Learning Lab",   image: "/images/Phonics Starter Bundle.png",               rating: 4.9, reviewCount: 87  },
  { id: 4, title: "Bedtime Storybook: Lulu & the Moon", salePrice: "$6", originalPrice: "$10", seller: "Sunshine Stories",     image: "/images/Bedtime Storybook.png",                    rating: 4.7, reviewCount: 156 },
  { id: 5, title: "Birthday Party Printable Kit",       salePrice: "$8", originalPrice: "$13", seller: "Honey Bee Prints",     image: "/images/Birthday Party Printable Kit.png",         rating: 4.8, reviewCount: 431 },
  { id: 6, title: "Daily Routine Chart for Kids",       salePrice: "$3", originalPrice: "$5",  seller: "Bright Beans Studio",  image: "/images/Daily Routine Chart for Kids.png",         rating: 4.6, reviewCount: 98  },
  { id: 7, title: "ABC Flash Card Set (26 cards)",      salePrice: "$5", originalPrice: "$8",  seller: "Little Letter Co.",    image: "/images/ABC Flash Card Set (26 cards).png",        rating: 4.9, reviewCount: 762 },
];

export const classroomProducts: Product[] = [
  { id: 8,  title: "Weather & Seasons Sorting Cards",     salePrice: "$4", originalPrice: "$7",  seller: "Meadow Lane Prints",  image: "/images/Weather & Seasons Sorting.png",            rating: 4.8, reviewCount: 134 },
  { id: 9,  title: "Dinosaur Coloring Bundle (30 pages)", salePrice: "$6", originalPrice: "$10", seller: "The Crayon Atelier",  image: "/images/Dinosaur Coloring Bundle.png",              rating: 4.7, reviewCount: 59  },
  { id: 10, title: "Pre-K Writing Practice Pack",         salePrice: "$7", originalPrice: "$11", seller: "Paper Moon Studio",   image: "/images/Pre-K Writing Practice Pack.png",           rating: 4.9, reviewCount: 228 },
  { id: 11, title: "Nature Explorer Activity Book",       salePrice: "$8", originalPrice: "$12", seller: "Wild Oak Learning",   image: "/images/Nature Explorer Activity Book.png",         rating: 4.8, reviewCount: 317 },
  { id: 12, title: "Valentine's Day Party Kit",           salePrice: "$7", originalPrice: "$11", seller: "Sweet Pea Press",     image: "/images/Valentine's Day Party Kit for kids.png",   rating: 4.7, reviewCount: 182 },
  { id: 13, title: "Sight Words Flash Card Set",          salePrice: "$5", originalPrice: "$8",  seller: "Little Knot Co.",     image: "/images/Sight Words Flash Card Set.png",            rating: 4.6, reviewCount: 405 },
  { id: 14, title: "Daily Gratitude Journal for Kids",    salePrice: "$4", originalPrice: "$6",  seller: "Morning Light Studio",image: "/images/Daily Gratitude Journal for Kids.png",      rating: 4.8, reviewCount: 73  },
];

export const allProducts: Product[] = [...printableProducts, ...classroomProducts];
