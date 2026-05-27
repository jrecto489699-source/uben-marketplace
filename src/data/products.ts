export interface Product {
  id: number;
  title: string;
  salePrice: string;
  originalPrice: string;
  seller: string;
  image: string;
  rating?: number;
  reviewCount?: number;
  onSale?: boolean;
  instantDownload?: boolean;
}

// ── Worksheets ──────────────────────────────────────────────────────────────
export const worksheetProducts: Product[] = [
  { id: 1,  title: "Alphabet Tracing Pack (A–Z PDF)",       salePrice: "$4", originalPrice: "$7",  seller: "Tiny Sprout Studio",   image: "/images/Alphabet Tracing.png",               rating: 4.9, reviewCount: 312, onSale: true,  instantDownload: true  },
  { id: 3,  title: "Phonics Starter Bundle (40 pages)",      salePrice: "$9", originalPrice: "$14", seller: "Acorn Learning Lab",    image: "/images/Phonics Starter Bundle.png",          rating: 4.9, reviewCount: 87,  onSale: true,  instantDownload: true  },
  { id: 6,  title: "Daily Routine Chart for Kids",           salePrice: "$3", originalPrice: "$5",  seller: "Bright Beans Studio",   image: "/images/Daily Routine Chart for Kids.png",    rating: 4.6, reviewCount: 98,  onSale: false, instantDownload: true  },
  { id: 10, title: "Pre-K Writing Practice Pack",            salePrice: "$7", originalPrice: "$11", seller: "Paper Moon Studio",     image: "/images/Pre-K Writing Practice Pack.png",     rating: 4.9, reviewCount: 228, onSale: false, instantDownload: false },
  { id: 15, title: "Numbers Tracing 1–20 Workbook",          salePrice: "$4", originalPrice: "$6",  seller: "Tiny Sprout Studio",   image: "/images/Alphabet Tracing.png",               rating: 4.7, reviewCount: 64,  onSale: true,  instantDownload: true  },
  { id: 16, title: "Shapes & Patterns Worksheet Pack",       salePrice: "$5", originalPrice: "$8",  seller: "Paper Moon Studio",     image: "/images/Pre-K Writing Practice Pack.png",     rating: 4.8, reviewCount: 119, onSale: false, instantDownload: true  },
  { id: 17, title: "Handwriting Practice Bundle (cursive)",  salePrice: "$6", originalPrice: "$9",  seller: "Acorn Learning Lab",    image: "/images/Phonics Starter Bundle.png",          rating: 4.8, reviewCount: 47,  onSale: true,  instantDownload: true  },
];

// ── Coloring ─────────────────────────────────────────────────────────────────
export const coloringProducts: Product[] = [
  { id: 2,  title: "Under-the-Sea Coloring Book",            salePrice: "$5", originalPrice: "$8",  seller: "Crayon & Co.",          image: "/images/Under-the-Sea Coloring Book.png",     rating: 4.8, reviewCount: 204, onSale: false, instantDownload: true  },
  { id: 9,  title: "Dinosaur Coloring Bundle (30 pages)",    salePrice: "$6", originalPrice: "$10", seller: "The Crayon Atelier",    image: "/images/Dinosaur Coloring Bundle.png",        rating: 4.7, reviewCount: 59,  onSale: false, instantDownload: true  },
  { id: 18, title: "Farm Animals Coloring Pack (20 pages)",  salePrice: "$4", originalPrice: "$7",  seller: "Crayon & Co.",          image: "/images/Dinosaur Coloring Bundle.png",        rating: 4.6, reviewCount: 83,  onSale: true,  instantDownload: true  },
  { id: 19, title: "Space & Planets Coloring Book",          salePrice: "$5", originalPrice: "$9",  seller: "The Crayon Atelier",    image: "/images/Under-the-Sea Coloring Book.png",     rating: 4.7, reviewCount: 37,  onSale: false, instantDownload: true  },
  { id: 20, title: "Mandalas for Kids – Calm & Color",       salePrice: "$4", originalPrice: "$6",  seller: "Bright Beans Studio",   image: "/images/Dinosaur Coloring Bundle.png",        rating: 4.5, reviewCount: 121, onSale: true,  instantDownload: true  },
  { id: 21, title: "Jungle Safari Coloring Adventure",       salePrice: "$5", originalPrice: "$8",  seller: "Meadow Lane Prints",    image: "/images/Under-the-Sea Coloring Book.png",     rating: 4.8, reviewCount: 56,  onSale: false, instantDownload: true  },
];

