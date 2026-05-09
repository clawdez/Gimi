"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

interface NavbarProps {
  onList: () => void;
  onBrowse: () => void;
}

export function Navbar({ onList, onBrowse }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button onClick={onBrowse} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-purple-500 flex items-center justify-center font-bold text-sm">
              R
            </div>
            <span className="text-xl font-bold gradient-text">RentChain</span>
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={onBrowse}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Browse
            </button>
            <button
              onClick={onList}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black transition-all"
            >
              + List Item
            </button>
            <WalletMultiButton className="!bg-purple-600 !rounded-lg !h-10 !text-sm" />
          </div>
        </div>
      </div>
    </nav>
  );
}
