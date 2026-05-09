"use client";

import { useState } from "react";
import { ItemCard } from "./ItemCard";
import { ItemDetail } from "./ItemDetail";
import { RentalItem } from "@/lib/types";

const SAMPLE_ITEMS: RentalItem[] = [
  {
    id: "1",
    name: "Callaway Rogue ST Max Irons",
    brand: "Callaway",
    model: "Rogue ST Max",
    condition: 7,
    description: "Full iron set (5-PW). Some scuffs on club heads but grips are solid. Great for weekend rounds.",
    imageUrl: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=400&h=300&fit=crop",
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
    imageUrl: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=300&fit=crop",
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
    imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=300&fit=crop",
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
    name: "KitchenAid Artisan Stand Mixer",
    brand: "KitchenAid",
    model: "Artisan 5-Quart",
    condition: 8,
    description: "Empire Red, comes with flat beater, dough hook, and wire whip.",
    imageUrl: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=400&h=300&fit=crop",
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
    imageUrl: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=300&fit=crop",
    dailyRate: 35,
    retailPrice: 2260,
    overageMultiplier: 2.0,
    status: "available",
    owner: "8pFG...n1Yk",
    category: "Luxury",
    trustScore: 97,
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: "6",
    name: "Bose QuietComfort Ultra Headphones",
    brand: "Bose",
    model: "QC Ultra",
    condition: 9,
    description: "Like new, includes case and cable. Best noise cancelling on the market.",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop",
    dailyRate: 10,
    retailPrice: 429,
    overageMultiplier: 1.5,
    status: "available",
    owner: "4wMN...j7Tp",
    category: "Electronics",
    trustScore: 91,
    createdAt: Date.now() - 86400000 * 1,
  },
];

const CATEGORIES = ["All", "Sports", "Tools", "Electronics", "Kitchen", "Luxury"];

export function Marketplace() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedItem, setSelectedItem] = useState<RentalItem | null>(null);

  const filtered = activeCategory === "All"
    ? SAMPLE_ITEMS
    : SAMPLE_ITEMS.filter((i) => i.category === activeCategory);

  if (selectedItem) {
    return <ItemDetail item={selectedItem} onBack={() => setSelectedItem(null)} />;
  }

  return (
    <section id="marketplace" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold">Available Rentals</h2>
        <span className="text-sm text-gray-500">{filtered.length} items</span>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === cat
                ? "bg-green-500 text-black"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Item grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => (
          <ItemCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
        ))}
      </div>
    </section>
  );
}
