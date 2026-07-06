"use client";

import { useCallback, useEffect, useState } from "react";
import { ItemCard } from "./ItemCard";
import { ItemDetail } from "./ItemDetail";
import { RentalItem } from "@/lib/types";

const CATEGORIES = ["All", "Sports", "Tools", "Electronics", "Kitchen", "Luxury"];

export function Marketplace() {
  const [items, setItems] = useState<RentalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/items");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load items");
      setItems(data.items);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = activeCategory === "All"
    ? items
    : items.filter((i) => i.category === activeCategory);

  const selectedItem = selectedId ? items.find((i) => i.id === selectedId) : null;

  if (selectedItem) {
    return (
      <ItemDetail
        item={selectedItem}
        onBack={() => setSelectedId(null)}
        onChanged={refresh}
      />
    );
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
      {loading ? (
        <p className="text-gray-500">Loading items…</p>
      ) : loadError ? (
        <p className="text-red-400 text-sm">{loadError}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} onClick={() => setSelectedId(item.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
