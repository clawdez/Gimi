"use client";

import { useCrossmintAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { COMMUNITY_ITEMS } from "@/lib/store";
import { RentalItem } from "@/lib/types";

type StepStatus = "pending" | "running" | "done";

interface ToolStep {
  name: string;
  label: string;
  status: StepStatus;
  detail: string;
}

interface ParsedRentalIntent {
  item: RentalItem;
  hours: number;
  budget?: number;
  note?: string;
}

const initialSteps: ToolStep[] = [
  { name: "find_rental_offers", label: "Match", status: "pending", detail: "Pick an available item" },
  { name: "start_crossmint_login", label: "Wallet", status: "pending", detail: "Embedded wallet" },
  { name: "quote_lifi_funding", label: "Funding", status: "pending", detail: "LI.FI USDC route" },
  { name: "create_solana_pay_rental_request", label: "Transaction", status: "pending", detail: "Unsigned Solana tx" },
  { name: "mint_rental_token", label: "Rental", status: "pending", detail: "Escrow and token" },
  { name: "rentproof.get_session", label: "Receipt", status: "pending", detail: "Return and reputation" },
];

const categoryKeywords: Array<[string, string[]]> = [
  ["Weather", ["umbrella", "rain", "rainy", "雨傘", "下雨"]],
  ["Adapters", ["adapter", "hdmi", "dongle", "轉接", "轉接頭"]],
  ["Audio", ["mic", "microphone", "audio", "record", "麥克風", "收音", "錄音"]],
  ["Video", ["camera", "tripod", "projector", "video", "film", "相機", "腳架", "投影", "拍攝"]],
  ["Workspace", ["keyboard", "monitor", "printer", "desk", "screen", "鍵盤", "螢幕", "印表機"]],
  ["Connectivity", ["router", "wifi", "network", "internet", "網路", "路由器"]],
  ["Power", ["power", "charger", "battery", "bank", "usb-c", "usbc", "充電", "行動電源", "電池"]],
];

const categories = ["All", "Power", "Audio", "Video", "Workspace", "Adapters", "Connectivity"];
const crossmintConfigured = Boolean(process.env.NEXT_PUBLIC_CROSSMINT_API_KEY);

export function TablyAgent() {
  const availableItems = COMMUNITY_ITEMS.filter((item) => item.status === "available");
  const defaultItem = availableItems[0] ?? COMMUNITY_ITEMS[0];
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedItem, setSelectedItem] = useState(defaultItem);
  const [rentalHours, setRentalHours] = useState(defaultItem.expectedHours);
  const [input, setInput] = useState("");
  const [steps, setSteps] = useState(initialSteps);
  const [wallet, setWallet] = useState("");
  const [requestUrl, setRequestUrl] = useState("");
  const [routePreview, setRoutePreview] = useState("");
  const [txPreview, setTxPreview] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [returnRequested, setReturnRequested] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ask for an item or choose one from the shelf.");

  const filteredItems = useMemo(() => {
    if (selectedCategory === "All") return availableItems;
    return availableItems.filter((item) => item.category === selectedCategory);
  }, [availableItems, selectedCategory]);

  const expectedFee = useMemo(
    () => Math.max(selectedItem.minimumFee, rentalHours * selectedItem.ratePerHour),
    [rentalHours, selectedItem.minimumFee, selectedItem.ratePerHour]
  );
  const refundable = Math.max(0, selectedItem.buyoutCap - expectedFee);
  const actionLabel = receipt
    ? "Done"
    : returnRequested
      ? "Confirm return"
      : sessionActive
        ? "Request return"
          : requestUrl
            ? "Start rental"
            : wallet
              ? "Prepare rental"
              : "Connect Crossmint";

  function mark(name: string, status: StepStatus, detail?: string) {
    setSteps((current) => current.map((step) => (step.name === name ? { ...step, status, detail: detail ?? step.detail } : step)));
  }

  function resetSettlement() {
    setRequestUrl("");
    setRoutePreview("");
    setTxPreview("");
    setSessionActive(false);
    setReturnRequested(false);
    setReceipt("");
    setSteps((current) => current.map((step) => (step.name === "find_rental_offers" ? step : { ...step, status: "pending" as StepStatus })));
  }

  function selectItem(item: RentalItem, hours = item.expectedHours, note?: string) {
    setSelectedItem(item);
    setRentalHours(hours);
    setSelectedCategory(item.category);
    resetSettlement();
    mark("find_rental_offers", "done", `${item.name} at ${item.locationLabel}`);
    const fee = Math.max(item.minimumFee, hours * item.ratePerHour);
    setStatusMessage(note ?? `${item.name}: ${fee} USDC for ${hours}h, ${item.buyoutCap} USDC escrow.`);
  }

  function parseIntent(text: string): ParsedRentalIntent {
    const normalized = text.toLowerCase();
    const hoursMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(h|hr|hour|hours|小時|小时)/);
    const budgetMatch = normalized.match(/(?:under|budget|below|less than|max|低於|低于|預算|预算|小於|小于|少於|少于|不超過|不超过|以內|以内)\s*\$?\s*(\d+(?:\.\d+)?)/);
    const hours = hoursMatch ? Number(hoursMatch[1]) : defaultItem.expectedHours;
    const exactItem = availableItems.find((item) =>
      [item.name, item.brand, item.model, item.id.replaceAll("_", " ")].some((value) => normalized.includes(value.toLowerCase()))
    );
    if (exactItem) return { item: exactItem, hours, budget: budgetMatch ? Number(budgetMatch[1]) : undefined };

    const requestedCategory = categoryKeywords.find(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))?.[0] ?? "Power";
    const candidates = availableItems.filter((item) => item.category === requestedCategory);
    const sorted = [...(candidates.length ? candidates : availableItems)].sort((a, b) => {
      const aFee = Math.max(a.minimumFee, hours * a.ratePerHour);
      const bFee = Math.max(b.minimumFee, hours * b.ratePerHour);
      return aFee - bFee || b.ownerScore - a.ownerScore;
    });
    return {
      item: sorted[0] ?? defaultItem,
      hours,
      budget: budgetMatch ? Number(budgetMatch[1]) : undefined,
      note: candidates.length ? undefined : `${requestedCategory} inventory is not available, so I picked the closest match.`,
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) {
      void advanceRentalFlow();
      return;
    }
    const intent = parseIntent(text);
    const fee = Math.max(intent.item.minimumFee, intent.hours * intent.item.ratePerHour);
    const budgetLine = intent.budget ? (fee <= intent.budget ? `Fits ${intent.budget} USDC budget.` : `Above ${intent.budget} USDC budget.`) : undefined;
    selectItem(intent.item, intent.hours, `${intent.note ? `${intent.note} ` : ""}${budgetLine ?? "Matched best available item."}`);
    setInput("");
  }

  function startCrossmint() {
    mark("start_crossmint_login", "running");
    setStatusMessage(
      crossmintConfigured
        ? "Open Crossmint sign-in to create a renter wallet."
        : "Crossmint is not configured. Add NEXT_PUBLIC_CROSSMINT_API_KEY to enable live wallet login."
    );
  }

  function handleCrossmintWallet(address: string) {
    if (!address || address === wallet) return;
    setWallet(address);
    mark("start_crossmint_login", "done", `Wallet ${shortKey(address)}`);
    setStatusMessage(`Crossmint wallet ${shortKey(address)} ready. Escrow needed: ${selectedItem.buyoutCap} USDC.`);
  }

  async function quoteLifi() {
    mark("quote_lifi_funding", "running");
    setStatusMessage("Quoting escrow funding route.");
    try {
      const res = await fetch("/api/lifi/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceChain: "base",
          sourceToken: "USDC",
          targetChain: "solana",
          targetToken: "USDC",
          amount: selectedItem.buyoutCap,
          toAddress: wallet,
          renterWallet: wallet,
        }),
      });
      const data = await res.json();
      const route = data.route;
      setRoutePreview(`${route.provider} / ${route.estimatedOutput} Solana USDC`);
      mark("quote_lifi_funding", "done", `${route.provider}: ${route.estimatedOutput} Solana USDC`);
    } catch {
      mark("quote_lifi_funding", "pending", "Quote failed");
      setStatusMessage("Funding quote failed. Try preparing again.");
    }
  }

  async function createRequest() {
    mark("create_solana_pay_rental_request", "running");
    setStatusMessage("Building unsigned Solana transaction.");
    try {
      const res = await fetch("/api/solana-pay/start-rental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItem.id, renterWallet: wallet, hours: rentalHours }),
      });
      const data = await res.json();
      setRequestUrl(data.solanaPayUrl);
      setTxPreview(`${String(data.transaction ?? "").length} chars / ${shortKey(data.transactionMetadata?.requiredSigner)}`);
      mark("create_solana_pay_rental_request", "done", "Unsigned transaction ready");
      setStatusMessage("Rental transaction ready for wallet approval.");
    } catch {
      mark("create_solana_pay_rental_request", "pending", "Build failed");
      setStatusMessage("Transaction build failed. Try again.");
    }
  }

  async function approveRental() {
    mark("mint_rental_token", "running");
    const res = await fetch("/api/rent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: selectedItem.id, renterWallet: wallet, hours: rentalHours }),
    });
    if (!res.ok) {
      mark("mint_rental_token", "pending", "Rental start failed");
      setStatusMessage("Rental start failed. Try again.");
      return;
    }
    const data = await res.json();
    setSessionActive(true);
    mark("mint_rental_token", "done", `Token ${data.rental.rentalTokenMint}`);
    mark("rentproof.get_session", "running", "Meter active");
    setStatusMessage(`Rental active. Expected refund: ${refundable} USDC.`);
  }

  function requestReturn() {
    setReturnRequested(true);
    mark("rentproof.get_session", "running", "Owner confirmation needed");
    setStatusMessage("Return requested. Owner confirmation will settle escrow.");
  }

  function confirmReturn() {
    setSessionActive(false);
    setReturnRequested(false);
    mark("rentproof.get_session", "done", "Receipt ready");
    const receiptText = `Receipt: fee ${expectedFee} USDC, refund ${refundable} USDC, reputation +1.`;
    setReceipt(receiptText);
    setStatusMessage(receiptText);
  }

  async function advanceRentalFlow() {
    if (receipt) return;
    if (!wallet) return startCrossmint();
    if (!requestUrl) {
      await quoteLifi();
      await createRequest();
      return;
    }
    if (!sessionActive) return approveRental();
    if (!returnRequested) return requestReturn();
    return confirmReturn();
  }

  return (
    <section id="agent" className="min-h-screen bg-[#eef4f8] px-5 pb-12 pt-24 text-[#071827] sm:px-8 sm:pt-28 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="grid gap-5 rounded-[6px] bg-[#d9edf8] p-5 shadow-[0_20px_70px_rgba(7,24,39,0.08)] sm:grid-cols-[1fr_220px] lg:p-7">
              <div>
                <h1 className="max-w-2xl text-[34px] font-black uppercase leading-[0.98] tracking-[0.08em] sm:text-[58px]">
                  Rent nearby gear
                </h1>
                <p className="mt-4 max-w-xl text-[15px] font-semibold leading-7 text-[#355164]">
                  Search community inventory, lock refundable escrow, and get a wallet-ready rental transaction.
                </p>
                <form onSubmit={handleSubmit} className="mt-6 flex max-w-2xl items-center gap-2 rounded-full bg-white p-2 shadow-[0_14px_35px_rgba(7,24,39,0.08)]">
                  <label className="sr-only" htmlFor="agent-command">Ask Tably</label>
                  <input
                    id="agent-command"
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask Tably: charger for 3 hours under 30..."
                    className="h-11 min-w-0 flex-1 rounded-full bg-transparent px-4 text-[14px] font-semibold outline-none placeholder:text-[#7a8b98]"
                  />
                  <button type="submit" className="h-11 rounded-full bg-[#071827] px-5 text-[12px] font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#c8ff2e] hover:text-[#071827]">
                    {input.trim() ? "Search" : actionLabel}
                  </button>
                </form>
              </div>
              <div className="hidden rounded-[6px] bg-white/64 p-4 sm:block">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6d7e8a]">Today</p>
                <p className="mt-4 text-4xl font-black">{availableItems.length}</p>
                <p className="mt-1 text-sm font-semibold text-[#536879]">items available</p>
                <p className="mt-6 text-4xl font-black">{selectedItem.ownerScore}</p>
                <p className="mt-1 text-sm font-semibold text-[#536879]">selected owner score</p>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full px-4 py-2 text-[12px] font-black uppercase tracking-[0.1em] transition ${
                    selectedCategory === category ? "bg-[#071827] text-white" : "bg-white text-[#526878] hover:bg-[#dceaf1]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <ProductCard key={item.id} item={item} selected={item.id === selectedItem.id} onSelect={selectItem} />
              ))}
            </div>
          </div>

          <RentalSummary
            actionLabel={actionLabel}
            crossmintConfigured={crossmintConfigured}
            expectedFee={expectedFee}
            onCrossmintStart={startCrossmint}
            onCrossmintWallet={handleCrossmintWallet}
            onAdvance={() => void advanceRentalFlow()}
            receipt={receipt}
            refundable={refundable}
            rentalHours={rentalHours}
            routePreview={routePreview}
            selectedItem={selectedItem}
            setRentalHours={(hours) => {
              setRentalHours(hours);
              resetSettlement();
            }}
            statusMessage={statusMessage}
            steps={steps}
            txPreview={txPreview}
            wallet={wallet}
          />
        </div>
      </div>
    </section>
  );
}

