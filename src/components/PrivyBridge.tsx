"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PrivyProvider, useLogin, usePrivy } from "@privy-io/react-auth";
import { toSolanaWalletConnectors, useCreateWallet, useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import bs58 from "bs58";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

function postToParent(message: Record<string, unknown>) {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(message, window.location.origin);
    return;
  }
  window.parent?.postMessage(message, window.location.origin);
}

function returnToApp(message: Record<string, unknown>) {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo") || "/gimi.html?v=soft1";
  try {
    window.localStorage.setItem("gimi.privyResult", JSON.stringify(message));
  } catch {}
  window.location.assign(returnTo);
}

function base64ToUint8Array(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function signatureToBase58(signature: unknown) {
  if (!signature) return "";
  if (typeof signature === "string") return signature;
  if (signature instanceof Uint8Array) return bs58.encode(signature);
  if (Array.isArray(signature)) return bs58.encode(Uint8Array.from(signature));
  if (typeof signature === "object" && signature && "signature" in signature) {
    return signatureToBase58((signature as { signature?: unknown }).signature);
  }
  return "";
}

function BridgeClient() {
  const [pending, setPending] = useState(false);
  const [pendingTx, setPendingTx] = useState<{ transactionBase64: string; cluster: string } | null>(null);
  const [status, setStatus] = useState("Ready to connect");
  const hasTriedCreate = useRef(false);
  const hasRequestedLogin = useRef(false);
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useSolanaWallets();
  const { createWallet } = useCreateWallet();

  const finish = useCallback((address: string) => {
    setPending(false);
    setStatus("Wallet connected");
    const payload = { type: "gimi:privy-wallet-connected", address };
    if (window.opener && !window.opener.closed) {
      postToParent(payload);
      window.setTimeout(() => window.close(), 150);
      return;
    }
    returnToApp(payload);
  }, []);

  const fail = useCallback((message: string) => {
    setPending(false);
    setPendingTx(null);
    setStatus(message);
    const payload = { type: "gimi:privy-wallet-error", message };
    if (window.opener && !window.opener.closed) {
      postToParent(payload);
      return;
    }
    returnToApp(payload);
  }, []);

  const finishTransaction = useCallback((signature: string) => {
    setPending(false);
    setPendingTx(null);
    setStatus("Transaction sent");
    const payload = { type: "gimi:privy-transaction-sent", signature };
    try {
      window.localStorage.removeItem("gimi.pendingPrivyTransaction");
    } catch {}
    if (window.opener && !window.opener.closed) {
      postToParent(payload);
      window.setTimeout(() => window.close(), 150);
      return;
    }
    returnToApp(payload);
  }, []);

  const { login } = useLogin({
    onComplete: () => {
      setPending(true);
      setStatus(pendingTx ? "Preparing your Solana wallet for checkout..." : "Preparing your Solana wallet...");
    },
    onError: () => fail("Privy login cancelled"),
  });

  useEffect(() => {
    postToParent({ type: "gimi:privy-ready" });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (action === "connect") {
      hasTriedCreate.current = false;
      setPending(true);
      setPendingTx(null);
      setStatus("Opening Privy...");
      return;
    }

    if (action === "send-transaction") {
      let transactionBase64 = "";
      let cluster = "solana:devnet";
      try {
        const raw = window.localStorage.getItem("gimi.pendingPrivyTransaction");
        if (raw) {
          const parsed = JSON.parse(raw) as { transactionBase64?: string; cluster?: string };
          transactionBase64 = parsed.transactionBase64 ?? "";
          cluster = parsed.cluster ?? cluster;
        }
      } catch {}

      if (!transactionBase64) {
        fail("Missing serialized transaction");
        return;
      }

      hasTriedCreate.current = false;
      setPending(true);
      setPendingTx({ transactionBase64, cluster });
      setStatus("Opening Privy...");
    }
  }, [fail]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      hasTriedCreate.current = false;

      if (event.data?.type === "gimi:send-transaction") {
        const transactionBase64 =
          typeof event.data.transactionBase64 === "string" ? event.data.transactionBase64 : "";
        const cluster = typeof event.data.cluster === "string" ? event.data.cluster : "solana:devnet";
        if (!transactionBase64) {
          fail("Missing serialized transaction");
          return;
        }
        setPending(true);
        setPendingTx({ transactionBase64, cluster });

        if (!ready) {
          setStatus("Loading wallet signer...");
          return;
        }

        if (!authenticated) {
          setStatus("Opening Privy...");
          login({
            loginMethods: ["email", "google", "wallet"],
          });
          return;
        }

        setStatus("Preparing your Solana wallet for checkout...");
        return;
      }

      if (event.data?.type !== "gimi:connect-wallet") return;
      setPending(true);
      setPendingTx(null);

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
  }, [authenticated, fail, login, ready]);

  useEffect(() => {
    if (!pending || !ready || authenticated || hasRequestedLogin.current) return;
    hasRequestedLogin.current = true;
    setStatus("Opening Privy...");
    login({
      loginMethods: ["email", "google", "wallet"],
    });
  }, [authenticated, login, pending, ready]);

  useEffect(() => {
    if (!authenticated) return;
    hasRequestedLogin.current = false;
  }, [authenticated]);

  useEffect(() => {
    if (!pending || !ready || !authenticated || !walletsReady) return;

    const existing = wallets[0]?.address;
    if (existing) {
      if (!pendingTx) {
        finish(existing);
      }
      return;
    }

    if (hasTriedCreate.current) return;
    hasTriedCreate.current = true;
    setStatus("Creating your Solana wallet...");
    createWallet()
      .then(({ wallet }) => {
        if (pendingTx) {
          setStatus("Wallet ready. Opening transaction approval...");
          return;
        }
        finish(wallet.address);
      })
      .catch(() => fail("Could not create Solana wallet"));
  }, [authenticated, createWallet, fail, finish, pending, pendingTx, ready, wallets, walletsReady]);

  useEffect(() => {
    if (!pendingTx || !ready || !authenticated || !walletsReady) return;

    const wallet = wallets[0] as
      | {
          signAndSendTransaction?: (args: { transaction: Uint8Array; chain: string }) => Promise<unknown>;
        }
      | undefined;

    if (!wallet?.signAndSendTransaction) {
      fail("Connected wallet cannot sign this Solana transaction");
      return;
    }

    let cancelled = false;
    setStatus("Awaiting transaction approval...");

    wallet
      .signAndSendTransaction({
        transaction: base64ToUint8Array(pendingTx.transactionBase64),
        chain: pendingTx.cluster,
      })
      .then((result) => {
        if (cancelled) return;
        const signature = signatureToBase58(result);
        if (!signature) {
          fail("Transaction sent but signature was unavailable");
          return;
        }
        finishTransaction(signature);
      })
      .catch(() => {
        if (cancelled) return;
        fail("Could not sign rental transaction");
      });

    return () => {
      cancelled = true;
    };
  }, [authenticated, fail, finishTransaction, pendingTx, ready, wallets, walletsReady]);

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
      if (event.data?.type !== "gimi:connect-wallet" && event.data?.type !== "gimi:send-transaction") return;
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
