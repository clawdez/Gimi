"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Marketplace } from "@/components/Marketplace";
import { ListingAgent } from "@/components/ListingAgent";

export default function Home() {
  const [view, setView] = useState<"browse" | "list">("browse");

  return (
    <main className="min-h-screen">
      <Navbar onList={() => setView("list")} onBrowse={() => setView("browse")} />
      {view === "browse" ? (
        <>
          <Hero onList={() => setView("list")} />
          <Marketplace />
        </>
      ) : (
        <ListingAgent onDone={() => setView("browse")} />
      )}
    </main>
  );
}
