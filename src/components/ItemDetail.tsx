"use client";

import { useEffect, useState } from "react";
import { RentalItem } from "@/lib/types";
import { CardLink, LinkedCardInfo } from "./CardLink";

interface ItemDetailProps {
  item: RentalItem;
  onBack: () => void;
  onChanged?: () => void;
}

interface RentConfirmation {
  rentalId: string;
  amountUsd: number;
  brand: string;
  last4: string;
  receiptUrl: string | null;
  receiptError?: string;
}

interface ReturnConfirmation {
  extraDays: number;
  overageUsd: number | null;
}

type Step = "idle" | "link-card" | "renting" | "confirmed";

const EMAIL_KEY = "gimi_renter_email";
const rentalKey = (itemId: string) => `gimi_rental_${itemId}`;

export function ItemDetail({ item, onBack, onChanged }: ItemDetailProps) {
  const [email, setEmail] = useState("");
  const [rentalDays, setRentalDays] = useState(3);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [paymentsConfigured, setPaymentsConfigured] = useState<boolean | null>(null);
  const [confirmation, setConfirmation] = useState<RentConfirmation | null>(null);
  const [returnResult, setReturnResult] = useState<ReturnConfirmation | null>(null);
  const [returning, setReturning] = useState(false);
  const [myRentalId, setMyRentalId] = useState<string | null>(null);

  const rented = item.status === "rented";
  const totalCost = item.dailyRate * rentalDays;
  const emailValid = /.+@.+\..+/.test(email);

  useEffect(() => {
    setEmail(localStorage.getItem(EMAIL_KEY) ?? "");
    setMyRentalId(localStorage.getItem(rentalKey(item.id)));
    fetch("/api/card/status")
      .then((r) => r.json())
      .then((d) => setPaymentsConfigured(Boolean(d.configured)))
      .catch(() => setPaymentsConfigured(false));
  }, [item.id]);

  function saveEmail(value: string) {
    setEmail(value);
    localStorage.setItem(EMAIL_KEY, value);
  }

  async function startRent() {
    setError(null);
    if (!emailValid) {
      setError("Enter your email to rent — that's your renter ID.");
      return;
    }
    const res = await fetch(`/api/card/status?email=${encodeURIComponent(email)}`);
    const status = await res.json();
    if (!status.configured) {
      setPaymentsConfigured(false);
      return;
    }
    if (!status.linked) {
      setStep("link-card");
      return;
    }
    await rent();
  }

  async function rent() {
    setStep("renting");
    setError(null);
    const res = await fetch("/api/rent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, renterEmail: email, rentalDays }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Rental failed");
      setStep("idle");
      return;
    }
    localStorage.setItem(rentalKey(item.id), data.rental.id);
    setMyRentalId(data.rental.id);
    setConfirmation({
      rentalId: data.rental.id,
      amountUsd: data.charge.amountUsd,
      brand: data.charge.brand,
      last4: data.charge.last4,
      receiptUrl: data.receipt?.explorerUrl ?? null,
      receiptError: data.receiptError,
    });
    setStep("confirmed");
    onChanged?.();
  }

  async function handleReturn() {
    if (!myRentalId) return;
    setReturning(true);
    setError(null);
    const res = await fetch("/api/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentalId: myRentalId }),
    });
    const data = await res.json();
    setReturning(false);
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Return failed");
      return;
    }
    localStorage.removeItem(rentalKey(item.id));
    setMyRentalId(null);
    setReturnResult({ extraDays: data.extraDays, overageUsd: data.overage?.amountUsd ?? null });
    onChanged?.();
  }

  const pricingTiers = [
    { label: `Days 1-${rentalDays}`, rate: `$${item.dailyRate}/day`, total: `$${totalCost}`, highlight: true },
    { label: `Late (per extra day)`, rate: `$${Math.round(item.dailyRate * item.overageMultiplier)}/day (+${Math.round((item.overageMultiplier - 1) * 100)}%)`, total: "Overage", highlight: false },
    { label: "30+ days", rate: "Full retail price", total: `$${item.retailPrice.toLocaleString()}`, highlight: false },
  ];

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
                <span className="text-[10px] text-gray-600">Trusted by Maiat</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full trust-bar rounded-full" style={{ width: `${item.trustScore}%` }} />
                </div>
                <span className="text-sm font-medium text-green-400">{item.trustScore}</span>
              </div>
            </div>
          </div>

          {/* Rental confirmed */}
          {step === "confirmed" && confirmation ? (
            <div className="bg-gray-900 border border-green-500/40 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-bold text-green-400 mb-3">Rental confirmed</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Charged to card</span>
                  <span className="capitalize">{confirmation.brand} •••• {confirmation.last4}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-green-400 font-medium">${confirmation.amountUsd}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Duration</span>
                  <span>{rentalDays} day{rentalDays > 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-800">
                {confirmation.receiptUrl ? (
                  <a
                    href={confirmation.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 underline"
                  >
                    View on-chain receipt (Solana devnet)
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <p className="text-xs text-yellow-400">
                    On-chain receipt pending{confirmation.receiptError ? ` (${confirmation.receiptError})` : ""} — your rental is confirmed and paid.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {/* Return result */}
          {returnResult && (
            <div className="bg-gray-900 border border-green-500/40 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-bold text-green-400 mb-2">Item returned</h3>
              {returnResult.extraDays > 0 ? (
                <p className="text-sm text-gray-300">
                  Returned {returnResult.extraDays} day{returnResult.extraDays > 1 ? "s" : ""} late — overage of{" "}
                  <span className="text-orange-400 font-medium">${returnResult.overageUsd}</span> charged to your card.
                </p>
              ) : (
                <p className="text-sm text-gray-300">Returned on time — no extra charges.</p>
              )}
            </div>
          )}

          {/* Pricing / rent box */}
          {step !== "confirmed" && !returnResult && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
              <div className="flex items-end gap-1 mb-4">
                <span className="text-4xl font-bold text-green-400">${item.dailyRate}</span>
                <span className="text-gray-500 mb-1">/day</span>
              </div>

              {paymentsConfigured === false && (
                <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
                  Payment not configured — renting is disabled in this environment.
                </div>
              )}

              {!rented && step !== "link-card" && (
                <>
                  {/* Renter id */}
                  <div className="mb-4">
                    <label className="text-sm text-gray-400 mb-2 block">Your email (renter ID)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => saveEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50"
                    />
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
                    <div className="border-t border-gray-700 pt-2 flex justify-between font-medium">
                      <span>Charged to your card now</span>
                      <span className="text-green-400">${totalCost.toLocaleString()}</span>
                    </div>
                  </div>
                </>
              )}

              {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

              {/* Action area */}
              {rented ? (
                myRentalId ? (
                  <button
                    onClick={handleReturn}
                    disabled={returning}
                    className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold text-lg transition-all disabled:opacity-50"
                  >
                    {returning ? "Processing return..." : "Return item"}
                  </button>
                ) : (
                  <div className="w-full py-3 rounded-xl bg-orange-500/20 text-orange-400 text-center font-medium">
                    Currently Rented
                  </div>
                )
              ) : step === "link-card" ? (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Link your card</h3>
                  <CardLink
                    email={email}
                    onLinked={(card: LinkedCardInfo) => {
                      setStep("idle");
                      setError(null);
                      void card;
                      rent();
                    }}
                    onCancel={() => setStep("idle")}
                  />
                </div>
              ) : (
                <button
                  onClick={startRent}
                  disabled={step === "renting" || paymentsConfigured === false}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold text-lg transition-all glow-green disabled:opacity-50"
                >
                  {step === "renting" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Charging card & minting receipt...
                    </span>
                  ) : (
                    `Rent for $${totalCost}`
                  )}
                </button>
              )}
            </div>
          )}

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
              Late returns are charged automatically to your linked card at {item.overageMultiplier}× the daily rate.
              Every paid rental mints an on-chain receipt on Solana devnet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
