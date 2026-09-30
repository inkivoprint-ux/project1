export type Product = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  category: string;
  price: number;
  compareAt?: number;
  image: string;
  views?: Array<{ id: "front" | "back"; label: string; image: string }>;
  finish: string;
  badge?: string;
  displayOrder?: number;
  description: string;
  printArea: { widthMm: number; heightMm: number; surface: "cylinder" | "tapered-cylinder" | "fabric"; diameterMm?: number };
};

export const products: Product[] = [
  {
    id: "bamboo-travel-mug",
    slug: "bamboo-travel-mug",
    name: "Bamboo Steel Travel Mug",
    shortName: "Bamboo Travel Mug",
    category: "Travel Mugs",
    price: 649,
    compareAt: 799,
    image: "/products/bamboo-travel-mug.png",
    finish: "Natural bamboo · 450 ml",
    badge: "Bestseller",
    description: "A warm bamboo wrap over insulated steel, ready for names, artwork, and memorable photographs.",
    printArea: { widthMm: 75, heightMm: 95, surface: "tapered-cylinder", diameterMm: 86 },
  },
  {
    id: "cork-base-bottle",
    slug: "cork-base-bottle",
    name: "Cork Base Smart Bottle",
    shortName: "Cork Base Bottle",
    category: "Water Bottles",
    price: 799,
    compareAt: 949,
    image: "/products/cork-base-bottle.png",
    finish: "Soft-touch black · 750 ml",
    badge: "New",
    description: "A refined soft-touch bottle with a natural cork base and generous wrap-around print area.",
    printArea: { widthMm: 82, heightMm: 120, surface: "cylinder", diameterMm: 74 },
  },
  {
    id: "loop-steel-bottle",
    slug: "loop-steel-bottle",
    name: "Loop Steel Everyday Bottle",
    shortName: "Loop Steel Bottle",
    category: "Steel Bottles",
    price: 749,
    compareAt: 899,
    image: "/products/loop-steel-bottle.png",
    finish: "Midnight black · 650 ml",
    description: "A durable daily bottle with an easy-carry loop, steel base, and clean personalisation surface.",
    printArea: { widthMm: 78, heightMm: 110, surface: "cylinder", diameterMm: 72 },
  },
  {
    id: "classic-cotton-tshirt",
    slug: "classic-cotton-tshirt",
    name: "Classic Cotton T-Shirt",
    shortName: "Cotton T-Shirt",
    category: "T-Shirts",
    price: 599,
    compareAt: 749,
    image: "/products/tshirt-front.png",
    views: [
      { id: "front", label: "Front", image: "/products/tshirt-front.png" },
      { id: "back", label: "Back", image: "/products/tshirt-back.png" },
    ],
    finish: "Premium cotton · Front & back print",
    badge: "New",
    description: "A soft everyday cotton tee with live fabric-aware artwork preview for both front and back print areas.",
    printArea: { widthMm: 280, heightMm: 360, surface: "fabric" },
  },
];

export const getProduct = (slug: string) => products.find((product) => product.slug === slug);

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
