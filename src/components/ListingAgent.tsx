"use client";

import {
  useSignTransaction as usePrivySolanaSignTransaction,
  useWallets as usePrivySolanaWallets,
  type ConnectedStandardSolanaWallet,
} from "@privy-io/react-auth/solana";
import { Connection } from "@solana/web3.js";
import { type FormEvent, useMemo, useState } from "react";
import { PrivyWalletButton } from "@/components/PrivyWalletButton";

interface ListingAgentProps {
  onDone: () => void;
}

type ListingStep = "collect" | "review" | "prepare" | "sign" | "publish";
type ListingStatus = "idle" | "preparing" | "ready" | "signing" | "publishing" | "published" | "error";

interface ListingForm {
  name: string;
  category: string;
  brand: string;
  model: string;
  condition: number;
  locationLabel: string;
  included: string;
  imageUrl: string;
  ratePerHour: number;
  minimumFee: number;
  buyoutCap: number;
  autoBuyoutGraceSeconds: number;
  description: string;
}

interface ListingPreview extends Omit<ListingForm, "included"> {
  schema: "tably.item.v1";
  id?: string;
  itemId?: string;
  itemPda?: string;
  itemIdHash?: string;
  paymentMint?: string;
  metadata?: {
    schema: "tably.item.v1";
    itemId: string;
    name: string;
    brand: string;
    model: string;
    category: string;
    condition: number;
    description: string;
    imageUrl: string;
    locationLabel: string;
    included: string[];
    ownerWallet: string;
    createdAt: string;
  };
  canonicalMetadataJson?: string;
  metadataHash?: string;
  included: string[];
  ownerWallet: string;
  createdAt: string;
}

interface PreparedListingTransaction {
  draftId: string;
  itemPda: string;
  metadataHash: string;
  listingPreview: ListingPreview;
  transactionBase64: string;
  metadata: {
    blockhash: string;
    cluster: string;
    feePayer: string;
    lastValidBlockHeight: number;
    paymentMint?: string;
    requiredSigner: string;
    rpcUrl: string;
  };
}

type PrivySolanaSignTransaction = ReturnType<typeof usePrivySolanaSignTransaction>["signTransaction"];

const categories = ["Power", "Audio", "Video", "Workspace", "Adapters", "Tools", "Other"];

const initialForm: ListingForm = {
  name: "",
  category: "Power",
  brand: "",
  model: "",
  condition: 8,
  locationLabel: "",
  included: "",
  imageUrl: "",
  ratePerHour: 2,
  minimumFee: 3,
  buyoutCap: 30,
  autoBuyoutGraceSeconds: 3600,
  description: "",
};

