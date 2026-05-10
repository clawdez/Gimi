"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { COMMUNITY_ITEMS } from "@/lib/store";
import { RentalItem } from "@/lib/types";

type StepStatus = "pending" | "running" | "done";
type ChatRole = "user" | "agent" | "tool";

interface ToolStep {
  name: string;
  label: string;
  status: StepStatus;
  detail: string;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

interface ParsedRentalIntent {
  item: RentalItem;
  hours: number;
  budget?: number;
  note?: string;
}

const initialSteps: ToolStep[] = [
  { name: "start_crossmint_login", label: "Crossmint", status: "pending", detail: "Email onboarding and embedded wallet" },
  { name: "find_rental_offers", label: "Offer match", status: "pending", detail: "Waiting for request" },
  { name: "quote_lifi_funding", label: "LI.FI", status: "pending", detail: "Base USDC to Solana USDC route" },
  { name: "create_solana_pay_rental_request", label: "Solana Pay", status: "pending", detail: "start_rental transaction request" },
  { name: "mint_rental_token", label: "Solana", status: "pending", detail: "Escrow lock and rental token mint" },
  { name: "rentproof.get_session", label: "MCP", status: "pending", detail: "Expose session to external agents" },
];

const categoryKeywords: Array<[string, string[]]> = [
  ["Weather", ["umbrella", "rain", "雨傘", "下雨"]],
  ["Adapters", ["adapter", "hdmi", "dongle", "轉接", "轉接頭"]],
  ["Audio", ["mic", "microphone", "audio", "record", "麥克風", "收音", "錄音"]],
  ["Video", ["camera", "tripod", "projector", "video", "film", "相機", "腳架", "投影", "拍攝"]],
  ["Workspace", ["keyboard", "monitor", "printer", "desk", "screen", "鍵盤", "螢幕", "印表機"]],
  ["Connectivity", ["router", "wifi", "network", "internet", "網路", "路由器"]],
  ["Power", ["power", "charger", "battery", "bank", "usb-c", "usbc", "充電", "行動電源", "電池"]],
];

const floatingProductSlots = [
  "left-[-3vw] top-[9vh] h-[160px] w-[210px] rotate-[-8deg] sm:h-[210px] sm:w-[270px] lg:h-[260px] lg:w-[330px]",
  "left-[30vw] top-[56vh] h-[190px] w-[220px] rotate-[2deg] sm:h-[250px] sm:w-[280px] lg:left-[31vw] lg:h-[320px] lg:w-[350px]",
  "left-[50vw] top-[6vh] h-[120px] w-[190px] rotate-[3deg] sm:h-[155px] sm:w-[240px] lg:h-[205px] lg:w-[310px]",
  "right-[4vw] top-[16vh] h-[210px] w-[230px] rotate-[5deg] sm:h-[290px] sm:w-[310px] lg:h-[390px] lg:w-[410px]",
  "right-[18vw] top-[52vh] h-[160px] w-[190px] rotate-[-4deg] sm:h-[220px] sm:w-[260px] lg:h-[300px] lg:w-[340px]",
  "left-[6vw] bottom-[-8vh] h-[170px] w-[210px] rotate-[7deg] sm:h-[250px] sm:w-[300px] lg:h-[330px] lg:w-[390px]",
  "right-[4vw] bottom-[-10vh] h-[160px] w-[220px] rotate-[-6deg] sm:h-[240px] sm:w-[320px] lg:h-[320px] lg:w-[420px]",
  "left-[66vw] top-[2vh] hidden h-[105px] w-[150px] rotate-[-3deg] sm:block lg:h-[150px] lg:w-[220px]",
  "left-[15vw] top-[34vh] hidden h-[130px] w-[180px] rotate-[5deg] md:block lg:h-[180px] lg:w-[250px]",
];

const crossmintApiKeyConfigured = Boolean(process.env.NEXT_PUBLIC_CROSSMINT_API_KEY);
const crossmintSdkWired = false;
const crossmintLive = crossmintApiKeyConfigured && crossmintSdkWired;
const demoWalletAddress = "demo_crossmint_wallet";

export function TablyAgent() {
  const defaultItem = COMMUNITY_ITEMS[0];
  const [, setSteps] = useState(initialSteps);
  const [, setMessages] = useState<ChatMessage[]>([
    {
      id: "agent_intro",
      role: "agent",
      text: "Tell me what you need, for how long, and any budget. I can match an item, prepare funding, create a Solana Pay rental request, and start the RentProof session.",
    },
  ]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [wallet, setWallet] = useState("");
  const [selectedItem, setSelectedItem] = useState(defaultItem);
  const [rentalHours, setRentalHours] = useState(defaultItem.expectedHours);
  const [requestUrl, setRequestUrl] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [returnRequested, setReturnRequested] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentNotice, setAgentNotice] = useState("Tell me what you need. I will check inventory and prepare the rental.");

  const expectedFee = useMemo(
    () => Math.max(selectedItem.minimumFee, rentalHours * selectedItem.ratePerHour),
    [rentalHours, selectedItem.minimumFee, selectedItem.ratePerHour]
  );
  const refundable = Math.max(0, selectedItem.buyoutCap - expectedFee);
  const isSearching = input.trim().length > 0;
  const actionLabel = isSearching
    ? "Search"
    : !agentOpen
      ? "Search"
      : receipt
        ? "Done"
        : returnRequested
          ? "Confirm"
          : sessionActive
            ? "Return"
            : requestUrl
              ? "Approve"
              : wallet
                ? "Prepare"
                : crossmintLive
                  ? "Connect"
                  : "Demo Connect";
  const statusLine = !agentOpen
    ? agentNotice
    : receipt
      ? "Receipt ready"
      : returnRequested
        ? "Waiting for owner confirmation"
        : sessionActive
          ? `Active rental / refund ${refundable} USDC`
          : requestUrl
            ? "Solana Pay request ready"
            : wallet
              ? "Wallet ready"
              : `${rentalHours}h / ${expectedFee} USDC fee / ${selectedItem.buyoutCap} USDC escrow / ${crossmintLive ? "Crossmint login required" : "demo wallet mode"}`;

  function addMessage(role: ChatRole, text: string) {
    setMessages((current) => [
      ...current,
      { id: `${role}_${Date.now()}_${current.length}`, role, text },
    ]);
  }

  function mark(name: string, status: StepStatus, detail?: string) {
    setSteps((current) =>
      current.map((step) =>
        step.name === name ? { ...step, status, detail: detail ?? step.detail } : step
      )
    );
  }

  function resetSettlement() {
    setRequestUrl("");
    setSessionActive(false);
    setReturnRequested(false);
    setReceipt("");
    setSteps((current) =>
      current.map((step) =>
        ["quote_lifi_funding", "create_solana_pay_rental_request", "mint_rental_token", "rentproof.get_session"].includes(step.name)
          ? { ...step, status: "pending" as StepStatus }
          : step
      )
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = (inputRef.current?.value ?? input).trim();
    if (!text) {
      if (agentOpen) void advanceRentalFlow();
      return;
    }
    setInput("");
    if (inputRef.current) inputRef.current.value = "";
    runAgent(text);
  }

  function runAgent(text: string) {
    setAgentOpen(true);
    const intent = parseIntent(text);
    prepareRentalDraft(text, intent);
  }

  function borrowItem(item: RentalItem) {
    setAgentOpen(true);
    prepareRentalDraft(`Rent ${item.name} for ${item.expectedHours} hours.`, {
      item,
      hours: item.expectedHours,
      note: `${item.name} selected from the product field.`,
    });
  }

  function prepareRentalDraft(userText: string, intent: ParsedRentalIntent) {
    addMessage("user", userText);
    setAgentOpen(true);
    setSelectedItem(intent.item);
    setRentalHours(intent.hours);
    resetSettlement();
    mark("find_rental_offers", "done", `${intent.item.name} selected, owner score ${intent.item.ownerScore}`);

    const fee = Math.max(intent.item.minimumFee, intent.hours * intent.item.ratePerHour);
    const budgetLine = intent.budget
      ? fee <= intent.budget
        ? `It fits your ${intent.budget} USDC budget.`
        : `It is above your ${intent.budget} USDC budget, but this is the best available match.`
      : "No budget was provided.";
    setAgentNotice(
      `Found ${intent.item.name} at ${intent.item.locationLabel}: ${fee} USDC for ${intent.hours}h, ${intent.item.buyoutCap} USDC escrow.`
    );
    addMessage(
      "agent",
      `${intent.note ? `${intent.note} ` : ""}Matched ${intent.item.name} at ${intent.item.locationLabel}. Estimated fee is ${fee} USDC for ${intent.hours}h, with ${intent.item.buyoutCap} USDC refundable escrow. ${budgetLine} Next I can onboard a wallet, quote LI.FI funding, and create the Solana Pay request.`
    );
  }

  function parseIntent(text: string): ParsedRentalIntent {
    const normalized = text.toLowerCase();
    const hoursMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(h|hr|hour|hours|小時|小时)/);
    const budgetMatch = normalized.match(/(?:under|budget|below|less than|max|低於|低于|預算|预算|小於|小于|少於|少于|不超過|不超过|以內|以内)\s*\$?\s*(\d+(?:\.\d+)?)/);
    const hours = hoursMatch ? Number(hoursMatch[1]) : defaultItem.expectedHours;
    const availableItems = COMMUNITY_ITEMS.filter((item) => item.status === "available");
    const exactItem = availableItems.find((item) =>
      [item.name, item.brand, item.model, item.id.replaceAll("_", " ")].some((value) =>
        normalized.includes(value.toLowerCase())
      )
    );
    if (exactItem) {
      return {
        item: exactItem,
        hours,
        budget: budgetMatch ? Number(budgetMatch[1]) : undefined,
      };
    }

    const requestedCategory =
      categoryKeywords.find(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))?.[0] ?? "Power";
    const candidates = availableItems.filter((item) => item.category === requestedCategory);
    const sorted = [...(candidates.length ? candidates : availableItems)].sort((a, b) => {
      const aFee = Math.max(a.minimumFee, hours * a.ratePerHour);
      const bFee = Math.max(b.minimumFee, hours * b.ratePerHour);
      return aFee - bFee || b.ownerScore - a.ownerScore;
    });
    const item = sorted[0] ?? defaultItem;
    return {
      item,
      hours,
      budget: budgetMatch ? Number(budgetMatch[1]) : undefined,
      note: candidates.length ? undefined : `${requestedCategory} inventory is not available right now, so I matched the best available alternative.`,
    };
  }

