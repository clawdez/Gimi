"use client";

import Image from "next/image";
import { RentalItem } from "@/lib/types";

interface ItemCardProps {
  item: RentalItem;
  onClick: () => void;
}

const statusCopy: Record<RentalItem["status"], string> = {
  available: "Available",
  rented: "Meter active",
  return_requested: "Return pending",
  buyout: "Bought out",
  disputed: "Frozen",
};

export function ItemCard({ item, onClick }: ItemCardProps) {
  const expectedFee = Math.max(item.minimumFee, item.expectedHours * item.ratePerHour);
  const isAvailable = item.status === "available";

  return (
    <button
      onClick={onClick}
      className="group text-left"
    >
      <div className="relative aspect-[4/5] overflow-hidden border border-black bg-neutral-100">
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span
          className={`absolute left-2 top-2 border border-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
            isAvailable ? "bg-white text-black" : "bg-black text-white"
          }`}
        >
          {statusCopy[item.status]}
        </span>
      </div>

      <div className="pt-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase leading-tight tracking-[-0.02em] text-black">{item.name}</h3>
            <p className="mt-1 text-[11px] uppercase tracking-[0.06em] text-black/50">{item.locationLabel}</p>
          </div>
          <span className="text-[11px] font-bold text-black">{item.ownerScore}</span>
        </div>

        <div className="mt-2 space-y-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-black">
          <p>{item.ratePerHour} USDC/hr</p>
          <p className="text-black/50">Escrow {item.buyoutCap} / expected {expectedFee}</p>
          <p className="text-black/50">{item.returnedOkCount} returns ok</p>
        </div>
      </div>
    </button>
  );
}
