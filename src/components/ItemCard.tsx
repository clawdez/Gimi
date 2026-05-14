"use client";

import { RentalItem } from "@/lib/types";

interface ItemCardProps {
  item: RentalItem;
  onClick: () => void;
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  const statusColors = {
    available: "bg-green-500/20 text-green-400 border-green-500/30",
    rented: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    overdue: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <button
      onClick={onClick}
      className="card-hover rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden text-left w-full"
    >
      {/* Image */}
      <div className="relative h-48 bg-gray-800 overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3">
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[item.status]}`}>
            {item.status === "available" ? "Available" : item.status === "rented" ? "Rented" : "Overdue"}
          </span>
        </div>
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
          <span className="text-xs text-gray-300">{item.category}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-white mb-1 truncate">{item.name}</h3>
        <p className="text-sm text-gray-500 mb-3">{item.brand} · Condition {item.condition}/10</p>

        <div className="flex items-end justify-between">
          <div>
            <span className="text-2xl font-bold text-green-400">${item.dailyRate}</span>
            <span className="text-sm text-gray-500">/day</span>
          </div>
          <div className="flex items-center gap-1">
            <TrustBadge score={item.trustScore} />
          </div>
        </div>
      </div>
    </button>
  );
}

function TrustBadge({ score }: { score: number }) {
  const color = score >= 90 ? "text-green-400" : score >= 70 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1">
        <svg className={`w-4 h-4 ${color}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 1l2.39 4.84L17.3 6.7l-3.65 3.56.86 5.02L10 13.01l-4.51 2.37.86-5.02L2.7 6.8l4.91-.86L10 1z" />
        </svg>
        <span className={`text-xs font-medium ${color}`}>{score}</span>
      </div>
      <span className="text-[10px] text-gray-600">Trusted by Maiat</span>
    </div>
  );
}