  async function startCrossmint() {
    mark("start_crossmint_login", "running");
    addMessage("tool", crossmintLive ? "Crossmint: preparing embedded wallet login." : "Crossmint SDK is not wired in this build; using demo embedded wallet mode.");
    await wait(450);
    const embeddedWallet = crossmintLive ? "crossmint_embedded_wallet" : demoWalletAddress;
    setWallet(embeddedWallet);
    mark(
      "start_crossmint_login",
      "done",
      crossmintLive ? `Crossmint wallet ready: ${embeddedWallet}` : `Demo wallet ready: ${embeddedWallet}`
    );
    setAgentNotice(
      crossmintLive
        ? `Crossmint wallet ready. Next I can prepare ${selectedItem.buyoutCap} USDC funding.`
        : `Demo wallet ready. Add Crossmint SDK + NEXT_PUBLIC_CROSSMINT_API_KEY for live login.`
    );
    addMessage("agent", `Wallet ready: ${embeddedWallet}. I can now quote funding for the ${selectedItem.buyoutCap} USDC escrow.`);
  }

  async function quoteLifi() {
    mark("quote_lifi_funding", "running");
    addMessage("tool", `LI.FI: quoting Base USDC to Solana USDC for ${selectedItem.buyoutCap} USDC.`);
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
        }),
      });
      const data = await res.json();
      mark("quote_lifi_funding", "done", `${data.route.provider}: ${data.route.estimatedOutput} Solana USDC`);
      addMessage("agent", `LI.FI route ready: ${data.route.estimatedOutput} Solana USDC after ${data.route.estimatedFee} USDC estimated fee.`);
    } catch {
      mark("quote_lifi_funding", "pending", "LI.FI quote failed. Try again.");
      addMessage("agent", "The LI.FI quote failed. Try the quote again before creating the rental request.");
    }
  }

  async function createRequest() {
    mark("create_solana_pay_rental_request", "running");
    addMessage("tool", "Solana Pay: preparing start_rental transaction request.");
    try {
      const res = await fetch("/api/solana-pay/start-rental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItem.id,
          renterWallet: wallet || demoWalletAddress,
          hours: rentalHours,
        }),
      });
      const data = await res.json();
      setRequestUrl(data.solanaPayUrl);
      mark("create_solana_pay_rental_request", "done", "Rental request ready for wallet approval");
      addMessage("agent", `Solana Pay request is ready for ${selectedItem.name}. It locks ${selectedItem.buyoutCap} USDC escrow and prepares the rental token mint.`);
    } catch {
      mark("create_solana_pay_rental_request", "pending", "Solana Pay request failed. Try again.");
      addMessage("agent", "The Solana Pay request failed. Try creating it again after funding is ready.");
    }
  }

  async function approveRental() {
    mark("mint_rental_token", "running");
    addMessage("tool", "RentProof: creating session, locking escrow, and minting rental token.");
    const res = await fetch("/api/rent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: selectedItem.id,
        renterWallet: wallet || demoWalletAddress,
        hours: rentalHours,
      }),
    });
    if (!res.ok) {
      mark("mint_rental_token", "pending", "Rental approval failed. Try the Solana Pay request again.");
      addMessage("agent", "The rental approval failed. Recreate the Solana Pay request and try again.");
      return;
    }
    const data = await res.json();
    setSessionActive(true);
    mark("mint_rental_token", "done", `Escrow locked, rental token ${data.rental.rentalTokenMint} minted`);
    mark("rentproof.get_session", "done", "MCP can read active meter and receipt state");
    addMessage("agent", `Rental active. Token ${data.rental.rentalTokenMint} is held by the renter, current expected fee is ${expectedFee} USDC, refundable balance is ${refundable} USDC.`);
  }

  function requestReturn() {
    setReturnRequested(true);
    mark("rentproof.get_session", "done", "Return requested; waiting for owner confirmation");
    addMessage("user", "I want to return it.");
    addMessage("agent", "Return requested. The owner can confirm physical return, burn the rental token, and mint the receipt.");
  }

  function confirmReturn() {
    setSessionActive(false);
    setReturnRequested(false);
    mark("mint_rental_token", "done", "Rental token burned on owner-confirmed return");
    mark("rentproof.get_session", "done", "Receipt ready for reputation and review");
    const receiptText = `returned_ok receipt minted. Fee ${expectedFee} USDC, refund ${refundable} USDC, rental token burned, reputation +1.`;
    setReceipt(receiptText);
    addMessage("tool", "RentProof: owner confirmed return.");
    addMessage("agent", receiptText);
  }

  async function advanceRentalFlow() {
    if (receipt) return;
    if (!wallet) {
      await startCrossmint();
      return;
    }
    if (!requestUrl) {
      await quoteLifi();
      await createRequest();
      return;
    }
    if (!sessionActive) {
      await approveRental();
      return;
    }
    if (!returnRequested) {
      requestReturn();
      return;
    }
    confirmReturn();
  }

  return (
    <section id="agent" className="relative min-h-[calc(100vh-48px)] overflow-hidden border-b border-black bg-[#9bd2e5]">
      <ProductWall selectedItemId={selectedItem.id} onBorrowItem={borrowItem} />

      <div className="pointer-events-none relative z-30 flex min-h-[calc(100vh-48px)] items-end justify-center px-3 py-5 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto grid w-full max-w-5xl gap-px border border-black/35 bg-black/45 shadow-[0_18px_70px_rgba(5,30,38,0.2)] backdrop-blur-xl sm:grid-cols-[220px_1fr_auto_auto]"
        >
          <div className="min-w-0 bg-white/88 px-4 py-3">
            <p className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-black">Tably agent</p>
            <p className="mt-1 truncate text-sm font-bold text-black">{agentOpen ? selectedItem.name : "Inventory search"}</p>
            <p className="truncate text-xs text-black/55">{statusLine}</p>
          </div>
          <label className="sr-only" htmlFor="agent-message">Message</label>
          <input
            id="agent-message"
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Try: 我要一個麥克風用 2 小時，低於 10 USDC"
            className="min-h-16 bg-white/88 px-4 py-3 text-sm text-black outline-none placeholder:text-black/35 focus:bg-white sm:min-h-0"
          />
          <button
            type="submit"
            disabled={Boolean(receipt)}
            className="bg-black px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-white hover:text-black disabled:opacity-45"
          >
            {actionLabel}
          </button>
          <button
            type="button"
            aria-label="Reset agent"
            onClick={() => {
              setAgentOpen(false);
              setInput("");
              if (inputRef.current) inputRef.current.value = "";
              setAgentNotice("Tell me what you need. I will check inventory and prepare the rental.");
            }}
            className="bg-white/88 px-4 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-black hover:bg-black hover:text-white"
          >
            Reset
          </button>
        </form>
      </div>
    </section>
  );
}

