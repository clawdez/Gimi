"use client";

import { FC, ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

export const WalletProviderWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  const solanaConnectors = useMemo(() => toSolanaWalletConnectors(), []);
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const hasUsablePrivyAppId = Boolean(privyAppId && /^[a-z0-9_-]{20,}$/i.test(privyAppId));
  const isPrivyBridgeRoute = pathname?.startsWith("/privy-bridge");

  useEffect(() => {
    setMounted(true);
  }, []);

  const walletTree = (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={mounted}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );

  if (!mounted) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f3ea] text-sm font-bold text-[#607489]">
        Loading Tably...
      </div>
    );
  }

  if (isPrivyBridgeRoute) {
    return <>{children}</>;
  }

  if (!hasUsablePrivyAppId || !privyAppId) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f3ea] px-6 text-center">
        <div className="max-w-md rounded-[28px] border border-white/80 bg-white/82 p-6 shadow-[0_24px_70px_rgba(6,23,37,0.12)] backdrop-blur-2xl">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#6b4cff]">Privy setup needed</p>
          <h1 className="mt-3 text-3xl font-black text-[#061725]">Add a valid Privy app id</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-[#607489]">
            Set NEXT_PUBLIC_PRIVY_APP_ID in Vercel or .env.local, then reload the app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email", "google", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#c7ff00",
          landingHeader: "Connect to Gimi",
          loginMessage: "Rent with an embedded Solana wallet or your existing wallet.",
          showWalletLoginFirst: false,
          walletChainType: "solana-only",
          walletList: ["detected_solana_wallets", "phantom", "solflare", "backpack"] as never,
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
      }}
    >
      {walletTree}
    </PrivyProvider>
  );
};