function ProductCard({ item, selected, onSelect }: { item: RentalItem; selected: boolean; onSelect: (item: RentalItem) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`group overflow-hidden rounded-[6px] bg-white text-left shadow-[0_16px_45px_rgba(7,24,39,0.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_60px_rgba(7,24,39,0.14)] ${selected ? "ring-2 ring-[#071827]" : ""}`}
    >
      <div className="aspect-[4/3] overflow-hidden bg-[#d7e6ee]">
        <div className="h-full bg-cover bg-center transition duration-300 group-hover:scale-105" style={{ backgroundImage: `url(${item.imageUrl})` }} />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-black">{item.name}</p>
            <p className="mt-1 truncate text-[12px] font-semibold text-[#637789]">{item.brand} {item.model}</p>
          </div>
          <span className="rounded-full bg-[#edf4f8] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#526878]">{item.category}</span>
        </div>
        <p className="mt-3 line-clamp-2 min-h-10 text-[12px] leading-5 text-[#536879]">{item.description}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#e4edf2] pt-4">
          <SmallMetric label="rate" value={`$${item.ratePerHour}/h`} />
          <SmallMetric label="escrow" value={`$${item.buyoutCap}`} />
          <SmallMetric label="score" value={`${item.ownerScore}`} />
        </div>
        <div className="mt-4 flex items-center justify-between text-[12px] font-bold text-[#526878]">
          <span>{item.locationLabel}</span>
          <span className="text-[#071827]">Rent</span>
        </div>
      </div>
    </button>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] font-black">{value}</p>
      <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#7b8d99]">{label}</p>
    </div>
  );
}