function ProductWall({
  selectedItemId,
  onBorrowItem,
}: {
  selectedItemId: string;
  onBorrowItem: (item: RentalItem) => void;
}) {
  const floatingItems = COMMUNITY_ITEMS.filter((item) => item.status === "available").slice(0, floatingProductSlots.length);

  return (
    <div className="grain-field absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_45%_92%,rgba(20,70,88,0.55),transparent_26%),linear-gradient(105deg,#7dcced_0%,#a8daea_45%,#eef1ef_100%)]">
      {floatingItems.map((item, index) => (
        <ProductWallTile
          key={item.id}
          item={item}
          selected={item.id === selectedItemId}
          className={floatingProductSlots[index]}
          onBorrowItem={onBorrowItem}
        />
      ))}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(255,255,255,0.18),transparent_18%)]" />
    </div>
  );
}

function ProductWallTile({
  item,
  selected,
  className,
  onBorrowItem,
}: {
  item: RentalItem;
  selected: boolean;
  className: string;
  onBorrowItem: (item: RentalItem) => void;
}) {
  return (
    <button
      aria-label={`Borrow ${item.name}`}
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        onBorrowItem(item);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onBorrowItem(item);
        }
      }}
      className={`absolute cursor-pointer transition-transform duration-200 hover:scale-[1.04] focus:outline-none focus-visible:scale-[1.04] focus-visible:ring-2 focus-visible:ring-black ${className} ${selected ? "z-20 opacity-95" : "z-10 opacity-72"}`}
    >
      <ProductShape item={item} />
    </button>
  );
}

