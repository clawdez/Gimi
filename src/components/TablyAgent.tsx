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
  "left-[-2vw] top-[15vh] h-[145px] w-[190px] rotate-[-10deg] sm:h-[210px] sm:w-[265px] lg:h-[250px] lg:w-[320px]",
  "left-[24vw] top-[61vh] h-[160px] w-[190px] rotate-[4deg] sm:h-[220px] sm:w-[250px] lg:h-[275px] lg:w-[310px]",
  "left-[51vw] top-[13vh] h-[110px] w-[170px] rotate-[3deg] sm:h-[145px] sm:w-[225px] lg:h-[185px] lg:w-[285px]",
  "right-[2vw] top-[19vh] h-[195px] w-[215px] rotate-[5deg] sm:h-[275px] sm:w-[295px] lg:h-[360px] lg:w-[380px]",
  "right-[15vw] top-[58vh] h-[140px] w-[170px] rotate-[-5deg] sm:h-[195px] sm:w-[235px] lg:h-[265px] lg:w-[305px]",
  "left-[4vw] bottom-[-11vh] h-[150px] w-[190px] rotate-[8deg] sm:h-[230px] sm:w-[285px] lg:h-[310px] lg:w-[365px]",
  "right-[0vw] bottom-[-14vh] h-[145px] w-[205px] rotate-[-7deg] sm:h-[225px] sm:w-[305px] lg:h-[300px] lg:w-[390px]",
  "left-[70vw] top-[7vh] hidden h-[95px] w-[140px] rotate-[-4deg] sm:block lg:h-[140px] lg:w-[205px]",
  "left-[13vw] top-[39vh] hidden h-[115px] w-[165px] rotate-[5deg] md:block lg:h-[165px] lg:w-[235px]",
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
  const [agentNotice, setAgentNotice] = useState("Main hall inventory is live.");

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
  const statusLine = receipt
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
    <section id="agent" className="relative min-h-screen overflow-hidden bg-[#99d8ec]">
      <ProductWall selectedItemId={selectedItem.id} onBorrowItem={borrowItem} />

      <div className="pointer-events-none relative z-30 flex min-h-screen items-center justify-center px-4 pb-10 pt-20 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className={`pointer-events-auto w-full border border-black/20 bg-white/62 text-black shadow-[0_26px_90px_rgba(7,45,58,0.16)] backdrop-blur-2xl transition-all duration-300 ${
            agentOpen ? "max-w-[760px]" : "max-w-[560px]"
          }`}
        >
          <div className="grid gap-px bg-black/20 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0 bg-white/82 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/50">Tably</p>
                  <p className="mt-1 truncate text-base font-black leading-none sm:text-lg">
                    {agentOpen ? selectedItem.name : "What do you need?"}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.12em] text-black/45">
                  {wallet ? "Ready" : "Agent"}
                </span>
              </div>
              {agentOpen && <p className="mt-2 truncate text-xs text-black/50">{statusLine}</p>}
              {!agentOpen && <p className="mt-2 truncate text-xs text-black/45">{agentNotice}</p>}
            </div>

            <div className="bg-white/82 p-3 sm:w-[172px] sm:p-4">
              <button
                type="submit"
                disabled={Boolean(receipt)}
                className="h-11 w-full bg-black px-4 text-[11px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-white hover:text-black disabled:opacity-45"
              >
                {actionLabel}
              </button>
            </div>
          </div>

          <div className="grid gap-px bg-black/20 sm:grid-cols-[1fr_auto]">
            <label className="sr-only" htmlFor="agent-message">Message</label>
            <input
              id="agent-message"
              ref={inputRef}
              value={input}
              onFocus={() => setAgentOpen(true)}
              onChange={(event) => setInput(event.target.value)}
              placeholder="mic for 2 hours under 10"
              className="h-14 min-w-0 bg-white/86 px-4 text-sm text-black outline-none placeholder:text-black/35 focus:bg-white sm:px-5"
            />
            <button
              type="button"
              aria-label={agentOpen ? "Close agent" : "Open agent"}
              onClick={() => {
                if (!agentOpen) {
                  setAgentOpen(true);
                  inputRef.current?.focus();
                  return;
                }
                setAgentOpen(false);
                setInput("");
                if (inputRef.current) inputRef.current.value = "";
                setAgentNotice("Main hall inventory is live.");
              }}
              className="h-14 bg-white/86 px-5 text-[11px] font-black uppercase tracking-[0.12em] text-black/60 transition-colors hover:bg-black hover:text-white"
            >
              {agentOpen ? "Close" : "Open"}
            </button>
          </div>
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
    <div className="grain-field absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_42%_72%,rgba(18,82,101,0.42),transparent_30%),radial-gradient(circle_at_78%_18%,rgba(245,255,255,0.7),transparent_23%),linear-gradient(112deg,#70ccec_0%,#a7dfec_48%,#eef2ee_100%)]">
      {floatingItems.map((item, index) => (
        <ProductWallTile
          key={item.id}
          item={item}
          selected={item.id === selectedItemId}
          className={floatingProductSlots[index]}
          onBorrowItem={onBorrowItem}
        />
      ))}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.28),transparent_20%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/10 to-transparent" />
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
      className={`group absolute cursor-pointer transition duration-300 hover:scale-[1.045] hover:opacity-100 focus:outline-none focus-visible:scale-[1.045] focus-visible:ring-2 focus-visible:ring-black ${className} ${selected ? "z-20 opacity-95" : "z-10 opacity-70"}`}
    >
      <ProductPhoto item={item} />
      <span className="pointer-events-none absolute left-1/2 top-full mt-1 hidden -translate-x-1/2 whitespace-nowrap border border-black/20 bg-white/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-black/65 backdrop-blur-md group-hover:block group-focus-visible:block">
        {item.name}
      </span>
    </button>
  );
}

function ProductPhoto({ item }: { item: RentalItem }) {
  return (
    <div className="relative h-full w-full [filter:drop-shadow(0_22px_30px_rgba(7,40,55,0.2))]">
      <div
        className="h-full w-full rounded-[18%] bg-cover bg-center opacity-90 saturate-[0.9] transition duration-300 [mix-blend-mode:multiply] group-hover:opacity-100 group-hover:saturate-100"
        style={{ backgroundImage: `url(${item.imageUrl})` }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[18%] bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.42),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.18),rgba(0,0,0,0.08))]" />
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
