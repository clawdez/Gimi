"use client";

import { useState } from "react";
import { ListingAgent } from "@/components/ListingAgent";
import { Navbar } from "@/components/Navbar";
import { ReceiptHistory } from "@/components/ReceiptHistory";
import { TablyAgent } from "@/components/TablyAgent";

export default function Home() {
  const [mode, setMode] = useState<"rent" | "list" | "history">("rent");

  return (
    <main className="min-h-[100svh] bg-[#f7f3ea]">
      <Navbar />
      <div className="fixed left-1/2 top-[86px] z-[60] flex -translate-x-1/2 rounded-full border border-white/80 bg-white/82 p-1 shadow-[0_16px_48px_rgba(6,23,37,0.12)] backdrop-blur-xl sm:top-[96px]">
        <button
          type="button"
          onClick={() => setMode("rent")}
          className={`min-h-[34px] rounded-full px-4 text-[12px] font-black transition ${
            mode === "rent" ? "bg-[#061725] text-white" : "text-[#607489] hover:text-[#061725]"
          }`}
        >
          Rent item
        </button>
        <button
          type="button"
          onClick={() => setMode("list")}
          className={`min-h-[34px] rounded-full px-4 text-[12px] font-black transition ${
            mode === "list" ? "bg-[#c8ff18] text-[#061725]" : "text-[#607489] hover:text-[#061725]"
          }`}
        >
          List item
        </button>
        <button
          type="button"
          onClick={() => setMode("history")}
          className={`min-h-[34px] rounded-full px-4 text-[12px] font-black transition ${
            mode === "history" ? "bg-[#ff7867] text-white" : "text-[#607489] hover:text-[#061725]"
          }`}
        >
          Receipts
        </button>
      </div>
      {mode === "rent" && <TablyAgent />}
      {mode === "list" && <ListingAgent onDone={() => setMode("rent")} />}
      {mode === "history" && <ReceiptHistory />}
    </main>
  );
}
