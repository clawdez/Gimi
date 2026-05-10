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
  const floatingItems = availableItems.slice(0, 6);
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
      className="grain-field relative min-h-screen overflow-hidden bg-[#faf7ff] px-4 pb-8 pt-28 text-[#061725] sm:px-8 sm:pt-32"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_24%,rgba(197,255,24,0.34),transparent_20%),radial-gradient(circle_at_86%_23%,rgba(82,204,255,0.32),transparent_20%),radial-gradient(circle_at_12%_72%,rgba(147,109,255,0.28),transparent_22%),radial-gradient(circle_at_88%_70%,rgba(255,190,94,0.32),transparent_24%),linear-gradient(125deg,#efeaff_0%,#fff8ec_48%,#f5fbff_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.28),rgba(255,255,255,0.1)_44%,rgba(255,255,255,0.36))]" />

      <FloatingInventory items={floatingItems} selectedItem={selectedItem} onSelectItem={selectItem} />

      <div className="relative mx-auto flex min-h-[calc(100vh-9rem)] max-w-6xl items-center justify-center">
        <div className="relative z-10 w-full max-w-[660px]">
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

function FloatingInventory({
  items,
  selectedItem,
  onSelectItem,
}: {
  items: RentalItem[];
  selectedItem: RentalItem;
  onSelectItem: (item: RentalItem, hours?: number, note?: string) => void;
}) {
  const positions = [
    "left-[6%] top-[17%] w-48 rotate-[-12deg]",
    "right-[8%] top-[15%] w-48 rotate-[8deg]",
    "left-[3%] top-[43%] w-48 rotate-[3deg]",
    "right-[5%] top-[43%] w-48 rotate-[-5deg]",
    "left-[7%] bottom-[9%] w-48 rotate-[-4deg]",
    "right-[9%] bottom-[8%] w-48 rotate-[7deg]",
  ];
  const blobColors = [
    "bg-[#c8ff18]",
    "bg-[#8edfff]",
    "bg-[#ff7867]",
    "bg-[#ff766b]",
    "bg-[#b99cff]",
    "bg-[#ffd77c]",
  ];
  const icons = ["+", "z", "c", "n", "m", "b"];
  const displayItems = items.slice(0, 6);

  return (
    <div className="pointer-events-none absolute inset-0 hidden xl:block">
      <svg className="absolute inset-0 h-full w-full opacity-45" aria-hidden="true">
        <path d="M190 330 C340 420 340 520 455 545" stroke="white" strokeWidth="3" fill="none" strokeDasharray="10 12" />
        <path d="M1245 330 C1090 410 1080 520 980 545" stroke="white" strokeWidth="3" fill="none" strokeDasharray="10 12" />
        <path d="M210 730 C345 675 370 610 455 590" stroke="white" strokeWidth="3" fill="none" strokeDasharray="10 12" />
        <path d="M1225 735 C1090 675 1070 615 985 590" stroke="white" strokeWidth="3" fill="none" strokeDasharray="10 12" />
      </svg>
      {displayItems.map((item, index) => {
        const selected = item.id === selectedItem.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={`Select ${item.name}`}
            onClick={() => onSelectItem(item, item.expectedHours, `Generated checkout for ${item.name}.`)}
            className={`pointer-events-auto absolute ${positions[index % positions.length]} group transition duration-300 hover:z-20 hover:scale-105`}
          >
            <span className={`absolute inset-3 -z-10 rounded-[42%_58%_48%_52%/58%_38%_62%_42%] ${blobColors[index % blobColors.length]} shadow-[0_28px_70px_rgba(75,53,140,0.16)] ${selected ? "ring-8 ring-[#c8ff18]/35" : ""}`} />
            <span className="absolute -right-2 top-[46%] grid h-9 w-9 place-items-center rounded-full border border-white/80 bg-white/86 text-[13px] font-black text-[#6b4cff] shadow-lg backdrop-blur-md">
              {icons[index % icons.length]}
            </span>
            <span className="absolute -bottom-1 left-4 rounded-[12px] bg-white px-3 py-2 text-[14px] font-black shadow-[0_14px_34px_rgba(6,23,37,0.12)]">
              ${item.ratePerHour}/h
            </span>
            <span className="block p-8">
              <span
                className="block aspect-[1.22] rounded-[30px] bg-contain bg-center bg-no-repeat drop-shadow-[0_24px_34px_rgba(6,23,37,0.28)]"
                style={{ backgroundImage: `url(${item.imageUrl})` }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SmallMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border-r border-[#e7ecf2] px-4 py-3 last:border-r-0">
      <p className={`text-[22px] font-black leading-none ${accent ? "text-[#5f8f08]" : "text-[#061725]"}`}>{value}</p>
      <p className={`mt-1 text-[10px] font-black uppercase tracking-[0.18em] ${accent ? "text-[#5f8f08]" : "text-[#506477]"}`}>{label}</p>
    </div>
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
  setRentalHours,
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
  setRentalHours: (hours: number) => void;
  statusMessage: string;
  steps: ToolStep[];
  txPreview: string;
  wallet: string;
}) {
  const returnTime = `${2 + rentalHours}:30 PM today`;
  const progressSteps = steps.slice(0, 4);

  return (
    <div className="relative overflow-hidden rounded-[52px] border border-white/80 bg-white/62 px-5 pb-6 pt-8 shadow-[0_38px_110px_rgba(75,53,140,0.16)] backdrop-blur-2xl sm:rounded-[72px] sm:px-10 sm:pb-8 sm:pt-12">
      <div className="pointer-events-none absolute inset-3 rounded-[44px] border-4 border-white/54 sm:rounded-[62px]" />
      <div className="relative">
        <h1 className="text-center text-[42px] font-black leading-none tracking-normal text-[#061725] sm:text-[56px]">
          What do you need?
        </h1>

        <form
          onSubmit={onSubmit}
          className="mx-auto mt-8 flex max-w-[520px] items-center gap-2 rounded-full border border-[#dfe5ee] bg-white/86 p-2 shadow-[0_18px_44px_rgba(6,23,37,0.08)]"
        >
          <label className="sr-only" htmlFor="agent-command">Ask Tably</label>
          <input
            id="agent-command"
            ref={inputRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="charger for 3 hours near the library"
            className="h-12 min-w-0 flex-1 rounded-full bg-transparent px-5 text-[17px] font-semibold text-[#061725] outline-none placeholder:text-[#061725]/70 sm:text-[20px]"
          />
          <button
            type="submit"
            className="grid min-h-[52px] min-w-[52px] place-items-center rounded-full bg-[#c8ff18] text-[30px] font-black leading-none text-[#061725] transition hover:scale-105 hover:bg-[#ff7867]"
            aria-label={input.trim() ? "Ask Tably" : "Generate rental checkout"}
          >
            &gt;
          </button>
        </form>

        <p className="mx-auto mt-7 max-w-[520px] text-[15px] font-semibold text-[#31445f]">
          <span className="text-[#f0b100]">+</span> Found {matchCount}{" "}
          matches. Here&apos;s the best one.
        </p>

        <div className="mx-auto mt-5 grid max-w-[560px] gap-5 sm:grid-cols-[250px_1fr]">
          <div className="relative rounded-[28px] bg-[#f0f2f6] p-4 shadow-[inset_0_0_0_1px_rgba(6,23,37,0.05)]">
            <button
              type="button"
              className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white text-[22px] text-[#061725] shadow-[0_10px_24px_rgba(6,23,37,0.1)]"
              aria-label="Save item"
            >
              o
            </button>
            <div
              className="aspect-[0.9] rounded-[24px] bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${selectedItem.imageUrl})` }}
            />
            <div className="absolute bottom-5 left-5 rounded-full bg-[#c8ff18] px-4 py-2 text-[12px] font-black text-[#061725] shadow-[0_12px_28px_rgba(84,128,0,0.22)]">
              {Math.max(88, Math.min(99, selectedItem.ownerScore))}% match
            </div>
          </div>

          <div className="min-w-0 py-1">
            <h2 className="text-[24px] font-black leading-tight text-[#061725] sm:text-[27px]">{selectedItem.name}</h2>
            <p className="mt-2 text-[15px] font-semibold text-[#607489]">
              <span className="font-black text-[#7caf0b]">4.9</span> ({selectedItem.returnedOkCount}) · {selectedItem.ownerName} ·{" "}
              <span className="text-[#315fd6]">{selectedItem.locationLabel}</span>
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#dfe7ef] bg-white/72 px-4 py-3 text-[15px] font-black text-[#061725]">
              <span>Clock</span>
              <button type="button" onClick={() => setRentalHours(Math.max(1, rentalHours - 1))} className="px-1 text-[#69798a]">-</button>
              {rentalHours} hours
              <button type="button" onClick={() => setRentalHours(Math.min(24, rentalHours + 1))} className="px-1 text-[#69798a]">+</button>
            </div>

            <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-[18px] border border-[#dfe7ef] bg-white/70">
              <SmallMetric label="fee" value={`$${expectedFee}`} />
              <SmallMetric label="escrow" value={`$${selectedItem.buyoutCap}`} />
              <SmallMetric label="refund" value={`$${refundable}`} accent />
            </div>

            <div className="mt-4 flex items-center gap-3 text-[16px] font-bold text-[#061725]">
              <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-[#dfe7ef] bg-white">Cal</span>
              Return by <span className="text-[#ff4c36]">{returnTime}</span>
            </div>

            <div className="mt-4 rounded-[18px] bg-[#eef5f9]/88 px-4 py-3 text-[12px] font-semibold leading-5 text-[#53697d]">
              Escrow is held securely on-chain and refunded when the item is returned on time.
            </div>
          </div>
        </div>

        {(routePreview || txPreview || receipt) && (
          <p className="mx-auto mt-4 max-w-[520px] rounded-[18px] bg-[#061725]/7 px-4 py-3 text-[12px] font-bold text-[#506477]">
            {[routePreview && `LI.FI ${routePreview}`, txPreview && `Tx ${txPreview}`, receipt].filter(Boolean).join(" / ")}
          </p>
        )}

        {!wallet && !receipt ? (
          <div className="mx-auto mt-7 grid max-w-[520px] gap-3">
            {crossmintConfigured ? (
              <CrossmintConnectButton onStart={onCrossmintStart} onWalletReady={onCrossmintWallet} />
            ) : (
              <button
                type="button"
                onClick={onCrossmintStart}
                className="min-h-[58px] w-full rounded-full bg-[#061725] text-[17px] font-black text-white shadow-[0_18px_40px_rgba(6,23,37,0.16)] transition hover:bg-[#c8ff18] hover:text-[#061725]"
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
            className="mx-auto mt-7 block min-h-[58px] w-full max-w-[520px] rounded-full bg-[#061725] text-[17px] font-black text-white shadow-[0_18px_40px_rgba(6,23,37,0.16)] transition hover:bg-[#c8ff18] hover:text-[#061725] disabled:opacity-50"
          >
            {actionLabel}
          </button>
        )}

        <div className="mx-auto mt-6 flex max-w-[520px] flex-wrap items-center justify-center gap-2 text-[12px] font-bold text-[#5264b7]">
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

        <p className="mt-5 text-center text-[14px] font-semibold text-[#5264b7]">Secure. Decentralized. Community-owned.</p>
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
      className="min-h-[58px] w-full rounded-full bg-[#061725] text-[17px] font-black text-white shadow-[0_18px_40px_rgba(6,23,37,0.16)] transition hover:bg-[#c8ff18] hover:text-[#061725] disabled:opacity-50"
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
      className="min-h-[58px] w-full rounded-full border border-[#dfe7ef] bg-white/82 text-[17px] font-black text-[#061725] shadow-[0_14px_34px_rgba(6,23,37,0.06)] transition hover:border-[#6b4cff] hover:bg-white disabled:opacity-50"
    >
      {connecting ? "Connecting..." : connected && address ? `Solana ${shortKey(address)}` : "Connect Solana"}
    </button>
  );
}

function shortKey(value: unknown) {
  if (typeof value !== "string" || value.length < 10) return "wallet";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
