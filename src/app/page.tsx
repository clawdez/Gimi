"use client";

import { Navbar } from "@/components/Navbar";
import { TablyAgent } from "@/components/TablyAgent";

export default function Home() {
  return (
    <main className="h-[100svh] overflow-hidden">
      <Navbar />
      <TablyAgent />
    </main>
  );
}