function RentalSummary({
  actionLabel,
  crossmintConfigured,
  expectedFee,
  onCrossmintStart,
  onCrossmintWallet,
  onAdvance,
  receipt,
  refundable,
  rentalHours,
  routePreview,
  selectedItem,
  setRentalHours,
  statusMessage,
  steps,
  txPreview,
  wallet,
}: {
  actionLabel: string;
  crossmintConfigured: boolean;
  expectedFee: number;
  onCrossmintStart: () => void;
  onCrossmintWallet: (address: string) => void;
  onAdvance: () => void;
  receipt: string;
  refundable: number;
  rentalHours: number;
  routePreview: string;
  selectedItem: RentalItem;
  setRentalHours: (hours: number) => void;
  statusMessage: string;
  steps: ToolStep[];
  txPreview: string;
  wallet: string;
}) {
  return (
    <aside className="h-fit rounded-[6px] bg-white p-5 shadow-[0_20px_70px_rgba(7,24,39,0.1)] lg:sticky lg:top-28">
      <div className="overflow-hidden rounded-[5px] bg-[#edf4f8]">
        <div className="aspect-[4/3] bg-cover bg-center" style={{ backgroundImage: `url(${selectedItem.imageUrl})` }} />
      </div>
      <div className="mt-5">
        <p className="text-[20px] font-black">{selectedItem.name}</p>
        <p className="mt-1 text-sm font-semibold text-[#637789]">{selectedItem.brand} {selectedItem.model}</p>
        <p className="mt-3 text-sm leading-6 text-[#536879]">{selectedItem.locationLabel} / owner score {selectedItem.ownerScore}</p>
      </div>

      <div className="mt-5 rounded-[6px] bg-[#f3f8fb] p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#718493]">Duration</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRentalHours(Math.max(1, rentalHours - 1))} className="grid h-8 w-8 place-items-center rounded-full bg-white font-black">-</button>
            <span className="min-w-12 text-center text-sm font-black">{rentalHours}h</span>
            <button type="button" onClick={() => setRentalHours(Math.min(24, rentalHours + 1))} className="grid h-8 w-8 place-items-center rounded-full bg-white font-black">+</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <SmallMetric label="fee" value={`$${expectedFee}`} />
          <SmallMetric label="escrow" value={`$${selectedItem.buyoutCap}`} />
          <SmallMetric label="refund" value={`$${refundable}`} />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {steps.map((step) => (
          <FlowRow key={step.name} step={step} />
        ))}
      </div>

      <div className="mt-5 space-y-2 text-[12px] font-semibold text-[#536879]">
        <p>{statusMessage}</p>
        {routePreview && <p>LI.FI: {routePreview}</p>}
        {txPreview && <p>Wallet tx: {txPreview}</p>}
        {receipt && <p>{receipt}</p>}
      </div>

      {!wallet && !receipt ? (
        crossmintConfigured ? (
          <CrossmintConnectButton onStart={onCrossmintStart} onWalletReady={onCrossmintWallet} />
        ) : (
          <button
            type="button"
            onClick={onCrossmintStart}
            className="mt-5 h-12 w-full rounded-full bg-[#071827] text-[12px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#c8ff2e] hover:text-[#071827]"
          >
            Connect Crossmint
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={onAdvance}
          disabled={Boolean(receipt)}
          className="mt-5 h-12 w-full rounded-full bg-[#071827] text-[12px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#c8ff2e] hover:text-[#071827] disabled:opacity-50"
        >
          {actionLabel}
        </button>
      )}
    </aside>
  );
}

