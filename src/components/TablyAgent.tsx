"use client";

import { useCrossmintAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Image from "next/image";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { COMMUNITY_ITEMS } from "@/lib/store";
import { RentalItem } from "@/lib/types";

interface ParsedRentalIntent {
  item: RentalItem;
  hours: number;
  budget?: number;
  note?: string;
}

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
  const [wallet, setWallet] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [agentLine, setAgentLine] = useState("Tell Tably what you need. Recommendations appear after you ask.");

  const expectedFee = useMemo(
    () => Math.max(selectedItem.minimumFee, rentalHours * selectedItem.ratePerHour),
    [rentalHours, selectedItem.minimumFee, selectedItem.ratePerHour]
  );
  const recommendations = useMemo(() => getRecommendations(availableItems, selectedItem), [availableItems, selectedItem]);

  function focusQueryForItem(item: RentalItem) {
    setInput(`${item.name} for ${item.expectedHours}h`);
    setAgentLine(`Ask for ${item.name}, then Tably will compare similar options.`);
    inputRef.current?.focus();
  }

  function selectItem(item: RentalItem, hours = item.expectedHours, note?: string) {
    const fee = Math.max(item.minimumFee, hours * item.ratePerHour);
    setSelectedItem(item);
    setRentalHours(hours);
    setHasSearched(true);
    setAgentLine(note ?? `${item.name} is available near ${item.locationLabel}. Estimated rental: ${fee} USDC.`);
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
      inputRef.current?.focus();
      return;
    }
    const intent = parseIntent(text);
    const fee = Math.max(intent.item.minimumFee, intent.hours * intent.item.ratePerHour);
    const budgetLine = intent.budget ? (fee <= intent.budget ? ` Fits ${intent.budget} USDC budget.` : ` Above ${intent.budget} USDC budget.`) : "";
    selectItem(intent.item, intent.hours, `${intent.note ? `${intent.note} ` : ""}Found 3 related rentals.${budgetLine}`);
    setInput("");
  }

  function startCrossmint() {
    setAgentLine(
      crossmintConfigured
        ? "Opening Crossmint wallet sign-in."
        : "Crossmint is not configured. Add NEXT_PUBLIC_CROSSMINT_API_KEY to enable live wallet login."
    );
  }

  function handleWalletReady(address: string) {
    if (!address || address === wallet) return;
    setWallet(address);
    setAgentLine(`Wallet ${shortKey(address)} connected. Ask for an item to prepare a rental.`);
  }

  return (
    <section
      id="agent"
      className="grain-field relative h-[100svh] overflow-hidden bg-[#f7f3ea] px-4 pb-4 pt-20 text-[#061725] sm:px-8 sm:pb-6 sm:pt-24"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(200,255,24,0.34),transparent_22%),radial-gradient(circle_at_86%_12%,rgba(95,214,255,0.28),transparent_22%),radial-gradient(circle_at_14%_78%,rgba(151,110,255,0.2),transparent_26%),linear-gradient(135deg,#fffaf0_0%,#f7fbff_52%,#fbf3ff_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.18)_45%,rgba(255,255,255,0.78)_100%)]" />

      <MovingInventoryRows items={availableItems} onSelectItem={focusQueryForItem} />

      <div className="relative z-20 mx-auto flex h-full max-w-6xl items-center justify-center">
        <AgentChatbox
          agentLine={agentLine}
          crossmintConfigured={crossmintConfigured}
          expectedFee={expectedFee}
          hasSearched={hasSearched}
          input={input}
          inputRef={inputRef}
          onCrossmintStart={startCrossmint}
          onInputChange={setInput}
          onSelectItem={selectItem}
          onSubmit={handleSubmit}
          onWalletReady={handleWalletReady}
          recommendations={recommendations}
          rentalHours={rentalHours}
          selectedItem={selectedItem}
          wallet={wallet}
        />
      </div>
    </section>
  );
}

