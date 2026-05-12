"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PrivyProvider, useLogin, usePrivy } from "@privy-io/react-auth";
import { toSolanaWalletConnectors, useCreateWallet, useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

function postToParent(message: Record<string, unknown>) {
  window.parent?.postMessage(message, window.location.origin);
}

function BridgeClient() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("Ready to connect");
  const hasTriedCreate = useRef(false);
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useSolanaWallets();
  const { createWallet } = useCreateWallet();

  const finish = useCallback((address: string) => {
    setPending(false);
    setStatus("Wallet connected");
    postToParent({ type: "gimi:privy-wallet-connected", address });
  }, []);

  const fail = useCallback((message: string) => {
    setPending(false);
    setStatus(message);
    postToParent({ type: "gimi:privy-wallet-error", message });
  }, []);

  const { login } = useLogin({
    onComplete: () => {
      setPending(true);
      setStatus("Preparing your Solana wallet...");
    },
    onError: () => fail("Privy login cancelled"),
  });

  useEffect(() => {
    postToParent({ type: "gimi:privy-ready" });
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "gimi:connect-wallet") return;
      hasTriedCreate.current = false;
      setPending(true);

      if (!ready) {
        setStatus("Loading wallet login...");
        return;
      }

      if (!authenticated) {
        setStatus("Opening Privy...");
        login({
          loginMethods: ["email", "google", "wallet"],
        });
        return;
      }

      setStatus("Preparing your Solana wallet...");
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [authenticated, login, ready]);

  useEffect(() => {
    if (!pending || !ready || !authenticated || !walletsReady) return;

    const existing = wallets[0]?.address;
    if (existing) {
      finish(existing);
      return;
    }

    if (hasTriedCreate.current) return;
    hasTriedCreate.current = true;
    setStatus("Creating your Solana wallet...");
    createWallet()
      .then(({ wallet }) => finish(wallet.address))
      .catch(() => fail("Could not create Solana wallet"));
  }, [authenticated, createWallet, fail, finish, pending, ready, wallets, walletsReady]);

  return (
    <main className="min-h-screen bg-black/35 p-6 text-slate-950 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => fail("Privy login cancelled")}
        className="fixed right-6 top-6 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold shadow-lg"
      >
        Close
      </button>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-5 py-3 text-sm font-medium shadow-lg">
        {status}
      </div>
    </main>
  );
}

function MissingPrivyAppId() {
  useEffect(() => {
    postToParent({ type: "gimi:privy-ready" });

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "gimi:connect-wallet") return;
      postToParent({
        type: "gimi:privy-wallet-error",
        message: "Privy app id is missing",
      });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black/35 p-6 backdrop-blur-sm">
      <div className="max-w-sm rounded-2xl bg-white p-5 text-sm text-slate-800 shadow-xl">
        Missing <code>NEXT_PUBLIC_PRIVY_APP_ID</code>. Add it in Vercel and local env to enable wallet login.
      </div>
    </main>
  );
}

export function PrivyBridge() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-black/35 p-6 text-slate-950 backdrop-blur-sm">
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-5 py-3 text-sm font-medium shadow-lg">
          Loading wallet login...
        </div>
      </main>
    );
  }

  if (!privyAppId) {
    return <MissingPrivyAppId />;
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
          loginMessage: "Use email, Google, or a Solana wallet for checkout.",
          showWalletLoginFirst: false,
          walletChainType: "solana-only",
          walletList: ["detected_solana_wallets", "phantom", "solflare", "backpack"] as never,
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
      }}
    >
      <BridgeClient />
    </PrivyProvider>
  );
}
