"use client";

import { type FormEvent, type RefObject, useMemo, useRef, useState } from "react";
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
  "left-[4vw] top-[15vh] h-[110px] w-[150px] rotate-[-8deg] sm:h-[150px] sm:w-[205px] lg:h-[175px] lg:w-[235px]",
  "left-[31vw] top-[54vh] h-[165px] w-[190px] rotate-[3deg] sm:h-[230px] sm:w-[260px] lg:h-[330px] lg:w-[360px]",
  "left-[48vw] top-[13vh] h-[95px] w-[145px] rotate-[2deg] sm:h-[135px] sm:w-[205px] lg:h-[175px] lg:w-[265px]",
  "right-[19vw] top-[33vh] h-[145px] w-[165px] rotate-[3deg] sm:h-[210px] sm:w-[245px] lg:h-[285px] lg:w-[330px]",
  "right-[6vw] top-[19vh] h-[165px] w-[185px] rotate-[5deg] sm:h-[230px] sm:w-[260px] lg:h-[315px] lg:w-[345px]",
  "left-[45vw] bottom-[7vh] h-[95px] w-[150px] rotate-[1deg] sm:h-[125px] sm:w-[210px] lg:h-[160px] lg:w-[270px]",
  "right-[21vw] bottom-[8vh] h-[135px] w-[165px] rotate-[-3deg] sm:h-[195px] sm:w-[240px] lg:h-[265px] lg:w-[315px]",
  "right-[4vw] bottom-[-10vh] hidden h-[150px] w-[210px] rotate-[-7deg] lg:block lg:h-[280px] lg:w-[370px]",
  "left-[13vw] top-[40vh] hidden h-[105px] w-[145px] rotate-[5deg] md:block lg:h-[150px] lg:w-[220px]",
];

const quickPrompts = [
  "What's available now?",
  "Help me find a mic",
  "Best gear for travel",
  "Return my rental",
];

const trustFeatures = [
  { icon: "globe", label: "CROSS-CHAIN FUNDING", detail: "LI.FI to Solana USDC" },
  { icon: "return", label: "EASY RETURNS", detail: "Owner-confirmed burn" },
  { icon: "shield", label: "SECURE ESCROW", detail: "Refundable buyout cap" },
  { icon: "headset", label: "AGENT SUPPORT", detail: "Voice or chat workflow" },
];

const crossmintApiKeyConfigured = Boolean(process.env.NEXT_PUBLIC_CROSSMINT_API_KEY);
const crossmintSdkWired = false;
const crossmintLive = crossmintApiKeyConfigured && crossmintSdkWired;
const demoWalletAddress = "demo_crossmint_wallet";

export function TablyAgent() {
  const defaultItem = COMMUNITY_ITEMS[0];
  const [steps, setSteps] = useState(initialSteps);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "agent_intro",
      role: "agent",
      text: "Hi, I'm your Tably agent. Tell me what you need, for how long, and any budget.",
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
  const [agentOpen, setAgentOpen] = useState(true);
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
    <section id="agent" className="relative h-screen overflow-hidden bg-[#83cdea] text-white">
      <ProductWall selectedItemId={selectedItem.id} onBorrowItem={borrowItem} />

      <div className="pointer-events-none absolute inset-0 z-20 flex items-start px-7 pb-28 pt-[38vh] sm:px-12 lg:px-[5vw]">
        <div className="max-w-[470px]">
          <h1 className="text-[38px] font-black uppercase leading-[0.98] tracking-[0.14em] text-white drop-shadow-[0_2px_10px_rgba(0,23,42,0.28)] sm:text-[52px] lg:text-[58px]">
            Built for<br />the borrow
          </h1>
          <p className="mt-5 text-base font-semibold tracking-[0.06em] text-white/92">
            Technical gear for the modern community.
          </p>
          <button
            type="button"
            onClick={() => {
              setAgentOpen(true);
              inputRef.current?.focus();
            }}
            className="pointer-events-auto mt-8 inline-flex h-12 items-center gap-8 bg-white px-7 text-[12px] font-black uppercase tracking-[0.13em] text-[#071a28] shadow-[0_12px_28px_rgba(0,22,35,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#071a28] hover:text-white"
          >
            Ask now
            <span aria-hidden="true" className="text-xl leading-none">→</span>
          </button>

          <div className="mt-[24vh] hidden sm:block">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-white">Scroll to explore</p>
            <p className="mt-3 text-3xl leading-none text-white">↓</p>
          </div>
        </div>
      </div>

      {agentOpen ? (
        <AgentPanel
          actionLabel={actionLabel}
          input={input}
          inputRef={inputRef}
          messages={messages}
          onClose={() => setAgentOpen(false)}
          onPrompt={runAgent}
          onSubmit={handleSubmit}
          receipt={receipt}
          selectedItem={selectedItem}
          setInput={setInput}
          statusLine={statusLine}
          steps={steps}
        />
      ) : (
        <button
          type="button"
          title={agentNotice}
          onClick={() => {
            setAgentOpen(true);
            inputRef.current?.focus();
          }}
          className="absolute bottom-28 right-6 z-40 inline-flex h-14 items-center gap-3 rounded-full border border-white/40 bg-[#071a28]/90 px-5 text-[12px] font-black uppercase tracking-[0.13em] text-white shadow-[0_18px_60px_rgba(0,12,24,0.32)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white hover:text-[#071a28] lg:right-12"
        >
          <AgentIcon />
          Ask Tably
        </button>
      )}

      <TrustBar />
    </section>
  );
}

