"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

type HistoryStatus = "loading" | "ready" | "error";

interface ReceiptHistoryRecord {
  id: string;
  rentalId: string;
  itemId: string;
  item: {
    id: string;
    name: string;
    imageUrl: string;
    category: string;
    locationLabel: string;
    ownerScore: number;
    status: string;
  } | null;
  outcome: "returned_ok" | "auto_buyout" | "disputed";
  settlementSignature: string;
  explorerUrl: string;
  grossFee: string;
  platformFee: string;
  ownerPayout: string;
  renterRefund: string;
  amounts: {
    grossFee: ReceiptDisplayAmount;
    platformFee: ReceiptDisplayAmount;
    ownerPayout: ReceiptDisplayAmount;
    renterRefund: ReceiptDisplayAmount;
  };
  ownerWallet: string;
  renterWallet: string;
  ownerWalletShort: string;
  renterWalletShort: string;
  paymentMint: string;
  rentalTokenStatus: "burned";
  createdAt: string;
}

interface ReceiptDisplayAmount {
  raw: string;
  uiAmount: string;
  decimals: number;
  symbol: "USDC";
}

interface HistoryPayload {
  receipts?: ReceiptHistoryRecord[];
  count?: number;
  storage?: string;
  error?: string;
}

export function ReceiptHistory() {
  const [status, setStatus] = useState<HistoryStatus>("loading");
  const [receipts, setReceipts] = useState<ReceiptHistoryRecord[]>([]);
  const [error, setError] = useState("");
  const [walletFilter, setWalletFilter] = useState("");
  const [rentalIdFilter, setRentalIdFilter] = useState("");
  const [activeQuery, setActiveQuery] = useState({ wallet: "", rentalId: "" });
  const [storageKind, setStorageKind] = useState("");

  const summary = useMemo(() => summarizeReceipts(receipts), [receipts]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReceipts(activeQuery, controller.signal);
    return () => controller.abort();
  }, [activeQuery]);

  async function loadReceipts(query: { wallet: string; rentalId: string }, signal?: AbortSignal) {
    setStatus("loading");
    setError("");

    try {
      const params = new URLSearchParams({ limit: "20" });
      if (query.wallet) params.set("wallet", query.wallet);
      if (query.rentalId) params.set("rentalId", query.rentalId);

      const res = await fetch(`/api/rentals/history?${params.toString()}`, { cache: "no-store", signal });
      const data = (await res.json()) as HistoryPayload;
      if (!res.ok) throw new Error(data.error ?? "Unable to load receipts");

      setReceipts(data.receipts ?? []);
      setStorageKind(data.storage ?? "");
      setStatus("ready");
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "Unable to load receipts");
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveQuery({
      wallet: walletFilter.trim(),
      rentalId: rentalIdFilter.trim(),
    });
  }

  function clearFilters() {
    setWalletFilter("");
    setRentalIdFilter("");
    setActiveQuery({ wallet: "", rentalId: "" });
  }

  return (
    <section className="grain-field relative min-h-[100svh] overflow-y-auto overflow-x-hidden bg-[#f7f3ea] px-4 pb-8 pt-20 text-[#061725] sm:px-8 sm:pb-8 sm:pt-24 lg:h-[100svh] lg:overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(200,255,24,0.28),transparent_24%),radial-gradient(circle_at_88%_18%,rgba(255,120,103,0.24),transparent_24%),radial-gradient(circle_at_62%_82%,rgba(95,214,255,0.22),transparent_28%),linear-gradient(135deg,#fffaf0_0%,#f7fbff_48%,#fbf3ff_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0.24)_48%,rgba(255,255,255,0.82)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-112px)] max-w-6xl items-start justify-center py-4 lg:h-full lg:min-h-0 lg:items-center lg:py-0">
        <div className="grid w-full gap-4 lg:max-h-[calc(100svh-132px)] lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="rounded-[34px] bg-white/72 p-4 shadow-[0_30px_100px_rgba(6,23,37,0.12)] ring-1 ring-white/80 backdrop-blur-2xl sm:p-5">
            <div className="inline-flex rounded-full bg-[#c8ff18] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#061725]">
              Receipts
            </div>
            <h1 className="mt-4 text-[34px] font-black leading-[0.95] tracking-normal text-[#061725] sm:text-[48px]">
              Rental history that proves what happened.
            </h1>
            <p className="mt-4 max-w-md text-[14px] font-bold leading-6 text-[#53697d] sm:text-[15px]">
              Settled returns and buyouts are pulled from Gimi receipt storage, linked back to the item, and tied to the Solana devnet transaction.
            </p>

            <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-[22px] border border-[#e8edf2] bg-white/78 text-center">
              <Metric label="Receipts" value={String(summary.total)} />
              <Metric label="Returned" value={String(summary.returned)} />
              <Metric label="Buyouts" value={String(summary.buyouts)} />
            </div>

            <form onSubmit={applyFilters} className="mt-5 rounded-[24px] border border-[#e8edf2] bg-white/82 p-3">
              <label className="block text-[11px] font-black uppercase tracking-[0.12em] text-[#607489]" htmlFor="receipt-wallet">
                Wallet
              </label>
              <input
                id="receipt-wallet"
                value={walletFilter}
                onChange={(event) => setWalletFilter(event.target.value)}
                placeholder="Owner or renter wallet"
                className="mt-2 h-11 w-full rounded-full border border-[#dfe7ef] bg-white px-4 text-[13px] font-bold text-[#061725] outline-none placeholder:text-[#8a99a6]"
              />
              <label className="mt-3 block text-[11px] font-black uppercase tracking-[0.12em] text-[#607489]" htmlFor="receipt-rental">
                Rental ID
              </label>
              <input
                id="receipt-rental"
                value={rentalIdFilter}
                onChange={(event) => setRentalIdFilter(event.target.value)}
                placeholder="draft_item_id..."
                className="mt-2 h-11 w-full rounded-full border border-[#dfe7ef] bg-white px-4 text-[13px] font-bold text-[#061725] outline-none placeholder:text-[#8a99a6]"
              />
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="submit"
                  className="min-h-[42px] rounded-full bg-[#061725] px-4 text-[13px] font-black text-white transition hover:bg-[#c8ff18] hover:text-[#061725]"
                >
                  Search receipts
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="min-h-[42px] rounded-full border border-[#dfe7ef] bg-white px-4 text-[13px] font-black text-[#061725] transition hover:border-[#ff7867]"
                >
                  Clear
                </button>
              </div>
            </form>

            {storageKind && <p className="mt-3 text-[11px] font-bold text-[#607489]">Storage: {storageKind}</p>}
          </aside>

          <div className="min-h-0 rounded-[34px] bg-white/58 p-3 shadow-[0_30px_100px_rgba(6,23,37,0.12)] ring-1 ring-white/80 backdrop-blur-2xl sm:p-4">
            <div className="flex items-center justify-between gap-3 px-1 pb-3">
              <div>
                <p className="text-[13px] font-black text-[#061725]">Recent settled rentals</p>
                <p className="mt-1 text-[12px] font-bold text-[#607489]">
                  {activeQuery.wallet || activeQuery.rentalId ? "Filtered receipt ledger" : "Latest community receipt ledger"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadReceipts(activeQuery)}
                className="min-h-[36px] rounded-full bg-white px-4 text-[12px] font-black text-[#061725] ring-1 ring-[#dfe7ef] transition hover:bg-[#c8ff18]"
              >
                Refresh
              </button>
            </div>

            <div className="min-h-[420px] overflow-visible pr-1 lg:max-h-[calc(100svh-206px)] lg:overflow-y-auto">
              {status === "loading" && <ReceiptSkeleton />}
              {status === "error" && <StatePanel title="Could not load receipts" body={error} actionLabel="Retry" onAction={() => void loadReceipts(activeQuery)} />}
              {status === "ready" && receipts.length === 0 && (
                <StatePanel
                  title="No receipts yet"
                  body="Settle a return or auto-buyout first. Once /api/rentals/settle writes a receipt, it will appear here."
                  actionLabel="Reload"
                  onAction={() => void loadReceipts(activeQuery)}
                />
              )}
              {status === "ready" && receipts.length > 0 && (
                <div className="grid gap-3">
                  {receipts.map((receipt) => (
                    <ReceiptCard key={receipt.id} receipt={receipt} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-[#e8edf2] px-2 py-3 last:border-r-0">
      <p className="text-[18px] font-black text-[#061725]">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#607489]">{label}</p>
    </div>
  );
}

function ReceiptCard({ receipt }: { receipt: ReceiptHistoryRecord }) {
  const title = receipt.item?.name ?? receipt.itemId;
  const outcome = outcomeCopy(receipt.outcome);

  return (
    <article className="tably-results-enter rounded-[26px] border border-[#e8edf2] bg-white/88 p-3 shadow-[0_16px_44px_rgba(6,23,37,0.08)] sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[132px_1fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#eef2f6]">
          {receipt.item?.imageUrl ? (
            <Image src={receipt.item.imageUrl} alt={title} fill sizes="180px" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-[12px] font-black text-[#607489]">No image</div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${outcome.className}`}>
                {outcome.label}
              </span>
              <h2 className="mt-2 truncate text-[18px] font-black text-[#061725]">{title}</h2>
              <p className="mt-1 truncate text-[12px] font-bold text-[#607489]">
                {receipt.item?.locationLabel ?? "Unknown location"} / rental {shortId(receipt.rentalId)}
              </p>
            </div>
            <a
              href={receipt.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#061725] px-3 py-2 text-[11px] font-black text-white transition hover:bg-[#c8ff18] hover:text-[#061725]"
            >
              Open tx
            </a>
          </div>

          <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-[18px] border border-[#edf1f5] text-center sm:grid-cols-4">
            <ReceiptAmount label="Fee" amount={receipt.amounts.grossFee} tone="dark" />
            <ReceiptAmount label="Platform" amount={receipt.amounts.platformFee} tone="muted" />
            <ReceiptAmount label="Owner" amount={receipt.amounts.ownerPayout} tone="dark" />
            <ReceiptAmount label="Refund" amount={receipt.amounts.renterRefund} tone="green" />
          </div>

          <div className="mt-3 grid gap-2 text-[11px] font-bold text-[#607489] sm:grid-cols-2">
            <p className="truncate rounded-full bg-[#f6f8fa] px-3 py-2">Renter {receipt.renterWalletShort}</p>
            <p className="truncate rounded-full bg-[#f6f8fa] px-3 py-2">Owner {receipt.ownerWalletShort}</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#607489]">
            <span>{formatDate(receipt.createdAt)}</span>
            <span className="h-1 w-1 rounded-full bg-[#c5ced6]" />
            <span>Rental token {receipt.rentalTokenStatus}</span>
            <span className="h-1 w-1 rounded-full bg-[#c5ced6]" />
            <span className="truncate">Tx {shortId(receipt.settlementSignature)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function ReceiptAmount({ label, amount, tone }: { label: string; amount: ReceiptDisplayAmount; tone: "dark" | "green" | "muted" }) {
  const toneClass = tone === "green" ? "text-[#589b00]" : tone === "muted" ? "text-[#607489]" : "text-[#061725]";
  return (
    <div className="border-r border-b border-[#edf1f5] bg-white px-2 py-2 last:border-r-0 sm:border-b-0">
      <p className={`text-[13px] font-black ${toneClass}`}>{formatUsdc(amount)}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#607489]">{label}</p>
    </div>
  );
}

function ReceiptSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-[26px] border border-[#e8edf2] bg-white/72 p-3">
          <div className="grid gap-3 sm:grid-cols-[132px_1fr]">
            <div className="aspect-[4/3] animate-pulse rounded-[20px] bg-[#eef2f6]" />
            <div>
              <div className="h-5 w-24 animate-pulse rounded-full bg-[#eef2f6]" />
              <div className="mt-3 h-6 w-2/3 animate-pulse rounded-full bg-[#eef2f6]" />
              <div className="mt-3 h-16 animate-pulse rounded-[18px] bg-[#eef2f6]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatePanel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-[28px] border border-dashed border-[#dfe7ef] bg-white/62 p-6 text-center">
      <div>
        <p className="text-[18px] font-black text-[#061725]">{title}</p>
        <p className="mx-auto mt-2 max-w-sm text-[13px] font-bold leading-6 text-[#607489]">{body}</p>
        <button
          type="button"
          onClick={onAction}
          className="mt-4 min-h-[40px] rounded-full bg-[#061725] px-5 text-[13px] font-black text-white transition hover:bg-[#c8ff18] hover:text-[#061725]"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function summarizeReceipts(receipts: ReceiptHistoryRecord[]) {
  return receipts.reduce(
    (summary, receipt) => ({
      total: summary.total + 1,
      returned: summary.returned + (receipt.outcome === "returned_ok" ? 1 : 0),
      buyouts: summary.buyouts + (receipt.outcome === "auto_buyout" ? 1 : 0),
    }),
    { total: 0, returned: 0, buyouts: 0 }
  );
}

function outcomeCopy(outcome: ReceiptHistoryRecord["outcome"]) {
  if (outcome === "auto_buyout") {
    return { label: "Auto-buyout", className: "bg-[#fff0ec] text-[#d6452f]" };
  }
  if (outcome === "disputed") {
    return { label: "Disputed", className: "bg-[#f4efff] text-[#6b4cff]" };
  }
  return { label: "Returned OK", className: "bg-[#efffd1] text-[#365f00]" };
}

function formatUsdc(amount: ReceiptDisplayAmount) {
  const numeric = Number(amount.uiAmount);
  if (!Number.isFinite(numeric)) return `${amount.uiAmount} ${amount.symbol}`;
  return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${amount.symbol}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortId(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