function CrossmintConnectButton({
  onStart,
  onWalletReady,
}: {
  onStart: () => void;
  onWalletReady: (address: string) => void;
}) {
  const { login, status: authStatus } = useCrossmintAuth();
  const { wallet, status: walletStatus } = useWallet();

  useEffect(() => {
    if (wallet?.address) {
      onWalletReady(wallet.address);
    }
  }, [onWalletReady, wallet?.address]);

  const isBusy = authStatus === "initializing" || authStatus === "in-progress" || walletStatus === "in-progress";
  const label = isBusy ? "Connecting..." : wallet?.address ? `Wallet ${shortKey(wallet.address)}` : "Connect Crossmint";

  return (
    <button
      type="button"
      onClick={() => {
        onStart();
        login();
      }}
      disabled={isBusy}
      className="mt-5 h-12 w-full rounded-full bg-[#071827] text-[12px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#c8ff2e] hover:text-[#071827] disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function FlowRow({ step }: { step: ToolStep }) {
  const isDone = step.status === "done";
  const isRunning = step.status === "running";
  return (
    <div className={`flex items-center gap-3 rounded-[5px] px-3 py-2.5 ${isDone ? "bg-[#e7ffd1]" : isRunning ? "bg-[#eaf3f8]" : "bg-[#f5f8fa]"}`}>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black ${isDone ? "bg-[#c8ff2e] text-[#071827]" : "bg-white text-[#718493]"}`}>
        {isDone ? "✓" : ""}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-black">{step.label}</p>
        <p className="truncate text-[11px] text-[#718493]">{step.detail}</p>
      </div>
    </div>
  );
}

function shortKey(value: unknown) {
  if (typeof value !== "string" || value.length < 10) return "wallet";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