// ── Storybooks ───────────────────────────────────────────────────────────────
export const storybookProducts: Product[] = [
  { id: 4,  title: "Bedtime Storybook: Lulu & the Moon",     salePrice: "$6", originalPrice: "$10", seller: "Sunshine Stories",      image: "/images/Bedtime Storybook.png",               rating: 4.7, reviewCount: 156, onSale: false, instantDownload: false },
  { id: 22, title: "The Little Cloud Adventure",              salePrice: "$5", originalPrice: "$8",  seller: "Sunshine Stories",      image: "/images/Bedtime Storybook.png",               rating: 4.8, reviewCount: 93,  onSale: true,  instantDownload: false },
  { id: 23, title: "Mia and the Magic Garden",                salePrice: "$6", originalPrice: "$9",  seller: "Wild Oak Learning",     image: "/images/Bedtime Storybook.png",               rating: 4.9, reviewCount: 211, onSale: false, instantDownload: false },
  { id: 24, title: "Rex the Brave Dino – Read-Aloud Pack",   salePrice: "$7", originalPrice: "$11", seller: "The Crayon Atelier",    image: "/images/Bedtime Storybook.png",               rating: 4.7, reviewCount: 44,  onSale: true,  instantDownload: true  },
  { id: 25, title: "Owl's First Day at School",               salePrice: "$5", originalPrice: "$8",  seller: "Morning Light Studio",  image: "/images/Bedtime Storybook.png",               rating: 4.6, reviewCount: 78,  onSale: false, instantDownload: false },
];

// ── Activities ───────────────────────────────────────────────────────────────
export const activityProducts: Product[] = [
  { id: 8,  title: "Weather & Seasons Sorting Cards",        salePrice: "$4", originalPrice: "$7",  seller: "Meadow Lane Prints",    image: "/images/Weather & Seasons Sorting.png",       rating: 4.8, reviewCount: 134, onSale: true,  instantDownload: true  },
  { id: 11, title: "Nature Explorer Activity Book",          salePrice: "$8", originalPrice: "$12", seller: "Wild Oak Learning",     image: "/images/Nature Explorer Activity Book.png",   rating: 4.8, reviewCount: 317, onSale: true,  instantDownload: true  },
  { id: 14, title: "Daily Gratitude Journal for Kids",       salePrice: "$4", originalPrice: "$6",  seller: "Morning Light Studio",  image: "/images/Daily Gratitude Journal for Kids.png",rating: 4.8, reviewCount: 73,  onSale: false, instantDownload: true  },
  { id: 26, title: "Emotions & Feelings Activity Kit",       salePrice: "$5", originalPrice: "$8",  seller: "Bright Beans Studio",   image: "/images/Daily Gratitude Journal for Kids.png",rating: 4.7, reviewCount: 89,  onSale: true,  instantDownload: true  },
  { id: 27, title: "Solar System Exploration Pack",          salePrice: "$7", originalPrice: "$11", seller: "Wild Oak Learning",     image: "/images/Nature Explorer Activity Book.png",   rating: 4.9, reviewCount: 152, onSale: false, instantDownload: true  },
  { id: 28, title: "Build-a-Bug Science Activity Set",       salePrice: "$6", originalPrice: "$9",  seller: "Acorn Learning Lab",    image: "/images/Nature Explorer Activity Book.png",   rating: 4.6, reviewCount: 41,  onSale: true,  instantDownload: true  },
];