function MovingInventoryRows({ items, onSelectItem }: { items: RentalItem[]; onSelectItem: (item: RentalItem) => void }) {
  const topItems = items.slice(0, 6);
  const bottomItems = items.slice(6, 12).length ? items.slice(6, 12) : items.slice(0, 6);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <InventoryRow className="top-[15%] inventory-row-left" items={topItems} onSelectItem={onSelectItem} />
      <InventoryRow className="bottom-[10%] inventory-row-right" items={bottomItems} onSelectItem={onSelectItem} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.8)_21%,rgba(255,255,255,0.25)_40%,rgba(255,255,255,0)_64%)]" />
    </div>
  );
}

function InventoryRow({
  className,
  items,
  onSelectItem,
}: {
  className: string;
  items: RentalItem[];
  onSelectItem: (item: RentalItem) => void;
}) {
  const repeated = [...items, ...items, ...items];

  return (
    <div className={`absolute left-0 flex w-max items-stretch gap-4 px-4 sm:gap-5 sm:px-8 ${className}`}>
      {repeated.map((item, index) => (
        <ProductCard key={`${item.id}-${index}`} item={item} onClick={() => onSelectItem(item)} />
      ))}
    </div>
  );
}

function ProductCard({ item, onClick }: { item: RentalItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ask about ${item.name}`}
      className="pointer-events-auto group w-36 shrink-0 overflow-hidden rounded-[20px] border border-white/78 bg-white/88 p-2 text-left shadow-[0_18px_45px_rgba(6,23,37,0.08)] backdrop-blur-md transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_24px_60px_rgba(6,23,37,0.14)] sm:w-48"
    >
      <span className="relative block aspect-[4/3] overflow-hidden rounded-[15px] bg-[#eef2f6]">
        <Image src={item.imageUrl} alt={item.name} fill sizes="220px" className="object-cover transition duration-500 group-hover:scale-105" />
      </span>
      <span className="block px-1 pb-1 pt-3">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-black leading-tight text-[#061725] sm:text-[15px]">{item.name}</span>
            <span className="mt-1 block truncate text-[10px] font-bold text-[#607489] sm:text-[11px]">{item.locationLabel}</span>
          </span>
          <span className="rounded-full bg-[#c8ff18] px-2 py-1 text-[11px] font-black text-[#061725]">${item.ratePerHour}/h</span>
        </span>
      </span>
    </button>
  );
}

function AgentChatbox({
  agentLine,
  crossmintConfigured,
  expectedFee,
  hasSearched,
  input,
  inputRef,
  onCrossmintStart,
  onInputChange,
  onSelectItem,
  onSubmit,
  onWalletReady,
  recommendations,
  rentalHours,
  selectedItem,
  wallet,
}: {
  agentLine: string;
  crossmintConfigured: boolean;
  expectedFee: number;
  hasSearched: boolean;
  input: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onCrossmintStart: () => void;
  onInputChange: (value: string) => void;
  onSelectItem: (item: RentalItem, hours?: number, note?: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onWalletReady: (address: string) => void;
  recommendations: RentalItem[];
  rentalHours: number;
  selectedItem: RentalItem;
  wallet: string;
}) {
  return (
    <div className="w-full max-w-[680px] rounded-[34px] border border-white/80 bg-white/84 p-4 shadow-[0_36px_110px_rgba(6,23,37,0.2)] backdrop-blur-2xl sm:rounded-[44px] sm:p-6">
      <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[#061725]/16" />
      <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-full border border-[#dfe5ee] bg-white p-1.5 shadow-[0_14px_34px_rgba(6,23,37,0.08)]">
        <label className="sr-only" htmlFor="agent-command">Ask Tably</label>
        <input
          id="agent-command"
          ref={inputRef}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="charger for 3 hours near library"
          className="h-11 min-w-0 flex-1 rounded-full bg-transparent px-4 text-[15px] font-semibold text-[#061725] outline-none placeholder:text-[#6a7a87] sm:h-12 sm:px-5 sm:text-[18px]"
        />
        <button
          type="submit"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#c8ff18] text-[24px] font-black leading-none text-[#061725] transition hover:scale-105 hover:bg-[#ff7867] sm:h-12 sm:w-12"
          aria-label="Ask Tably"
        >
          &gt;
        </button>
      </form>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {crossmintConfigured ? (
          <CrossmintConnectButton onStart={onCrossmintStart} onWalletReady={onWalletReady} />
        ) : (
          <button
            type="button"
            onClick={onCrossmintStart}
            className="min-h-[44px] flex-1 rounded-full bg-[#061725] px-4 text-[14px] font-black text-white transition hover:bg-[#c8ff18] hover:text-[#061725]"
          >
            Connect Crossmint
          </button>
        )}
        <SolanaConnectButton onWalletReady={onWalletReady} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 px-1">
        <p className="min-w-0 truncate text-[12px] font-bold text-[#53697d] sm:text-[13px]">{agentLine}</p>
        {wallet && <p className="shrink-0 text-[12px] font-black text-[#061725]">{shortKey(wallet)}</p>}
      </div>

      {hasSearched && (
        <div className="pt-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-[12px] font-black text-[#061725]">Related rentals</p>
            <p className="text-[12px] font-black text-[#061725]">
              {rentalHours}h / ${expectedFee}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {recommendations.map((item) => (
              <RecommendationCard
                key={item.id}
                item={item}
                selected={item.id === selectedItem.id}
                onClick={() => onSelectItem(item, item.expectedHours, `${item.name} selected. Wallet stays connected for checkout.`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ item, selected, onClick }: { item: RentalItem; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-[18px] border bg-white p-2 text-left shadow-[0_10px_26px_rgba(6,23,37,0.07)] transition hover:-translate-y-0.5 ${
        selected ? "border-[#c8ff18] ring-2 ring-[#c8ff18]/40" : "border-[#e5ebf1]"
      }`}
    >
      <span className="relative block aspect-[4/3] overflow-hidden rounded-[13px] bg-[#eef2f6]">
        <Image src={item.imageUrl} alt="" fill sizes="180px" className="object-cover" />
      </span>
      <span className="mt-2 block truncate text-[12px] font-black text-[#061725] sm:text-[14px]">{item.name}</span>
      <span className="mt-1 flex items-center justify-between gap-1 text-[10px] font-bold text-[#607489] sm:text-[12px]">
        <span className="truncate">{item.ownerScore}% trust</span>
        <span className="shrink-0 text-[#061725]">${item.ratePerHour}/h</span>
      </span>
    </button>
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
  const label = isBusy ? "Connecting..." : wallet?.address ? `Crossmint ${shortKey(wallet.address)}` : "Connect Crossmint";

  return (
    <button
      type="button"
      onClick={() => {
        onStart();
        login();
      }}
      disabled={isBusy}
      className="min-h-[44px] flex-1 rounded-full bg-[#061725] px-4 text-[14px] font-black text-white transition hover:bg-[#c8ff18] hover:text-[#061725] disabled:opacity-50"
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
      className="min-h-[44px] flex-1 rounded-full border border-[#dfe7ef] bg-white px-4 text-[14px] font-black text-[#061725] transition hover:border-[#6b4cff] disabled:opacity-50"
    >
      {connecting ? "Connecting..." : connected && address ? `Solana ${shortKey(address)}` : "Connect Solana"}
    </button>
  );
}

function getRecommendations(items: RentalItem[], selectedItem: RentalItem) {
  const sameCategory = items.filter((item) => item.category === selectedItem.category && item.id !== selectedItem.id);
  const fallback = items.filter((item) => item.id !== selectedItem.id && !sameCategory.some((candidate) => candidate.id === item.id));
  return [selectedItem, ...sameCategory, ...fallback]
    .sort((a, b) => (a.id === selectedItem.id ? -1 : b.id === selectedItem.id ? 1 : b.ownerScore - a.ownerScore || a.ratePerHour - b.ratePerHour))
    .slice(0, 3);
}

function shortKey(value: unknown) {
  if (typeof value !== "string" || value.length < 10) return "wallet";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
