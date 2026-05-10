"use client";

import { useCrossmintAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
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
  { name: "start_crossmint_login", label: "Wallet", status: "pending", detail: "Embedded or Solana wallet" },
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

const crossmintConfigured = Boolean(process.env.NEXT_PUBLIC_CROSSMINT_API_KEY);

export function TablyAgent() {
  const availableItems = COMMUNITY_ITEMS.filter((item) => item.status === "available");
  const defaultItem = availableItems[0] ?? COMMUNITY_ITEMS[0];
  const inputRef = useRef<HTMLInputElement>(null);
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

    const matchedKeyword = categoryKeywords
      .flatMap(([, keywords]) => keywords)
      .find((keyword) => normalized.includes(keyword));
    const requestedCategory = categoryKeywords.find(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))?.[0] ?? "Power";
    const candidates = availableItems.filter((item) => item.category === requestedCategory);
    const sorted = [...(candidates.length ? candidates : availableItems)].sort((a, b) => {
      const aText = `${a.name} ${a.brand} ${a.model} ${a.description}`.toLowerCase();
      const bText = `${b.name} ${b.brand} ${b.model} ${b.description}`.toLowerCase();
      const aLiteralMatch = matchedKeyword && aText.includes(matchedKeyword) ? 1 : 0;
      const bLiteralMatch = matchedKeyword && bText.includes(matchedKeyword) ? 1 : 0;
      const aFee = Math.max(a.minimumFee, hours * a.ratePerHour);
      const bFee = Math.max(b.minimumFee, hours * b.ratePerHour);
      return bLiteralMatch - aLiteralMatch || aFee - bFee || b.ownerScore - a.ownerScore;
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

  function handleSolanaWallet(address: string) {
    if (!address || address === wallet) return;
    setWallet(address);
    mark("start_crossmint_login", "done", `Wallet ${shortKey(address)}`);
    setStatusMessage(`Solana wallet ${shortKey(address)} ready. Escrow needed: ${selectedItem.buyoutCap} USDC.`);
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
    <section
      id="agent"
      className="grain-field relative h-[100svh] overflow-hidden bg-[#faf7ff] px-4 pb-3 pt-20 text-[#061725] sm:px-8 sm:pb-5 sm:pt-24"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_24%,rgba(197,255,24,0.34),transparent_20%),radial-gradient(circle_at_86%_23%,rgba(82,204,255,0.32),transparent_20%),radial-gradient(circle_at_12%_72%,rgba(147,109,255,0.28),transparent_22%),radial-gradient(circle_at_88%_70%,rgba(255,190,94,0.32),transparent_24%),linear-gradient(125deg,#efeaff_0%,#fff8ec_48%,#f5fbff_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.28),rgba(255,255,255,0.1)_44%,rgba(255,255,255,0.36))]" />

      <MovingProductRows items={availableItems} selectedItem={selectedItem} onSelectItem={selectItem} />

      <div className="relative mx-auto flex h-full max-w-6xl items-center justify-center">
        <div className="relative z-10 w-full max-w-[620px]">
          <GeneratedCheckout
            actionLabel={actionLabel}
            matchCount={availableItems.length}
            crossmintConfigured={crossmintConfigured}
            expectedFee={expectedFee}
            input={input}
            inputRef={inputRef}
            onAdvance={() => void advanceRentalFlow()}
            onCrossmintStart={startCrossmint}
            onCrossmintWallet={handleCrossmintWallet}
            onInputChange={setInput}
            onSolanaWallet={handleSolanaWallet}
            onSubmit={handleSubmit}
            receipt={receipt}
            refundable={refundable}
            rentalHours={rentalHours}
            routePreview={routePreview}
            selectedItem={selectedItem}
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

function MovingProductRows({
  items,
  selectedItem,
  onSelectItem,
}: {
  items: RentalItem[];
  selectedItem: RentalItem;
  onSelectItem: (item: RentalItem, hours?: number, note?: string) => void;
}) {
  const blobColors = [
    "bg-[#c8ff18]",
    "bg-[#8edfff]",
    "bg-[#ff7867]",
    "bg-[#ff766b]",
    "bg-[#b99cff]",
    "bg-[#ffd77c]",
  ];
  const rowIds = [
    ["power_bank_18", "charger_07", "camera_04", "mic_11", "adapter_03", "tripod_09"],
    ["charger_07", "adapter_03", "mic_11", "power_bank_18", "camera_04", "tripod_09"],
    ["camera_04", "power_bank_18", "tripod_09", "charger_07", "mic_11", "adapter_03"],
  ];
  const rows = rowIds.map((ids) => ids.map((id) => items.find((item) => item.id === id)).filter((item): item is RentalItem => Boolean(item)));
  const rowStyles = [
    "top-[13%] supply-marquee-left",
    "top-[39%] supply-marquee-right",
    "top-[65%] supply-marquee-left supply-marquee-slow",
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {rows.map((row, rowIndex) => {
        const repeated = [...row, ...row, ...row];
        return (
          <div
            key={rowIndex}
            className={`absolute left-1/2 flex w-max -translate-x-1/2 items-center gap-8 opacity-90 ${rowStyles[rowIndex]}`}
          >
            {repeated.map((item, index) => {
              const selected = item.id === selectedItem.id;
              return (
                <button
                  key={`${rowIndex}-${item.id}-${index}`}
                  type="button"
                  aria-label={`Select ${item.name}`}
                  onClick={() => onSelectItem(item, item.expectedHours, `Generated chat result for ${item.name}.`)}
                  className="pointer-events-auto group relative w-36 shrink-0 transition duration-300 hover:z-20 hover:scale-105 sm:w-44 xl:w-52"
                >
                  <span className={`absolute inset-4 -z-10 rounded-[42%_58%_48%_52%/58%_38%_62%_42%] ${blobColors[(index + rowIndex) % blobColors.length]} shadow-[0_28px_70px_rgba(75,53,140,0.16)] ${selected ? "ring-8 ring-[#c8ff18]/35" : ""}`} />
                  <span className="absolute -bottom-1 left-5 rounded-[12px] bg-white px-3 py-2 text-[13px] font-black shadow-[0_14px_34px_rgba(6,23,37,0.12)]">
                    ${item.ratePerHour}/h
                  </span>
                  <span className="block p-7">
                    <ProductVisual item={item} variant="floating" />
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.72)_22%,rgba(255,255,255,0.2)_44%,rgba(255,255,255,0)_70%)]" />
    </div>
  );
}

function ProductVisual({ item, variant = "floating" }: { item: RentalItem; variant?: "floating" | "hero" | "mini" }) {
  const large = variant === "hero";
  const mini = variant === "mini";
  const frameClass = mini ? "h-16" : large ? "h-[138px] sm:h-[230px]" : "h-[132px]";
  const visualKey = `${item.id} ${item.category}`.toLowerCase();

  if (visualKey.includes("charger")) {
    return (
      <span className={`relative block ${frameClass} w-full drop-shadow-[0_24px_34px_rgba(6,23,37,0.22)]`}>
        <span className="absolute left-[18%] top-[12%] h-[54%] w-[58%] rounded-full border-[10px] border-[#e7edf4]" />
        <span className="absolute left-[30%] top-[31%] h-4 w-[46%] -rotate-[20deg] rounded-full bg-[#d8e1ea]" />
        <span className="absolute bottom-[24%] left-[38%] h-[28%] w-[34%] rotate-[-16deg] rounded-[18px] bg-white shadow-[inset_0_0_0_2px_#dce5ed]" />
        <span className="absolute bottom-[29%] left-[30%] h-5 w-12 rotate-[-16deg] rounded-[8px] bg-white shadow-[inset_0_0_0_2px_#dce5ed]" />
        <span className="absolute bottom-[43%] right-[18%] h-5 w-10 rotate-[-16deg] rounded-[7px] bg-white shadow-[inset_0_0_0_2px_#dce5ed]" />
      </span>
    );
  }

  if (visualKey.includes("tripod")) {
    return (
      <span className={`relative block ${frameClass} w-full drop-shadow-[0_24px_34px_rgba(6,23,37,0.3)]`}>
        <span className="absolute left-[41%] top-[14%] h-[18%] w-[18%] rounded-[10px] bg-[#111823]" />
        <span className="absolute left-[48%] top-[30%] h-[44%] w-3 rounded-full bg-[#111823]" />
        <span className="absolute left-[49%] top-[60%] h-[34%] w-2 origin-top rotate-[24deg] rounded-full bg-[#111823]" />
        <span className="absolute left-[49%] top-[60%] h-[34%] w-2 origin-top rotate-[-24deg] rounded-full bg-[#111823]" />
        <span className="absolute left-[49%] top-[60%] h-[34%] w-2 origin-top rounded-full bg-[#111823]" />
      </span>
    );
  }

  if (visualKey.includes("camera") || visualKey.includes("video")) {
    return (
      <span className={`relative block ${frameClass} w-full drop-shadow-[0_24px_34px_rgba(6,23,37,0.3)]`}>
        <span className="absolute left-[12%] top-[24%] h-[48%] w-[70%] rounded-[26px] bg-[#111823] shadow-[inset_0_0_0_2px_#263140]" />
        <span className="absolute left-[18%] top-[18%] h-[16%] w-[26%] rounded-t-[14px] bg-[#111823]" />
        <span className="absolute left-[38%] top-[30%] h-[42%] w-[42%] rounded-full bg-[#05080d] shadow-[inset_0_0_0_8px_#273443]" />
        <span className="absolute left-[47%] top-[39%] h-[24%] w-[24%] rounded-full bg-[#0b1018] shadow-[inset_0_0_0_5px_#1e93b9]" />
        <span className="absolute left-[22%] top-[35%] h-5 w-8 rounded-full bg-[#303b4a]" />
      </span>
    );
  }

  if (visualKey.includes("mic") || visualKey.includes("audio")) {
    return (
      <span className={`relative block ${frameClass} w-full drop-shadow-[0_24px_34px_rgba(6,23,37,0.28)]`}>
        <span className="absolute left-[38%] top-[10%] h-[48%] w-[26%] rounded-[999px] bg-[#111823] shadow-[inset_0_-12px_0_#05080d]" />
        <span className="absolute left-[43%] top-[55%] h-[26%] w-[16%] rounded-full border-[7px] border-[#111823] border-t-0" />
        <span className="absolute left-[49%] top-[73%] h-[18%] w-2 rounded-full bg-[#111823]" />
        <span className="absolute bottom-[5%] left-[32%] h-4 w-[42%] rounded-full bg-[#111823]" />
      </span>
    );
  }

  if (visualKey.includes("adapter")) {
    return (
      <span className={`relative block ${frameClass} w-full drop-shadow-[0_24px_34px_rgba(6,23,37,0.22)]`}>
        <span className="absolute left-[18%] top-[30%] h-4 w-[62%] rotate-[18deg] rounded-full bg-[#d8e1ea]" />
        <span className="absolute left-[15%] top-[24%] h-[28%] w-[32%] rotate-[18deg] rounded-[16px] bg-white shadow-[inset_0_0_0_2px_#dce5ed]" />
        <span className="absolute right-[15%] top-[39%] h-[22%] w-[28%] rotate-[18deg] rounded-[10px] bg-[#cfd8e3] shadow-[inset_0_0_0_2px_#9aa9b8]" />
      </span>
    );
  }

  return (
    <span className={`relative block ${frameClass} w-full drop-shadow-[0_24px_34px_rgba(6,23,37,0.3)]`}>
      <span className="absolute left-[33%] top-[10%] h-[76%] w-[34%] rotate-[-24deg] rounded-[24px] bg-[#151b22] shadow-[inset_0_0_0_2px_#303b45]" />
      <span className="absolute left-[39%] top-[18%] rotate-[-24deg] text-[10px] font-black tracking-[0.12em] text-white/75">
        ANKER
      </span>
      <span className="absolute bottom-[18%] left-[47%] h-2 w-10 rotate-[-24deg] rounded-full bg-[#2f83ff]" />
      <span className="absolute bottom-[15%] left-[56%] h-3 w-8 rotate-[-24deg] rounded-full bg-[#05080d]" />
    </span>
  );
}

function GeneratedCheckout({
  actionLabel,
  matchCount,
  crossmintConfigured,
  expectedFee,
  input,
  inputRef,
  onCrossmintStart,
  onCrossmintWallet,
  onAdvance,
  onInputChange,
  onSolanaWallet,
  onSubmit,
  receipt,
  refundable,
  rentalHours,
  routePreview,
  selectedItem,
  statusMessage,
  steps,
  txPreview,
  wallet,
}: {
  actionLabel: string;
  matchCount: number;
  crossmintConfigured: boolean;
  expectedFee: number;
  input: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onCrossmintStart: () => void;
  onCrossmintWallet: (address: string) => void;
  onAdvance: () => void;
  onInputChange: (value: string) => void;
  onSolanaWallet: (address: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  receipt: string;
  refundable: number;
  rentalHours: number;
  routePreview: string;
  selectedItem: RentalItem;
  statusMessage: string;
  steps: ToolStep[];
  txPreview: string;
  wallet: string;
}) {
  const returnTime = `${2 + rentalHours}:30 PM today`;
  const progressSteps = steps.slice(0, 4);

  return (
    <div className="relative max-h-full overflow-hidden rounded-[34px] border border-white/80 bg-white/72 px-5 pb-5 pt-6 shadow-[0_38px_110px_rgba(75,53,140,0.18)] backdrop-blur-2xl sm:rounded-[48px] sm:px-8 sm:pb-7 sm:pt-8">
      <div className="pointer-events-none absolute inset-2 rounded-[27px] border-[3px] border-white/50 sm:rounded-[40px]" />
      <div className="relative">
        <h1 className="text-center text-[34px] font-black leading-[0.95] tracking-normal text-[#061725] sm:text-[48px]">
          Ask Tably
        </h1>
        <p className="mx-auto mt-2 max-w-[420px] text-center text-sm font-semibold leading-6 text-[#506477]">
          Describe what you need to borrow. The agent finds the item and prepares the rental.
        </p>

        <form
          onSubmit={onSubmit}
          className="mx-auto mt-5 flex max-w-[500px] items-center gap-2 rounded-full border border-[#dfe5ee] bg-white/92 p-1.5 shadow-[0_18px_44px_rgba(6,23,37,0.08)] sm:p-2"
        >
          <label className="sr-only" htmlFor="agent-command">Ask Tably</label>
          <input
            id="agent-command"
            ref={inputRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="charger for 3h near library"
            className="h-10 min-w-0 flex-1 rounded-full bg-transparent px-4 text-[15px] font-semibold text-[#061725] outline-none placeholder:text-[#061725]/70 sm:h-12 sm:px-5 sm:text-[19px]"
          />
          <button
            type="submit"
            className="grid min-h-[44px] min-w-[44px] place-items-center rounded-full bg-[#c8ff18] text-[26px] font-black leading-none text-[#061725] transition hover:scale-105 hover:bg-[#ff7867] sm:min-h-[52px] sm:min-w-[52px] sm:text-[30px]"
            aria-label={input.trim() ? "Ask Tably" : "Generate rental checkout"}
          >
            &gt;
          </button>
        </form>

        <div className="mx-auto mt-4 max-w-[500px] rounded-[24px] border border-[#e2e9f0] bg-white/76 p-3 shadow-[0_14px_40px_rgba(6,23,37,0.06)]">
          <p className="text-[13px] font-semibold leading-6 text-[#31445f]">
            <span className="text-[#f0b100]">+</span> Found {matchCount} matches. Best fit:
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px] bg-[#eef2f6]">
              <ProductVisual item={selectedItem} variant="mini" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-black text-[#061725]">{selectedItem.name}</p>
              <p className="mt-0.5 truncate text-[12px] font-bold text-[#607489]">
                ${selectedItem.ratePerHour}/h · {rentalHours}h · ${expectedFee} fee · ${refundable} refund
              </p>
            </div>
            <span className="hidden rounded-full bg-[#c8ff18] px-3 py-1.5 text-[11px] font-black text-[#061725] sm:inline-flex">
              {Math.max(88, Math.min(99, selectedItem.ownerScore))}% match
            </span>
          </div>
          <p className="mt-2 text-[12px] font-semibold text-[#53697d]">Return by {returnTime}. Escrow is held on-chain.</p>
        </div>

        {(routePreview || txPreview || receipt) && (
          <p className="mx-auto mt-4 max-w-[520px] rounded-[18px] bg-[#061725]/7 px-4 py-3 text-[12px] font-bold text-[#506477]">
            {[routePreview && `LI.FI ${routePreview}`, txPreview && `Tx ${txPreview}`, receipt].filter(Boolean).join(" / ")}
          </p>
        )}

        {!wallet && !receipt ? (
          <div className="mx-auto mt-4 grid max-w-[500px] gap-2 sm:mt-6 sm:gap-3">
            {crossmintConfigured ? (
              <CrossmintConnectButton onStart={onCrossmintStart} onWalletReady={onCrossmintWallet} />
            ) : (
              <button
                type="button"
                onClick={onCrossmintStart}
                className="min-h-[48px] w-full rounded-full bg-[#061725] text-[15px] font-black text-white shadow-[0_18px_40px_rgba(6,23,37,0.16)] transition hover:bg-[#c8ff18] hover:text-[#061725] sm:min-h-[56px] sm:text-[17px]"
              >
                Continue with Crossmint
              </button>
            )}
            <SolanaConnectButton onWalletReady={onSolanaWallet} />
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdvance}
            disabled={Boolean(receipt)}
            className="mx-auto mt-4 block min-h-[48px] w-full max-w-[500px] rounded-full bg-[#061725] text-[15px] font-black text-white shadow-[0_18px_40px_rgba(6,23,37,0.16)] transition hover:bg-[#c8ff18] hover:text-[#061725] disabled:opacity-50 sm:mt-6 sm:min-h-[56px] sm:text-[17px]"
          >
            {actionLabel}
          </button>
        )}

        <div className="mx-auto mt-3 flex max-w-[500px] flex-wrap items-center justify-center gap-1.5 text-[11px] font-bold text-[#5264b7] sm:mt-5 sm:gap-2 sm:text-[12px]">
          {progressSteps.map((step) => (
            <span
              key={step.name}
              className={`rounded-full px-3 py-1.5 ${
                step.status === "done" ? "bg-[#c8ff18] text-[#061725]" : step.status === "running" ? "bg-[#ffded8] text-[#ff4c36]" : "bg-white/46"
              }`}
            >
              {step.label}
            </span>
          ))}
        </div>

        <p className="mt-2 text-center text-[12px] font-semibold text-[#5264b7] sm:mt-4 sm:text-[14px]">Secure. Decentralized. Community-owned.</p>
        <p className="sr-only">{statusMessage}</p>
      </div>
    </div>
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
      className="min-h-[48px] w-full rounded-full bg-[#061725] text-[15px] font-black text-white shadow-[0_18px_40px_rgba(6,23,37,0.16)] transition hover:bg-[#c8ff18] hover:text-[#061725] disabled:opacity-50 sm:min-h-[56px] sm:text-[17px]"
    >
      {label}
    </button>
  );
}

function SolanaConnectButton({ onWalletReady }: { onWalletReady: (address: string) => void }) {
  const { connected, connecting, publicKey } = useSolanaWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toBase58();

  useEffect(() => {
    if (connected && address) {
      onWalletReady(address);
    }
  }, [address, connected, onWalletReady]);

  return (
    <button
      type="button"
      onClick={() => {
        if (connected && address) {
          onWalletReady(address);
          return;
        }
        setVisible(true);
      }}
      disabled={connecting}
      className="min-h-[48px] w-full rounded-full border border-[#dfe7ef] bg-white/82 text-[15px] font-black text-[#061725] shadow-[0_14px_34px_rgba(6,23,37,0.06)] transition hover:border-[#6b4cff] hover:bg-white disabled:opacity-50 sm:min-h-[56px] sm:text-[17px]"
    >
      {connecting ? "Connecting..." : connected && address ? `Solana ${shortKey(address)}` : "Connect Solana"}
    </button>
  );
}

function shortKey(value: unknown) {
  if (typeof value !== "string" || value.length < 10) return "wallet";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