function ProductShape({ item }: { item: RentalItem }) {
  if (item.id.includes("charger")) {
    return (
      <div className="relative h-full w-full [filter:drop-shadow(0_18px_24px_rgba(7,40,55,0.18))]">
        <div className="absolute left-[22%] top-[27%] h-[42%] w-[38%] rounded-[16%] bg-[#f4f1ea] shadow-[inset_-18px_-18px_30px_rgba(150,160,166,0.25),inset_10px_12px_20px_rgba(255,255,255,0.75)]" />
        <div className="absolute left-[54%] top-[42%] h-[5%] w-[28%] rounded-full bg-[#f4f1ea]" />
        <div className="absolute left-[70%] top-[36%] h-[18%] w-[7%] rounded-full bg-[#d8d7d0]" />
        <div className="absolute left-[80%] top-[36%] h-[18%] w-[7%] rounded-full bg-[#d8d7d0]" />
      </div>
    );
  }

  if (item.id.includes("adapter")) {
    return (
      <div className="relative h-full w-full [filter:drop-shadow(0_18px_24px_rgba(7,40,55,0.16))]">
        <div className="absolute left-[28%] top-[26%] h-[38%] w-[44%] rounded-[18%] bg-[#e8e4f7] shadow-[inset_-12px_-16px_24px_rgba(113,103,155,0.25),inset_12px_10px_22px_rgba(255,255,255,0.65)]" />
        <div className="absolute left-[42%] top-[39%] h-[9%] w-[16%] rounded-sm border border-[#8680a8]" />
        <div className="absolute left-[10%] top-[44%] h-[5%] w-[22%] rounded-full bg-[#d8d3ef]" />
        <div className="absolute left-[66%] top-[43%] h-[7%] w-[24%] rounded-full bg-[#d8d3ef]" />
      </div>
    );
  }

  if (item.id.includes("umbrella")) {
    return (
      <div className="relative h-full w-full [filter:drop-shadow(0_18px_24px_rgba(7,40,55,0.16))]">
        <div className="absolute left-[12%] top-[18%] h-[42%] w-[76%] rounded-t-full bg-[#d4f23d] shadow-[inset_-18px_-22px_28px_rgba(80,110,0,0.16),inset_15px_14px_24px_rgba(255,255,255,0.28)]" />
        <div className="absolute left-[49%] top-[56%] h-[32%] w-[4%] rounded-full bg-[#7f8460]" />
        <div className="absolute left-[46%] top-[84%] h-[12%] w-[18%] rounded-b-full border-b-[7px] border-r-[7px] border-[#7f8460]" />
      </div>
    );
  }

  if (item.id.includes("mic")) {
    return (
      <div className="relative h-full w-full [filter:drop-shadow(0_20px_24px_rgba(7,40,55,0.22))]">
        <div className="absolute left-[44%] top-[12%] h-[47%] w-[18%] rounded-full bg-[#c7b9f4] shadow-[inset_-10px_-14px_22px_rgba(91,83,125,0.28),inset_8px_10px_18px_rgba(255,255,255,0.5)]" />
        <div className="absolute left-[49%] top-[57%] h-[30%] w-[6%] rounded-full bg-[#36383c]" />
        <div className="absolute left-[35%] top-[81%] h-[6%] w-[34%] rounded-full bg-[#36383c]" />
        <div className="absolute left-[47%] top-[20%] h-[3%] w-[12%] rounded-full bg-white/55" />
        <div className="absolute left-[47%] top-[30%] h-[3%] w-[12%] rounded-full bg-white/40" />
      </div>
    );
  }

  if (item.id.includes("camera")) {
    return (
      <div className="relative h-full w-full [filter:drop-shadow(0_20px_24px_rgba(7,40,55,0.2))]">
        <div className="absolute left-[18%] top-[28%] h-[42%] w-[64%] rounded-[18%] bg-[#30343a] shadow-[inset_-15px_-18px_24px_rgba(0,0,0,0.32),inset_12px_10px_18px_rgba(255,255,255,0.08)]" />
        <div className="absolute left-[37%] top-[35%] h-[28%] w-[28%] rounded-full bg-[#171a1f] ring-[10px] ring-[#4c525c]" />
        <div className="absolute left-[45%] top-[43%] h-[12%] w-[12%] rounded-full bg-[#88d8ec]" />
        <div className="absolute left-[25%] top-[21%] h-[12%] w-[22%] rounded-t-lg bg-[#30343a]" />
      </div>
    );
  }

  if (item.id.includes("tripod")) {
    return (
      <div className="relative h-full w-full [filter:drop-shadow(0_18px_24px_rgba(7,40,55,0.16))]">
        <div className="absolute left-[45%] top-[12%] h-[18%] w-[14%] rounded-md bg-[#d6f13f]" />
        <div className="absolute left-[50%] top-[29%] h-[44%] w-[4%] rounded-full bg-[#30343a]" />
        <div className="absolute left-[50%] top-[65%] h-[34%] w-[4%] origin-top rotate-[24deg] rounded-full bg-[#30343a]" />
        <div className="absolute left-[50%] top-[65%] h-[34%] w-[4%] origin-top rotate-[-24deg] rounded-full bg-[#30343a]" />
      </div>
    );
  }

  if (item.id.includes("keyboard")) {
    return (
      <div className="relative h-full w-full [filter:drop-shadow(0_18px_24px_rgba(7,40,55,0.15))]">
        <div className="absolute left-[10%] top-[34%] h-[34%] w-[80%] rounded-[12%] bg-[#d6cef5] shadow-[inset_-18px_-18px_25px_rgba(89,80,130,0.18),inset_16px_13px_24px_rgba(255,255,255,0.48)]" />
        <div className="absolute left-[18%] top-[43%] grid w-[64%] grid-cols-8 gap-[3%]">
          {Array.from({ length: 24 }).map((_, index) => (
            <span key={index} className="aspect-square rounded-sm bg-white/52" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full [filter:drop-shadow(0_20px_24px_rgba(7,40,55,0.18))]">
      <div className="absolute left-[26%] top-[18%] h-[62%] w-[48%] rounded-[18%] bg-[#d6f13f] shadow-[inset_-20px_-24px_32px_rgba(65,95,0,0.2),inset_14px_13px_24px_rgba(255,255,255,0.28)]" />
      <div className="absolute left-[40%] top-[33%] h-[16%] w-[20%] rounded-md border-2 border-white/65" />
      <div className="absolute left-[44%] top-[54%] h-[4%] w-[12%] rounded-full bg-white/65" />
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