// ── Flashcards ───────────────────────────────────────────────────────────────
export const flashcardProducts: Product[] = [
  { id: 7,  title: "ABC Flash Card Set (26 cards)",          salePrice: "$5", originalPrice: "$8",  seller: "Little Letter Co.",     image: "/images/ABC Flash Card Set (26 cards).png",   rating: 4.9, reviewCount: 762, onSale: true,  instantDownload: true  },
  { id: 13, title: "Sight Words Flash Card Set",             salePrice: "$5", originalPrice: "$8",  seller: "Little Knot Co.",       image: "/images/Sight Words Flash Card Set.png",       rating: 4.6, reviewCount: 405, onSale: true,  instantDownload: true  },
  { id: 29, title: "Number Flash Cards 1–100",               salePrice: "$6", originalPrice: "$9",  seller: "Little Letter Co.",     image: "/images/ABC Flash Card Set (26 cards).png",   rating: 4.8, reviewCount: 188, onSale: false, instantDownload: true  },
  { id: 30, title: "Shape & Color Flash Card Pack",          salePrice: "$4", originalPrice: "$7",  seller: "Tiny Sprout Studio",   image: "/images/Sight Words Flash Card Set.png",       rating: 4.7, reviewCount: 97,  onSale: true,  instantDownload: true  },
  { id: 31, title: "Animal Names Flash Card Set",            salePrice: "$5", originalPrice: "$8",  seller: "Meadow Lane Prints",    image: "/images/ABC Flash Card Set (26 cards).png",   rating: 4.8, reviewCount: 63,  onSale: false, instantDownload: true  },
];

// ── Party Kits ───────────────────────────────────────────────────────────────
export const partyKitProducts: Product[] = [
  { id: 5,  title: "Birthday Party Printable Kit",           salePrice: "$8", originalPrice: "$13", seller: "Honey Bee Prints",      image: "/images/Birthday Party Printable Kit.png",    rating: 4.8, reviewCount: 431, onSale: true,  instantDownload: true  },
  { id: 12, title: "Valentine's Day Party Kit",              salePrice: "$7", originalPrice: "$11", seller: "Sweet Pea Press",       image: "/images/Valentine's Day Party Kit for kids.png",rating: 4.7, reviewCount: 182, onSale: false, instantDownload: false },
  { id: 32, title: "Mermaid Party Printable Bundle",         salePrice: "$9", originalPrice: "$14", seller: "Honey Bee Prints",      image: "/images/Birthday Party Printable Kit.png",    rating: 4.9, reviewCount: 267, onSale: true,  instantDownload: true  },
  { id: 33, title: "Safari Birthday Party Pack",             salePrice: "$8", originalPrice: "$12", seller: "Sweet Pea Press",       image: "/images/Birthday Party Printable Kit.png",    rating: 4.7, reviewCount: 94,  onSale: false, instantDownload: true  },
  { id: 34, title: "Christmas Party Activity Kit",           salePrice: "$7", originalPrice: "$11", seller: "Honey Bee Prints",      image: "/images/Valentine's Day Party Kit for kids.png",rating: 4.8, reviewCount: 138, onSale: true,  instantDownload: true  },
];

// ── Trending (mixed featured picks) ─────────────────────────────────────────
export const printableProducts: Product[] = [
  worksheetProducts[0], // Alphabet Tracing
  coloringProducts[0],  // Under-the-Sea
  worksheetProducts[1], // Phonics Starter
  storybookProducts[0], // Bedtime Storybook
  partyKitProducts[0],  // Birthday Party Kit
  worksheetProducts[2], // Daily Routine
  flashcardProducts[0], // ABC Flash Cards
];

// ── Classroom (curated classroom picks) ─────────────────────────────────────
export const classroomProducts: Product[] = [
  activityProducts[0],  // Weather & Seasons
  coloringProducts[1],  // Dinosaur Coloring
  worksheetProducts[3], // Pre-K Writing
  activityProducts[1],  // Nature Explorer
  partyKitProducts[1],  // Valentine's Day
  flashcardProducts[1], // Sight Words
  activityProducts[2],  // Daily Gratitude
];

export const allProducts: Product[] = [
  ...worksheetProducts,
  ...coloringProducts,
  ...storybookProducts,
  ...activityProducts,
  ...flashcardProducts,
  ...partyKitProducts,
];
