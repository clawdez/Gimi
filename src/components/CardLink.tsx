"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

export interface LinkedCardInfo {
  brand: string;
  last4: string;
}

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

interface CardLinkProps {
  onLinked: (card: LinkedCardInfo) => void;
  onCancel: () => void;
}

function CardForm({ onLinked, onCancel }: CardLinkProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    if (confirmError || !setupIntent) {
      setError(confirmError?.message ?? "Card link failed");
      setSubmitting(false);
      return;
    }
    const res = await fetch("/api/card/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setupIntentId: setupIntent.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Card link failed");
      setSubmitting(false);
      return;
    }
    onLinked(data.card);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Card only: hide Link/wallet upsells for a deterministic Redbox-style flow */}
      <PaymentElement
        options={{
          wallets: { applePay: "never", googlePay: "never", link: "never" },
        }}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold transition-colors disabled:opacity-50"
        >
          {submitting ? "Linking card..." : "Link card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-3 rounded-xl bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CardLink({ onLinked, onCancel }: CardLinkProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Card is linked to the signed-in session; no body needed.
      const res = await fetch("/api/card/setup", { method: "POST" });
      const data = await res.json();
      if (cancelled) return;
      if (res.status === 503 || !publishableKey) {
        setUnconfigured(true);
      } else if (!res.ok) {
        setError(data.message ?? data.error ?? "Could not start card setup");
      } else {
        setClientSecret(data.clientSecret);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (unconfigured || (!publishableKey && !clientSecret)) {
    return (
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-400">
        Payment not configured — card linking is unavailable in this environment.
        <button onClick={onCancel} className="block mt-2 text-gray-400 hover:text-white underline">
          Back
        </button>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        {error}
        <button onClick={onCancel} className="block mt-2 text-gray-400 hover:text-white underline">
          Back
        </button>
      </div>
    );
  }
  if (!clientSecret || !stripePromise) {
    return <p className="text-sm text-gray-500">Preparing card setup…</p>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
      <CardForm onLinked={onLinked} onCancel={onCancel} />
    </Elements>
  );
}
