"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

interface NavbarProps {
  onList: () => void;
  onBrowse: () => void;
}

export function Navbar({ onList, onBrowse }: NavbarProps) {
  const { user, loading, openSignIn, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button onClick={onBrowse} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-purple-500 flex items-center justify-center font-bold text-sm">
              G
            </div>
            <span className="text-xl font-bold gradient-text">Gimi</span>
            <span className="text-xs text-gray-500 ml-1 self-end mb-0.5">Rental Shell</span>
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

            {loading ? (
              <div className="w-20 h-9 rounded-lg bg-gray-800 animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  data-testid="account-button"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors max-w-[200px]"
                >
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-green-400 flex items-center justify-center text-[10px] font-bold text-black uppercase">
                    {user.email?.[0] ?? "?"}
                  </span>
                  <span className="truncate">{user.email}</span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-44 rounded-xl border border-gray-800 bg-gray-900 shadow-xl overflow-hidden">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        void signOut();
                      }}
                      data-testid="signout-button"
                      className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={openSignIn}
                data-testid="signin-button"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