export function ListingAgent({ onDone }: ListingAgentProps) {
  const { wallets: privyWallets } = usePrivySolanaWallets();
  const { signTransaction: signPrivyTransaction } = usePrivySolanaSignTransaction();
  const ownerWallet = privyWallets[0]?.address ?? "";
  const [form, setForm] = useState<ListingForm>(initialForm);
  const [step, setStep] = useState<ListingStep>("collect");
  const [status, setStatus] = useState<ListingStatus>("idle");
  const [preparedTx, setPreparedTx] = useState<PreparedListingTransaction | null>(null);
  const [signature, setSignature] = useState("");
  const [agentLine, setAgentLine] = useState("Collect the owner listing details, then initialize the item on Solana devnet.");

  const listingPreview = useMemo<ListingPreview>(
    () => ({
      schema: "tably.item.v1",
      name: form.name.trim(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      category: form.category,
      condition: form.condition,
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      locationLabel: form.locationLabel.trim(),
      included: splitIncluded(form.included),
      ratePerHour: form.ratePerHour,
      minimumFee: form.minimumFee,
      buyoutCap: form.buyoutCap,
      autoBuyoutGraceSeconds: form.autoBuyoutGraceSeconds,
      ownerWallet,
      createdAt: new Date().toISOString(),
    }),
    [form, ownerWallet]
  );

  const canReview = Boolean(
    ownerWallet &&
      form.name.trim() &&
      form.category &&
      form.brand.trim() &&
      form.condition >= 1 &&
      form.locationLabel.trim() &&
      form.imageUrl.trim() &&
      form.ratePerHour > 0 &&
      form.minimumFee > 0 &&
      form.buyoutCap >= form.minimumFee &&
      form.description.trim()
  );
  const canSignPrepared = Boolean(preparedTx && privyWallets.some((wallet) => wallet.address === preparedTx.metadata.requiredSigner));

  function updateField<K extends keyof ListingForm>(key: K, value: ListingForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setStatus("idle");
    setPreparedTx(null);
    setSignature("");
    if (step !== "collect") setStep("collect");
  }

  function reviewListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ownerWallet) {
      setAgentLine("Connect the owner wallet before preparing an item listing.");
      return;
    }
    if (!canReview) {
      setAgentLine("Fill the required item, pricing, image, and location fields before review.");
      return;
    }
    setStep("review");
    setAgentLine("Review the canonical listing preview. The backend will hash this metadata before building initialize_item.");
  }

  async function prepareListing() {
    if (!canReview) {
      setAgentLine("Complete the listing details before preparing the transaction.");
      return;
    }

    setStep("prepare");
    setStatus("preparing");
    setPreparedTx(null);
    setSignature("");
    setAgentLine("Preparing owner-signed initialize_item transaction...");

    try {
      const res = await fetch("/api/solana-pay/initialize-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerWallet,
          name: listingPreview.name,
          brand: listingPreview.brand,
          model: listingPreview.model,
          category: listingPreview.category,
          condition: listingPreview.condition,
          description: listingPreview.description,
          imageUrl: listingPreview.imageUrl,
          locationLabel: listingPreview.locationLabel,
          included: listingPreview.included,
          ratePerHour: listingPreview.ratePerHour,
          minimumFee: listingPreview.minimumFee,
          buyoutCap: listingPreview.buyoutCap,
          autoBuyoutGraceSeconds: listingPreview.autoBuyoutGraceSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to prepare initialize_item");
      const metadata = data.transactionMetadata ?? {};
      const preview = normalizeListingPreview(data.listingPreview, listingPreview, data.draftId);
      setPreparedTx({
        draftId: data.draftId,
        itemPda: data.itemPda,
        metadataHash: data.metadataHash,
        listingPreview: preview,
        transactionBase64: data.transaction,
        metadata: {
          blockhash: metadata.blockhash,
          cluster: metadata.cluster ?? "devnet",
          feePayer: metadata.feePayer ?? ownerWallet,
          lastValidBlockHeight: metadata.lastValidBlockHeight,
          paymentMint: data.paymentMint ?? metadata.paymentMint,
          requiredSigner: metadata.requiredSigner ?? ownerWallet,
          rpcUrl: metadata.rpcUrl ?? "https://api.devnet.solana.com",
        },
      });
      setStep("sign");
      setStatus("ready");
      setAgentLine(`initialize_item prepared for ${preview.name}. Sign with ${shortKey(metadata.requiredSigner ?? ownerWallet)}.`);
    } catch (error) {
      setStatus("error");
      setAgentLine(error instanceof Error ? `Could not prepare listing: ${error.message}` : "Could not prepare the listing transaction.");
    }
  }

  async function signInitializeItem() {
    if (!preparedTx) {
      await prepareListing();
      return;
    }
    if (!canSignPrepared) {
      setAgentLine("Connected wallet does not match the required owner signer. Connect the owner wallet and prepare again.");
      return;
    }

    setStatus("signing");
    setAgentLine("Waiting for owner signature...");

    try {
      const connection = new Connection(preparedTx.metadata.rpcUrl, "confirmed");
      const ownerSigner = privyWallets.find((wallet) => wallet.address === preparedTx.metadata.requiredSigner);
      const txSignature = await signAndSendWithPrivy(preparedTx, connection, ownerSigner, signPrivyTransaction);
      await connection.confirmTransaction(
        {
          signature: txSignature,
          blockhash: preparedTx.metadata.blockhash,
          lastValidBlockHeight: preparedTx.metadata.lastValidBlockHeight,
        },
        "confirmed"
      );
      setSignature(txSignature);
      setStep("publish");
      setStatus("ready");
      setAgentLine(`initialize_item confirmed on ${preparedTx.metadata.cluster}: ${shortKey(txSignature)}. Publish the listing next.`);
    } catch (error) {
      setStatus("error");
      setAgentLine(error instanceof Error ? `Owner signature failed: ${error.message}` : "Owner signature failed.");
    }
  }

  async function publishListing() {
    if (!preparedTx || !signature) {
      setAgentLine("Sign initialize_item before publishing the listing.");
      return;
    }

    setStatus("publishing");
    setAgentLine("Publishing listing after devnet verification...");

    try {
      const res = await fetch("/api/listings/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: preparedTx.draftId,
          initializeSignature: signature,
          listingPreview: preparedTx.listingPreview,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to publish listing");
      setStatus("published");
      setAgentLine(`${preparedTx.listingPreview.name} is published and available to the renter agent inventory.`);
    } catch (error) {
      setStatus("error");
      setAgentLine(error instanceof Error ? `Publish failed: ${error.message}` : "Publish failed.");
    }
  }

  return (
    <section className="grain-field relative min-h-[100svh] overflow-y-auto bg-[#f7f3ea] px-4 pb-10 pt-32 text-[#061725] sm:px-8 sm:pt-36">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#fffaf0_0%,#f7fbff_52%,#fbf3ff_100%)]" />
      <div className="relative z-10 mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-[30px] border border-white/80 bg-white/82 p-4 shadow-[0_30px_90px_rgba(6,23,37,0.12)] backdrop-blur-2xl sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#6b4cff]">Owner listing</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-[#061725] sm:text-5xl">List an item</h1>
              <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[#607489]">
                Prepare a real devnet item account, sign as the owner, then publish the off-chain product metadata.
              </p>
            </div>
            <OwnerWalletControls
              connectedWallet={ownerWallet}
              onWalletReady={() => setAgentLine("Privy owner wallet connected. Fill the item details to prepare initialize_item.")}
            />
          </div>

          <StepRail step={step} status={status} />

          <form onSubmit={reviewListing} className="mt-5 grid gap-4 sm:grid-cols-2">
            <TextField label="Product name" value={form.name} onChange={(value) => updateField("name", value)} placeholder="Anker Power Bank" />
            <SelectField label="Category" value={form.category} options={categories} onChange={(value) => updateField("category", value)} />
            <TextField label="Brand" value={form.brand} onChange={(value) => updateField("brand", value)} placeholder="Anker" />
            <TextField label="Model" value={form.model} onChange={(value) => updateField("model", value)} placeholder="20K USB-C" />
            <NumberField label="Condition" value={form.condition} min={1} max={10} onChange={(value) => updateField("condition", value)} />
            <TextField label="Location" value={form.locationLabel} onChange={(value) => updateField("locationLabel", value)} placeholder="Main hall table B" />
            <TextField label="Included" value={form.included} onChange={(value) => updateField("included", value)} placeholder="USB-C cable, pouch" />
            <TextField label="Photo URL" value={form.imageUrl} onChange={(value) => updateField("imageUrl", value)} placeholder="https://..." />
            <NumberField label="Hourly rate" value={form.ratePerHour} min={0.1} step={0.1} suffix="USDC" onChange={(value) => updateField("ratePerHour", value)} />
            <NumberField label="Minimum fee" value={form.minimumFee} min={0.1} step={0.1} suffix="USDC" onChange={(value) => updateField("minimumFee", value)} />
            <NumberField label="Buyout cap" value={form.buyoutCap} min={1} step={1} suffix="USDC" onChange={(value) => updateField("buyoutCap", value)} />
            <NumberField
              label="Grace period"
              value={form.autoBuyoutGraceSeconds}
              min={60}
              step={60}
              suffix="sec"
              onChange={(value) => updateField("autoBuyoutGraceSeconds", value)}
            />
            <label className="sm:col-span-2">
              <span className="text-[12px] font-black uppercase tracking-[0.12em] text-[#607489]">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="High capacity USB-C power bank with cable."
                className="mt-2 min-h-[94px] w-full rounded-[18px] border border-[#dfe7ef] bg-white px-4 py-3 text-sm font-bold text-[#061725] outline-none transition focus:border-[#6b4cff]"
              />
            </label>
            <button
              type="submit"
              disabled={!canReview}
              className="min-h-[46px] rounded-full bg-[#061725] px-5 text-sm font-black text-white transition hover:bg-[#c8ff18] hover:text-[#061725] disabled:cursor-default disabled:bg-[#dfe7ef] disabled:text-[#8a98a5] sm:col-span-2"
            >
              Review listing metadata
            </button>
          </form>
        </div>

        <aside className="rounded-[30px] border border-white/80 bg-white/74 p-4 shadow-[0_30px_90px_rgba(6,23,37,0.1)] backdrop-blur-2xl sm:p-5">
          <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#607489]">Agent status</p>
          <p className="mt-3 text-sm font-bold leading-6 text-[#061725]">{agentLine}</p>

          <div className="mt-5 rounded-[22px] border border-[#e7edf3] bg-white/80 p-4">
            <p className="text-[13px] font-black text-[#061725]">Canonical preview</p>
            <dl className="mt-3 space-y-2 text-[12px] font-bold text-[#607489]">
              <PreviewRow label="Owner" value={ownerWallet ? shortKey(ownerWallet) : "not connected"} />
              <PreviewRow label="Item" value={listingPreview.name || "missing"} />
              <PreviewRow label="Category" value={listingPreview.category} />
              <PreviewRow label="Location" value={listingPreview.locationLabel || "missing"} />
              <PreviewRow label="Pricing" value={`$${listingPreview.ratePerHour}/h, min $${listingPreview.minimumFee}`} />
              <PreviewRow label="Buyout" value={`$${listingPreview.buyoutCap}, ${listingPreview.autoBuyoutGraceSeconds}s grace`} />
              <PreviewRow label="Included" value={listingPreview.included.length ? listingPreview.included.join(", ") : "none"} />
              {preparedTx && <PreviewRow label="Item PDA" value={shortKey(preparedTx.itemPda)} />}
              {preparedTx && <PreviewRow label="Metadata" value={shortKey(preparedTx.metadataHash)} />}
              {signature && <PreviewRow label="Signature" value={shortKey(signature)} />}
            </dl>
          </div>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => void prepareListing()}
              disabled={!canReview || status === "preparing" || status === "signing" || status === "publishing"}
              className="min-h-[44px] rounded-full bg-[#c8ff18] px-4 text-[13px] font-black text-[#061725] transition hover:bg-[#ff7867] disabled:cursor-default disabled:bg-[#dfe7ef] disabled:text-[#8a98a5]"
            >
              {status === "preparing" ? "Preparing..." : "Prepare initialize_item"}
            </button>
            <button
              type="button"
              onClick={() => void signInitializeItem()}
              disabled={!preparedTx || !canSignPrepared || status === "signing" || status === "publishing" || status === "published"}
              className="min-h-[44px] rounded-full bg-[#061725] px-4 text-[13px] font-black text-white transition hover:bg-[#6b4cff] disabled:cursor-default disabled:bg-[#dfe7ef] disabled:text-[#8a98a5]"
            >
              {status === "signing" ? "Signing..." : "Sign owner transaction"}
            </button>
            <button
              type="button"
              onClick={() => void publishListing()}
              disabled={!signature || status === "publishing" || status === "published"}
              className="min-h-[44px] rounded-full border border-[#dfe7ef] bg-white px-4 text-[13px] font-black text-[#061725] transition hover:border-[#c8ff18] disabled:cursor-default disabled:bg-[#f1f4f7] disabled:text-[#8a98a5]"
            >
              {status === "publishing" ? "Publishing..." : status === "published" ? "Published" : "Publish listing"}
            </button>
            {status === "published" && (
              <button
                type="button"
                onClick={onDone}
                className="min-h-[44px] rounded-full bg-[#061725] px-4 text-[13px] font-black text-white transition hover:bg-[#c8ff18] hover:text-[#061725]"
              >
                View renter inventory
              </button>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function OwnerWalletControls({
  connectedWallet,
  onWalletReady,
}: {
  connectedWallet: string;
  onWalletReady: () => void;
}) {
  if (connectedWallet) {
    return <div className="rounded-full bg-[#c8ff18] px-4 py-2 text-[12px] font-black text-[#061725]">Owner {shortKey(connectedWallet)}</div>;
  }

  return (
    <PrivyWalletButton
      connectLabel="Connect Privy"
      connectedLabel="Owner"
      onAddress={onWalletReady}
      className="min-h-[38px] rounded-full bg-[#061725] px-4 text-[12px] font-black text-white transition hover:bg-[#c8ff18] hover:text-[#061725] disabled:opacity-60"
    />
  );
}

function StepRail({ step, status }: { step: ListingStep; status: ListingStatus }) {
  const steps: Array<{ key: ListingStep; label: string }> = [
    { key: "collect", label: "Collect" },
    { key: "review", label: "Review" },
    { key: "prepare", label: "Prepare" },
    { key: "sign", label: "Sign" },
    { key: "publish", label: "Publish" },
  ];
  const currentIndex = steps.findIndex((item) => item.key === step);

  return (
    <div className="mt-6 grid grid-cols-5 gap-2">
      {steps.map((item, index) => {
        const active = index <= currentIndex;
        return (
          <div key={item.key} className={`rounded-full px-2 py-2 text-center text-[11px] font-black ${active ? "bg-[#061725] text-white" : "bg-[#eef2f6] text-[#607489]"}`}>
            {item.label}
          </div>
        );
      })}
      {status === "error" && <p className="col-span-5 text-[12px] font-black text-[#ff4c36]">Resolve the issue above, then retry the current step.</p>}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label>
      <span className="text-[12px] font-black uppercase tracking-[0.12em] text-[#607489]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-[18px] border border-[#dfe7ef] bg-white px-4 text-sm font-bold text-[#061725] outline-none transition focus:border-[#6b4cff]"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="text-[12px] font-black uppercase tracking-[0.12em] text-[#607489]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-[18px] border border-[#dfe7ef] bg-white px-4 text-sm font-bold text-[#061725] outline-none transition focus:border-[#6b4cff]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="text-[12px] font-black uppercase tracking-[0.12em] text-[#607489]">{label}</span>
      <span className="mt-2 flex h-12 items-center rounded-[18px] border border-[#dfe7ef] bg-white px-4 transition focus-within:border-[#6b4cff]">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#061725] outline-none"
        />
        {suffix && <span className="ml-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#607489]">{suffix}</span>}
      </span>
    </label>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-[#8a98a5]">{label}</dt>
      <dd className="min-w-0 text-right text-[#061725]">{value}</dd>
    </div>
  );
}

function splitIncluded(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeListingPreview(value: unknown, fallback: ListingPreview, draftId: unknown): ListingPreview {
  if (!value || typeof value !== "object") {
    return { ...fallback, itemId: typeof draftId === "string" ? draftId : fallback.itemId };
  }
  const record = value as Partial<ListingPreview>;
  return {
    ...fallback,
    ...record,
    schema: "tably.item.v1",
    included: Array.isArray(record.included) ? record.included.filter((item): item is string => typeof item === "string") : fallback.included,
    itemId: typeof record.itemId === "string" ? record.itemId : typeof draftId === "string" ? draftId : fallback.itemId,
  };
}

function shortKey(value: unknown) {
  if (typeof value !== "string" || value.length < 10) return "wallet";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function signAndSendWithPrivy(
  preparedTx: PreparedListingTransaction,
  connection: Connection,
  wallet: ConnectedStandardSolanaWallet | undefined,
  signTransaction: PrivySolanaSignTransaction
) {
  if (!wallet) throw new Error("Privy owner wallet is not loaded.");
  const { signedTransaction } = await signTransaction({
    transaction: base64ToUint8Array(preparedTx.transactionBase64),
    wallet,
    chain: preparedTx.metadata.cluster === "mainnet-beta" ? "solana:mainnet" : "solana:devnet",
  });
  return connection.sendRawTransaction(signedTransaction);
}

function base64ToUint8Array(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
