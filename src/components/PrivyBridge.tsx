"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PrivyProvider, useLogin, usePrivy } from "@privy-io/react-auth";
import {
  toSolanaWalletConnectors,
  useCreateWallet,
  useSignMessage as usePrivySolanaSignMessage,
  useSignTransaction as usePrivySolanaSignTransaction,
  useWallets as useSolanaWallets,
  type ConnectedStandardSolanaWallet,
} from "@privy-io/react-auth/solana";
import { clusterApiUrl, Connection } from "@solana/web3.js";
import bs58 from "bs58";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const bridgeLoginMethods = ["email", "google", "wallet"] as const;

function postToParent(message: Record<string, unknown>) {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(message, window.location.origin);
    return;
  }

  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, window.location.origin);
  }
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

type PendingPrivyTransaction = { transactionBase64: string; cluster: string };
type PrivySolanaSignMessage = ReturnType<typeof usePrivySolanaSignMessage>["signMessage"];
type PrivySolanaSignTransaction = ReturnType<typeof usePrivySolanaSignTransaction>["signTransaction"];

function privyClusterToChain(cluster: string) {
  return cluster === "solana:mainnet" || cluster === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
}

function clusterToRpcUrl(cluster: string) {
  return cluster === "solana:mainnet" || cluster === "mainnet-beta"
    ? clusterApiUrl("mainnet-beta")
    : clusterApiUrl("devnet");
}

async function signAndSendPrivyTransaction(
  wallet: ConnectedStandardSolanaWallet,
  pendingTx: PendingPrivyTransaction,
  signTransaction: PrivySolanaSignTransaction
) {
  const transaction = base64ToUint8Array(pendingTx.transactionBase64);
  const chain = privyClusterToChain(pendingTx.cluster);

  try {
    const { signedTransaction } = await signTransaction({
      transaction,
      wallet,
      chain,
    });
    return new Connection(clusterToRpcUrl(pendingTx.cluster), "confirmed").sendRawTransaction(signedTransaction);
  } catch (error) {
    try {
      const result = await wallet.signAndSendTransaction({ transaction, chain });
      return signatureToBase58(result);
    } catch {
      throw error;
    }
  }
}

function buildSignInMessage(address: string) {
  return [
    "Sign in to Gimi",
    "",
    "This signature proves wallet ownership and does not start a transaction.",
    `Wallet: ${address}`,
    `Issued at: ${new Date().toISOString()}`,
  ].join("\n");
}

async function signPrivyLoginMessage(wallet: ConnectedStandardSolanaWallet, signMessage: PrivySolanaSignMessage) {
  const message = buildSignInMessage(wallet.address);
  const { signature } = await signMessage({
    message: new TextEncoder().encode(message),
    wallet,
    options: {
      uiOptions: {
        title: "Sign in to Gimi",
        description: "Confirm this wallet for rental checkout.",
        buttonText: "Sign in",
      },
    },
  });

  return { message, signature: signatureToBase58(signature) };
}

