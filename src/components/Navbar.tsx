"use client";

import { useCrossmintAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useState } from "react";

type AppMode = "rent" | "list" | "history";

const crossmintConfigured = Boolean(process.env.NEXT_PUBLIC_CROSSMINT_API_KEY);

export function Navbar({ mode, onModeChange }: { mode: AppMode; onModeChange: (mode: AppMode) => void }) {
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const { login, status: authStatus } = useCrossmintAuth();
  const { wallet: crossmintWallet, status: walletStatus } = useWallet();
  const solanaWallet = useSolanaWallet();
  const { setVisible } = useWalletModal();
  const connectedWallet = crossmintWallet?.address ?? solanaWallet.publicKey?.toBase58() ?? "";
  const isBusy = authStatus === "in-progress" || walletStatus === "in-progress" || solanaWallet.connecting;

  return (
    <nav className="fixed inset-x-0 top-0 z-50 bg-transparent px-4 py-4 sm:px-8">
      <div className="relative mx-auto flex min-h-14 max-w-[1480px] flex-wrap items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#061725]">
        <div className="flex items-center gap-3">
          <a
            href="#"
            className="rounded-full bg-[#c8ff18] px-5 py-2.5 text-[20px] leading-none tracking-[0.16em] shadow-[0_14px_34px_rgba(100,139,0,0.18)] sm:px-6 sm:py-3 sm:text-[22px]"
          >
            TABLY+
          </a>
          <span className="hidden rounded-full border border-white/70 bg-white/66 px-5 py-3 text-[13px] normal-case tracking-normal text-[#6b4cff] shadow-[0_14px_34px_rgba(83,83,180,0.12)] backdrop-blur-xl sm:inline-flex">
            GenUI
          </span>
        </div>

        <ModeSwitch
          mode={mode}
          onModeChange={(nextMode) => {
            setWalletMenuOpen(false);
            onModeChange(nextMode);
          }}
        />

        <div className="relative flex items-center gap-4">
          <button
            type="button"
            onClick={() => setWalletMenuOpen((open) => !open)}
            disabled={isBusy}
            className="flex min-h-[42px] items-center gap-2 rounded-full bg-[#061725] px-2.5 py-2 text-[12px] font-black normal-case tracking-normal text-white shadow-[0_14px_34px_rgba(6,23,37,0.18)] transition hover:bg-[#c8ff18] hover:text-[#061725] disabled:cursor-wait disabled:opacity-60 sm:px-3 sm:text-[13px]"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[linear-gradient(135deg,#ffb199,#6b83ff)] text-[12px] sm:h-8 sm:w-8">
              {connectedWallet ? connectedWallet[0] : "J"}
            </span>
            <span>{isBusy ? "Connecting..." : connectedWallet ? shortKey(connectedWallet) : "Connect"}</span>
            <span className="text-current/60">v</span>
          </button>

          {walletMenuOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[260px] rounded-[24px] border border-white/80 bg-white/96 p-2 text-left normal-case tracking-normal shadow-[0_24px_70px_rgba(6,23,37,0.18)] backdrop-blur-2xl">
              {connectedWallet && (
                <div className="mb-2 rounded-[18px] bg-[#efffd1] px-4 py-3 text-[12px] font-black text-[#365f00]">
                  Connected {shortKey(connectedWallet)}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (crossmintConfigured) login();
                  setWalletMenuOpen(false);
                }}
                className="w-full rounded-[18px] bg-[#061725] px-4 py-3 text-left text-[13px] font-black text-white transition hover:bg-[#c8ff18] hover:text-[#061725]"
              >
                Crossmint
                <span className="mt-1 block text-[11px] font-bold opacity-70">
                  {crossmintConfigured ? "Email or Google wallet" : "Add client key to enable"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVisible(true);
                  setWalletMenuOpen(false);
                }}
                className="mt-2 w-full rounded-[18px] border border-[#dfe7ef] bg-white px-4 py-3 text-left text-[13px] font-black text-[#061725] transition hover:border-[#6b4cff]"
              >
                Solana wallet
                <span className="mt-1 block text-[11px] font-bold text-[#607489]">Phantom, Backpack, Solflare</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function ModeSwitch({ mode, onModeChange }: { mode: AppMode; onModeChange: (mode: AppMode) => void }) {
  const modes: Array<{ key: AppMode; label: string }> = [
    { key: "rent", label: "Rent" },
    { key: "list", label: "List" },
    { key: "history", label: "Receipts" },
  ];

  return (
    <div className="order-3 mx-auto flex rounded-full border border-white/80 bg-white/82 p-1 shadow-[0_16px_48px_rgba(6,23,37,0.12)] backdrop-blur-xl sm:order-none sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
      {modes.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onModeChange(item.key)}
          className={`min-h-[34px] rounded-full px-4 text-[12px] font-black normal-case tracking-normal transition ${
            mode === item.key ? activeModeClass(item.key) : "text-[#607489] hover:text-[#061725]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function activeModeClass(mode: AppMode) {
  if (mode === "list") return "bg-[#c8ff18] text-[#061725]";
  if (mode === "history") return "bg-[#ff7867] text-white";
  return "bg-[#061725] text-white";
}

function shortKey(value: string) {
  if (value.length < 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
