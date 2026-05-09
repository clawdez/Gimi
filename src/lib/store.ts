import { RentalItem } from "./types";

// In-memory store for hackathon MVP — would be on-chain + database in production
const SAMPLE_ITEMS: RentalItem[] = [
  {
    id: "1",
    name: "Callaway Rogue ST Max Irons",
    brand: "Callaway",
    model: "Rogue ST Max",
    condition: 7,
    description: "Full iron set (5-PW). Some scuffs on club heads but grips are solid. Great for weekend rounds.",
    imageUrl: "/items/golf-clubs.jpg",
    dailyRate: 20,
    retailPrice: 1800,
    overageMultiplier: 1.5,
    status: "available",
    owner: "7xKX...m3Qp",
    category: "Sports",
    trustScore: 92,
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: "2",
    name: "DeWalt 20V MAX Drill Kit",
    brand: "DeWalt",
    model: "DCD771C2",
    condition: 8,
    description: "Barely used drill with 2 batteries and charger. Perfect for home projects.",
    imageUrl: "/items/drill.jpg",
    dailyRate: 8,
    retailPrice: 149,
    overageMultiplier: 1.5,
    status: "available",
    owner: "3kPQ...x9Rv",
    category: "Tools",
    trustScore: 88,
    createdAt: Date.now() - 86400000 * 1,
  },
  {
    id: "3",
    name: "Sony A7 III Camera Body",
    brand: "Sony",
    model: "A7 III (ILCE-7M3)",
    condition: 9,
    description: "Excellent condition, low shutter count (~5k). Body only — bring your own lens.",
    imageUrl: "/items/camera.jpg",
    dailyRate: 45,
    retailPrice: 1999,
    overageMultiplier: 2.0,
    status: "available",
    owner: "9mNB...w2Lk",
    category: "Electronics",
    trustScore: 95,
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: "4",
    name: "KitchenAid Stand Mixer",
    brand: "KitchenAid",
    model: "Artisan 5-Quart",
    condition: 8,
    description: "Empire Red, comes with flat beater, dough hook, and wire whip. Used a handful of times.",
    imageUrl: "/items/mixer.jpg",
    dailyRate: 12,
    retailPrice: 449,
    overageMultiplier: 1.5,
    status: "rented",
    owner: "5jRT...k8Wp",
    renter: "2nVX...p4Qs",
    rentalStart: Date.now() - 86400000 * 2,
    rentalDays: 5,
    category: "Kitchen",
    trustScore: 90,
    createdAt: Date.now() - 86400000 * 7,
  },
  {
    id: "5",
    name: "Louis Vuitton Keepall 55",
    brand: "Louis Vuitton",
    model: "Keepall Bandoulière 55",
    condition: 9,
    description: "Monogram canvas, excellent condition. Perfect for a weekend trip or event.",
    imageUrl: "/items/lv-bag.jpg",
    dailyRate: 35,
    retailPrice: 2260,
    overageMultiplier: 2.0,
    status: "available",
    owner: "8pFG...n1Yk",
    category: "Luxury",
    trustScore: 97,
    createdAt: Date.now() - 86400000 * 2,
  },
];

let items = [...SAMPLE_ITEMS];

export function getItems(): RentalItem[] {
  return items;
}

export function getItem(id: string): RentalItem | undefined {
  return items.find((i) => i.id === id);
}

export function addItem(item: RentalItem): void {
  items = [item, ...items];
}

export function rentItem(id: string, renter: string, days: number): void {
  items = items.map((i) =>
    i.id === id
      ? { ...i, status: "rented" as const, renter, rentalStart: Date.now(), rentalDays: days }
      : i
  );
}