function AgentPanel({
  actionLabel,
  input,
  inputRef,
  messages,
  onClose,
  onPrompt,
  onSubmit,
  receipt,
  selectedItem,
  setInput,
  statusLine,
  steps,
}: {
  actionLabel: string;
  input: string;
  inputRef: RefObject<HTMLInputElement | null>;
  messages: ChatMessage[];
  onClose: () => void;
  onPrompt: (text: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  receipt: string;
  selectedItem: RentalItem;
  setInput: (value: string) => void;
  statusLine: string;
  steps: ToolStep[];
}) {
  const visibleMessages = messages.slice(-3);
  const runningStep = steps.find((step) => step.status === "running");
  const doneCount = steps.filter((step) => step.status === "done").length;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 top-24 z-40 overflow-y-auto px-4 sm:bottom-28 sm:px-6 lg:bottom-auto lg:left-auto lg:right-[4.5vw] lg:top-[31vh] lg:w-[380px] lg:overflow-visible lg:px-0">
      <div className="pointer-events-auto overflow-hidden rounded-[22px] border border-white/12 bg-[#071827]/95 text-white shadow-[0_32px_90px_rgba(0,12,24,0.45)] backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/7">
              <AgentIcon />
            </div>
            <div>
              <p className="text-[12px] font-black tracking-[0.04em]">Tably Agent</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/74">
                <span className="h-1.5 w-1.5 rounded-full bg-[#50d47d]" />
                Online
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close agent"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-lg text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            −
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="space-y-3">
            {visibleMessages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-5 shadow-[0_10px_26px_rgba(0,0,0,0.12)] ${
                  message.role === "user"
                    ? "ml-auto bg-white text-[#071827]"
                    : message.role === "tool"
                      ? "bg-[#0d2940] text-white/72"
                      : "bg-white/9 text-white"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-white/48">{runningStep ? runningStep.detail : statusLine}</p>

          <div className="mt-5 grid gap-2 border-l border-white/14 pl-4">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onPrompt(prompt)}
                className="w-fit rounded-full bg-white/8 px-4 py-2 text-left text-[13px] font-semibold text-white/90 transition hover:bg-white hover:text-[#071827]"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-black">{selectedItem.name}</p>
                <p className="mt-1 truncate text-[11px] text-white/55">
                  {doneCount}/6 tools ready · {statusLine}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white/70">
                {receipt ? "Receipt" : "Rent"}
              </span>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-5 flex items-center gap-2 rounded-2xl border border-white/18 bg-white/[0.04] p-2">
            <label className="sr-only" htmlFor="agent-message">Message</label>
            <input
              id="agent-message"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask anything..."
              className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-white/45"
            />
            <button
              type="submit"
              disabled={Boolean(receipt)}
              aria-label={actionLabel}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-lg font-black text-[#071827] transition hover:scale-105 disabled:opacity-45"
            >
              →
            </button>
          </form>

          <p className="mt-3 text-center text-[11px] text-white/50">Escrow, receipt, and reputation handled by RentProof</p>
        </div>
      </div>

      <button
        type="button"
        aria-label="Close agent"
        onClick={onClose}
        className="ml-auto mt-3 grid h-14 w-14 place-items-center rounded-full bg-[#071827] text-3xl leading-none text-white shadow-[0_18px_45px_rgba(0,12,24,0.35)] transition hover:bg-white hover:text-[#071827]"
      >
        ×
      </button>
    </div>
  );
}

function TrustBar() {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 border-t border-white/18 bg-[#061420]/78 px-6 py-5 text-white shadow-[0_-18px_70px_rgba(0,15,28,0.2)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {trustFeatures.map((feature, index) => (
          <div key={feature.label} className={`flex items-center gap-4 ${index > 0 ? "lg:border-l lg:border-white/18 lg:pl-12" : ""}`}>
            <FeatureIcon icon={feature.icon} />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.1em]">{feature.label}</p>
              <p className="mt-1 text-xs text-white/68">{feature.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path d="M8 9h8a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-1a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 9V5M9.5 5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 13h.01M15 13h.01M10 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 8l1.4-1.4M20.4 9.4 19 8l1.4-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function FeatureIcon({ icon }: { icon: string }) {
  if (icon === "return") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="none">
        <path d="M7 7h8a5 5 0 1 1 0 10H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 7l3-3M7 7l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === "shield") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="none">
        <path d="M12 3 19 6v5c0 4.5-2.8 7.8-7 10-4.2-2.2-7-5.5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === "headset") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="none">
        <path d="M5 13a7 7 0 0 1 14 0v4a3 3 0 0 1-3 3h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M5 13v4h3v-5H6a1 1 0 0 0-1 1ZM19 13v4h-3v-5h2a1 1 0 0 1 1 1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="none">
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 12h17M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21M12 3c-2.2 2.4-3.3 5.4-3.3 9S9.8 18.6 12 21" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
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
    <div className="grain-field absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_58%_88%,rgba(245,248,250,0.8),transparent_18%),radial-gradient(circle_at_58%_40%,rgba(209,234,255,0.7),transparent_25%),linear-gradient(105deg,#03101b_0%,#12324a_27%,#6eaee2_63%,#8ac9ef_100%)]">
      {floatingItems.map((item, index) => (
        <ProductWallTile
          key={item.id}
          item={item}
          selected={item.id === selectedItemId}
          className={floatingProductSlots[index]}
          onBorrowItem={onBorrowItem}
        />
      ))}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,5,12,0.34),transparent_42%,rgba(255,255,255,0.05)),radial-gradient(circle_at_55%_83%,rgba(0,5,12,0.18),transparent_10%)]" />
      <div className="pointer-events-none absolute right-[4vw] top-[14vh] text-[12px] font-black tracking-[0.16em] text-white/86">[ $USDC ]</div>
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
      className={`group absolute cursor-pointer transition duration-300 hover:scale-[1.045] hover:opacity-100 focus:outline-none focus-visible:scale-[1.045] focus-visible:ring-2 focus-visible:ring-white ${className} ${selected ? "z-20 opacity-100" : "z-10 opacity-78"}`}
    >
      <ProductPhoto item={item} />
      <span className="pointer-events-none absolute left-1/2 top-full mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-white/84 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#071827] shadow-[0_8px_22px_rgba(0,0,0,0.14)] backdrop-blur-md group-hover:block group-focus-visible:block">
        Borrow {item.name}
      </span>
    </button>
  );
}

function ProductPhoto({ item }: { item: RentalItem }) {
  return (
    <div className="relative h-full w-full [filter:drop-shadow(0_24px_32px_rgba(7,35,50,0.22))]">
      <div
        className="h-full w-full rounded-[18%] bg-cover bg-center opacity-88 saturate-[0.92] transition duration-300 [mix-blend-mode:multiply] group-hover:opacity-100 group-hover:saturate-100"
        style={{ backgroundImage: `url(${item.imageUrl})` }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[18%] bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.45),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.18),rgba(0,0,0,0.06))]" />
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
