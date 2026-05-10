"use client";

import { useState } from "react";
import Image from "next/image";
import { RentalItem, RentalReceipt } from "@/lib/types";

interface ItemDetailProps {
  item: RentalItem;
  onBack: () => void;
}

export function ItemDetail({ item, onBack }: ItemDetailProps) {
  const [hours, setHours] = useState(item.expectedHours);
  const [status, setStatus] = useState(item.status);
  const [receipt, setReceipt] = useState<RentalReceipt | null>(null);

  const grossFee = Math.min(Math.max(item.minimumFee, hours * item.ratePerHour), item.buyoutCap);
  const refundable = Math.max(0, item.buyoutCap - grossFee);
  const platformFee = Number((grossFee * 0.05).toFixed(2));

  async function startRental() {
    setStatus("rented");
  }

  function requestReturn() {
    setStatus("return_requested");
  }

  function confirmReturn() {
    setStatus("available");
    setReceipt({
      id: "receipt_returned_ok",
      sessionId: `session_${item.id}`,
      itemId: item.id,
      outcome: "returned_ok",
      grossFee,
      platformFee,
      ownerPayout: Number((grossFee - platformFee).toFixed(2)),
      renterRefund: refundable,
      rentalTokenStatus: "burned",
      createdAt: Date.now(),
    });
  }

  function buyout() {
    setStatus("buyout");
    setReceipt({
      id: "receipt_auto_buyout",
      sessionId: `session_${item.id}`,
      itemId: item.id,
      outcome: "auto_buyout",
      grossFee: item.buyoutCap,
      platformFee: Number((item.buyoutCap * 0.05).toFixed(2)),
      ownerPayout: Number((item.buyoutCap * 0.95).toFixed(2)),
      renterRefund: 0,
      rentalTokenStatus: "burned",
      createdAt: Date.now(),
    });
  }

  return (
    <div className="px-3 py-5 sm:px-5">
      <button onClick={onBack} className="mb-5 text-[11px] font-bold uppercase tracking-[0.08em] text-black underline underline-offset-4">
        Back to inventory
      </button>

      <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative aspect-[4/5] overflow-hidden border border-black bg-neutral-100 lg:aspect-[5/4]">
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
        </div>

        <div className="border-y border-black py-4 lg:border-y-0 lg:border-l lg:pl-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-black/55">{item.locationLabel}</p>
          <h1 className="mt-3 text-5xl font-black uppercase leading-[0.9] tracking-[-0.05em] text-black sm:text-7xl">{item.name}</h1>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-black/55">{item.brand} {item.model} / condition {item.condition}/10</p>
          <p className="mt-5 max-w-xl text-sm leading-6 text-black/70">{item.description}</p>

          <div className="mt-6 grid grid-cols-2 gap-px border border-black bg-black">
            <Metric label="Rate" value={`${item.ratePerHour} USDC/hr`} />
            <Metric label="Refundable escrow" value={`${item.buyoutCap} USDC`} />
            <Metric label="Expected fee" value={`${grossFee} USDC`} />
            <Metric label="Refund on return" value={`${refundable} USDC`} />
          </div>

          <div className="mt-5 border border-black p-4">
            <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-black">Rental hours</label>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 6, 8].map((value) => (
                <button
                  key={value}
                  onClick={() => setHours(value)}
                  className={`border border-black px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] ${
                    hours === value ? "bg-black text-white" : "bg-white text-black hover:bg-black hover:text-white"
                  }`}
                >
                  {value}h
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 border border-black p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-black">Agent settlement plan</p>
            <div className="mt-3 space-y-2 text-sm text-black/70">
              <p>Lock {item.buyoutCap} USDC refundable escrow.</p>
              <p>Mint non-transferable rental token to renter wallet.</p>
              <p>Meter runs at {item.ratePerHour} USDC/hr, then return or auto-buyout burns the token.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {status === "available" && (
              <button onClick={startRental} className="border border-black bg-black px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-white hover:bg-white hover:text-black">
                Start rental demo
              </button>
            )}
            {status === "rented" && (
              <>
                <button onClick={requestReturn} className="border border-black bg-black px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-white hover:bg-white hover:text-black">
                  Request return
                </button>
                <button onClick={buyout} className="border border-black px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-black hover:bg-black hover:text-white">
                  Keep it / buy out
                </button>
              </>
            )}
            {status === "return_requested" && (
              <button onClick={confirmReturn} className="border border-black bg-black px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-white hover:bg-white hover:text-black">
                Owner confirms return
              </button>
            )}
          </div>

          {receipt && (
            <div className="mt-6 border border-black bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-black">Onchain receipt</p>
              <p className="mt-2 text-lg font-black uppercase text-black">{receipt.outcome}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-black/70">
                <span>Fee: {receipt.grossFee} USDC</span>
                <span>Platform: {receipt.platformFee} USDC</span>
                <span>Owner: {receipt.ownerPayout} USDC</span>
                <span>Refund: {receipt.renterRefund} USDC</span>
                <span>Rental token: burned</span>
                <span>Reputation: +1 receipt</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-black/45">{label}</p>
      <p className="mt-2 text-lg font-black text-black">{value}</p>
    </div>
  );
}
