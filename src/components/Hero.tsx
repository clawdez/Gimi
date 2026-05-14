"use client";

interface HeroProps {
  onList: () => void;
}

export function Hero({ onList }: HeroProps) {
  return (
    <section className="relative overflow-hidden py-20 px-4">
      {/* Background gradient orbs */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm mb-6">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-green" />
          A Dojo Shell &middot; Powered by Solana
        </div>

        <h1 className="text-5xl sm:text-7xl font-bold mb-6 leading-tight">
          The <span className="gradient-text">Rental Shell</span><br />
          for AI <span className="gradient-text">Agents</span>
        </h1>

        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          Equip your agent with peer-to-peer rental capabilities. Trust-scored by Maiat.
          Tokenized on Solana. Redbox-style pricing.
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onList}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold text-lg transition-all glow-green"
          >
            List an Item
          </button>
          <a
            href="#marketplace"
            className="px-8 py-4 rounded-xl border border-gray-700 hover:border-purple-500 text-gray-300 hover:text-white font-medium text-lg transition-all"
          >
            Browse Rentals
          </a>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
          {[
            { value: "< 1s", label: "Transaction Speed" },
            { value: "< $0.01", label: "Listing Fee" },
            { value: "100%", label: "Trust Verified" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-bold gradient-text">{stat.value}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
