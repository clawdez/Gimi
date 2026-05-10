"use client";

import { useState } from "react";
import { ItemCard } from "./ItemCard";
import { ItemDetail } from "./ItemDetail";
import { RentalItem } from "@/lib/types";
import { getItems } from "@/lib/store";

export function Marketplace() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedItem, setSelectedItem] = useState<RentalItem | null>(null);
  const items = getItems();
  const categories = ["All", ...Array.from(new Set(items.map((item) => item.category)))];

  const filtered =
    activeCategory === "All"
      ? items
      : items.filter((item) => item.category === activeCategory);

  if (selectedItem) {
    return <ItemDetail item={selectedItem} onBack={() => setSelectedItem(null)} />;
  }

  return (
    <section id="marketplace" className="bg-white px-3 py-6 sm:px-5">
      <div className="mb-4 flex flex-col gap-3 border-b border-black pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black">Shop</p>
          <h2 className="mt-1 text-3xl font-black uppercase leading-none tracking-[-0.04em] text-black sm:text-5xl">Community inventory</h2>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-black">
          <span>{filtered.length} active offers</span>
          <a href="#agent" className="underline underline-offset-4">Ask agent</a>
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
              activeCategory === category
                ? "border-black bg-black text-white"
                : "border-black bg-white text-black hover:bg-black hover:text-white"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((item) => (
          <ItemCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
        ))}
      </div>
    </section>
  );
}
