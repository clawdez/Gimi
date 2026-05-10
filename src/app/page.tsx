"use client";

import { Navbar } from "@/components/Navbar";
import { TablyAgent } from "@/components/TablyAgent";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <TablyAgent />
    </main>
  );
}
