"use client";

import { useState } from "react";
import { RentalItem } from "@/lib/types";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

interface ItemDetailProps {
  item: RentalItem;
  onBack: () => void;
}

export function ItemDetail({ item, onBack }: ItemDetailProps) {
  const { connected, publicKey } = useWallet();
  const [rentalDays, setRentalDays] = useState(3);
  const [renting, setRenting] = useState(false);
  const [rented, setRented] = useState(item.status === "rented");

  const totalCost = item.dailyRate * rentalDays;
  const depositAmount = Math.round(item.retailPrice * 0.5);

  const pricingTiers = [
    { label: `Days 1-${rentalDays}`, rate: `$${item.dailyRate}/day`, total: `$${totalCost}`, highlight: true },
    { label: `Days ${rentalDays + 1}-${rentalDays + 2}`, rate: `$${Math.round(item.dailyRate * item.overageMultiplier)}/day (+${Math.round((item.overageMultiplier - 1) * 100)}%)`, total: "Overage", highlight: false },
    { label: `Days ${rentalDays + 3}+`, rate: `$${Math.round(item.dailyRate * item.overageMultiplier * 1.5)}/day`, total: "Late penalty", highlight: false },
    { label: "30+ days", rate: "Full retail price", total: `$${item.retailPrice.toLocaleString()}`, highlight: false },
  ];

  async function handleRent() {
    if (!connected) return;
    setRenting(true);
    // Simulate on-chain transaction
    await new Promise((r) => setTimeout(r, 2000));
    setRenting(false);
    setRented(true);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to marketplace
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image */}
        <div className="rounded-2xl overflow-hidden bg-gray-800 aspect-[4/3]">
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        </div>

        {/* Details */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400">
              {item.category}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              rented ? "bg-orange-500/20 text-orange-400" : "bg-green-500/20 text-green-400"
            }`}>
              {rented ? "Rented" : "Available"}
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-2">{item.name}</h1>
          <p className="text-gray-400 mb-1">{item.brand} · {item.model}</p>
          <p className="text-gray-500 mb-6">{item.description}</p>

          {/* Condition & Trust */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-sm text-gray-500 mb-1">Condition</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${item.condition * 10}%` }} />
                </div>
                <span className="text-sm font-medium">{item.condition}/10</span>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-500">Owner Trust</span>
                <span className="text-[10px] text-gray-600">Powered by Maiat</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full trust-bar rounded-full" style={{ width: `${item.trustScore}%` }} />
                </div>
                <span className="text-sm font-medium text-green-400">{item.trustScore}</span>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-end gap-1 mb-4">
              <span className="text-4xl font-bold text-green-400">${item.dailyRate}</span>
              <span className="text-gray-500 mb-1">/day</span>
            </div>

            {/* Rental duration selector */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-2 block">Rental duration</label>
              <div className="flex gap-2">
                {[1, 3, 5, 7, 14].map((d) => (
                  <button
                    key={d}
                    onClick={() => setRentalDays(d)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      rentalDays === d
                        ? "bg-green-500 text-black"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {/* Cost breakdown */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Rental ({rentalDays} days)</span>
                <span>${totalCost}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Security deposit (refundable)</span>
                <span>${depositAmount.toLocaleString()}</span>
              </div>
              <div className="border-t border-gray-700 pt-2 flex justify-between font-medium">
                <span>Total due now</span>
                <span className="text-green-400">${(totalCost + depositAmount).toLocaleString()}</span>
              </div>
            </div>

            {/* Rent button */}
            {rented ? (
              <div className="w-full py-3 rounded-xl bg-orange-500/20 text-orange-400 text-center font-medium">
                Currently Rented
              </div>
            ) : !connected ? (
              <div className="flex justify-center">
                <WalletMultiButton className="!bg-purple-600 !rounded-xl !h-12 !text-base !w-full !justify-center" />
              </div>
            ) : (
              <button
                onClick={handleRent}
                disabled={renting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold text-lg transition-all glow-green disabled:opacity-50"
              >
                {renting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Confirming on Solana...
                  </span>
                ) : (
                  `Rent for $${totalCost} + deposit`
                )}
              </button>
            )}
          </div>

          {/* Dynamic pricing table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Dynamic Pricing (Redbox-style)</h3>
            <div className="space-y-2">
              {pricingTiers.map((tier, i) => (
                <div key={i} className={`flex items-center justify-between text-sm rounded-lg px-3 py-2 ${
                  tier.highlight ? "bg-green-500/10 text-green-400" : "text-gray-500"
                }`}>
                  <span>{tier.label}</span>
                  <span>{tier.rate}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-3">
              Retail backstop: ${item.retailPrice.toLocaleString()} — if not returned after 30 days, full retail price is charged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
