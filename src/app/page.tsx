"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Marketplace } from "@/components/Marketplace";
import { ListingAgent } from "@/components/ListingAgent";

export default function Home() {
  const [view, setView] = useState<"browse" | "list">("browse");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("auth_error");
    if (err) {
      setAuthError(err);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  return (
    <main className="min-h-screen">
      <Navbar onList={() => setView("list")} onBrowse={() => setView("browse")} />
      {authError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <span>Sign-in failed: {authError}. Request a new link and try again.</span>
            <button onClick={() => setAuthError(null)} aria-label="Dismiss" className="text-red-400 hover:text-white ml-4">
              ✕
            </button>
          </div>
        </div>
      )}
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
