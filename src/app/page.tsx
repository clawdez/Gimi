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
      <Navbar mode={mode} onModeChange={setMode} />
      {mode === "rent" && <TablyAgent />}
      {mode === "list" && <ListingAgent onDone={() => setMode("rent")} />}
      {mode === "history" && <ReceiptHistory />}
    </main>
  );
}