function BridgeClient() {
  const [pending, setPending] = useState(false);
  const [pendingTx, setPendingTx] = useState<{ transactionBase64: string; cluster: string } | null>(null);
  const [status, setStatus] = useState("Ready to connect");
  const [routeAction, setRouteAction] = useState<"connect" | "send-transaction">("connect");
  const hasTriedCreate = useRef(false);
  const hasAutoStarted = useRef(false);
  const hasStartedAuthSigning = useRef(false);
  const hasStartedSigning = useRef(false);
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useSolanaWallets();
  const { createWallet } = useCreateWallet();
  const { signMessage } = usePrivySolanaSignMessage();
  const { signTransaction } = usePrivySolanaSignTransaction();

  const finish = useCallback((address: string, auth?: { message: string; signature: string }) => {
    setPending(false);
    setStatus("Wallet connected");
    postToParent({ type: "gimi:privy-wallet-connected", address, auth });
    if (window.opener && !window.opener.closed) {
      window.setTimeout(() => window.close(), 250);
    }
  }, []);

  const fail = useCallback((message: string) => {
    setPending(false);
    setPendingTx(null);
    setStatus(message);
    postToParent({ type: "gimi:privy-wallet-error", message });
  }, []);

  const finishTransaction = useCallback((signature: string) => {
    setPending(false);
    setPendingTx(null);
    hasStartedSigning.current = false;
    hasStartedAuthSigning.current = false;
    setStatus("Transaction sent");
    const payload = { type: "gimi:privy-transaction-sent", signature };
    try {
      window.localStorage.removeItem("gimi.pendingPrivyTransaction");
    } catch {}
    postToParent(payload);
    if (window.opener && !window.opener.closed) {
      window.setTimeout(() => window.close(), 250);
    }
  }, []);

  const { login } = useLogin({
    onComplete: () => {
      setPending(true);
      setStatus(pendingTx ? "Preparing your Solana wallet for checkout..." : "Preparing your Solana wallet...");
    },
    onError: () => {
      setPending(false);
      setStatus("Privy login was cancelled. Try again when ready.");
      postToParent({ type: "gimi:privy-wallet-error", message: "Privy login was cancelled. Try again when ready." });
    },
  });

  const startPrivyFlow = useCallback(() => {
    hasTriedCreate.current = false;
    hasStartedAuthSigning.current = false;
    setPending(true);

    if (!ready) {
      setStatus("Loading wallet login...");
      return;
    }

    if (!authenticated) {
      setStatus("Opening Privy...");
      login({
        loginMethods: [...bridgeLoginMethods],
      });
      return;
    }

    setStatus(pendingTx ? "Preparing your Solana wallet for checkout..." : "Preparing your Solana wallet...");
  }, [authenticated, login, pendingTx, ready]);

  useEffect(() => {
    postToParent({ type: "gimi:privy-ready" });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    hasAutoStarted.current = false;

    if (action === "connect") {
      setRouteAction("connect");
      hasTriedCreate.current = false;
      hasStartedAuthSigning.current = false;
      hasStartedSigning.current = false;
      setPending(false);
      setPendingTx(null);
      setStatus("Opening Privy...");
      return;
    }

    if (action === "send-transaction") {
      setRouteAction("send-transaction");
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
      hasStartedAuthSigning.current = false;
      hasStartedSigning.current = false;
      setPending(false);
      setPendingTx({ transactionBase64, cluster });
      setStatus("Opening Privy...");
    }
  }, [fail]);

  useEffect(() => {
    if (hasAutoStarted.current || !ready) return;
    if (routeAction === "send-transaction" && !pendingTx) return;

    hasAutoStarted.current = true;
    startPrivyFlow();
  }, [pendingTx, ready, routeAction, startPrivyFlow]);

  useEffect(() => {
    if (!pending || !ready || !authenticated || !walletsReady) return;

    const existingWallet = wallets[0] as ConnectedStandardSolanaWallet | undefined;
    const existing = existingWallet?.address;
    if (existing && existingWallet) {
      if (!pendingTx) {
        if (hasStartedAuthSigning.current) return;
        hasStartedAuthSigning.current = true;
        setStatus("Awaiting wallet sign-in message...");
        signPrivyLoginMessage(existingWallet, signMessage)
          .then((auth) => finish(existing, auth))
          .catch(() => {
            hasStartedAuthSigning.current = false;
            fail("Could not sign wallet login message");
          });
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
        setStatus(`Wallet ${wallet.address.slice(0, 4)}... created. Waiting for sign-in approval...`);
      })
      .catch(() => fail("Could not create Solana wallet"));
  }, [authenticated, createWallet, fail, finish, pending, pendingTx, ready, signMessage, wallets, walletsReady]);

  useEffect(() => {
    if (!pendingTx || !ready || !authenticated || !walletsReady) return;
    if (hasStartedSigning.current) return;

    const wallet = wallets[0] as ConnectedStandardSolanaWallet | undefined;

    if (!wallet) {
      fail("Connected wallet cannot sign this Solana transaction");
      return;
    }

    let cancelled = false;
    hasStartedSigning.current = true;
    setStatus("Awaiting transaction approval...");

    signAndSendPrivyTransaction(wallet, pendingTx, signTransaction)
      .then((signature) => {
        if (cancelled) return;
        if (!signature) {
          fail("Transaction sent but signature was unavailable");
          return;
        }
        finishTransaction(signature);
      })
      .catch(() => {
        if (cancelled) return;
        hasStartedSigning.current = false;
        fail("Could not sign rental transaction");
      });

    return () => {
      cancelled = true;
    };
  }, [authenticated, fail, finishTransaction, pendingTx, ready, signTransaction, wallets, walletsReady]);

  return (
    <main className="min-h-screen bg-transparent text-slate-950">
      <button
        type="button"
        onClick={() => fail("Privy login cancelled")}
        className="sr-only"
        aria-label="Close wallet login"
      >
        Close wallet login
      </button>
      <p className="sr-only">{status}</p>
    </main>
  );
}

function MissingPrivyAppId() {
  useEffect(() => {
    postToParent({ type: "gimi:privy-ready" });
    postToParent({
      type: "gimi:privy-wallet-error",
      message: "Privy app id is missing",
    });
  }, []);

  return (
    <main className="min-h-screen bg-transparent">
      <p className="sr-only">Missing NEXT_PUBLIC_PRIVY_APP_ID.</p>
    </main>
  );
}

export function PrivyBridge() {
  const [mounted, setMounted] = useState(false);
  const solanaConnectors = useMemo(() => toSolanaWalletConnectors(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-transparent text-slate-950">
        <p className="sr-only">Loading wallet login...</p>
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
        loginMethods: [...bridgeLoginMethods],
        appearance: {
          theme: "light",
          accentColor: "#c7ff00",
          landingHeader: "Connect to Gimi",
          loginMessage: "Use email, Google, or an existing Solana wallet.",
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
      <BridgeClient />
    </PrivyProvider>
  );
}
