"use client";

import { useEffect, useMemo } from "react";
import { useCreateWallet, useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { useLogin, usePrivy } from "@privy-io/react-auth";

interface PrivyWalletButtonProps {
  className?: string;
  connectedLabel?: string;
  connectLabel?: string;
  onAddress?: (address: string) => void;
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function PrivyWalletButton({
  className = "",
  connectedLabel = "Continue",
  connectLabel = "Connect wallet",
  onAddress,
}: PrivyWalletButtonProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useSolanaWallets();
  const { createWallet } = useCreateWallet();
  const { login } = useLogin();

  const address = useMemo(() => wallets[0]?.address ?? "", [wallets]);

  useEffect(() => {
    if (address) onAddress?.(address);
  }, [address, onAddress]);

  async function handleConnect() {
    if (!appId || !ready) return;

    if (!authenticated) {
      login({
        loginMethods: ["email", "google", "wallet"],
      });
      return;
    }

    if (!address && walletsReady) {
      await createWallet();
    }
  }

  if (!appId) {
    return (
      <div className="w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-200">
        Add NEXT_PUBLIC_PRIVY_APP_ID to enable Privy wallet login.
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={!ready}
      className={className}
    >
      {address ? `${connectedLabel} · ${shortAddress(address)}` : connectLabel}
    </button>
  );
}
