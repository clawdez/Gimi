"use client";

import Image from "next/image";
import { type FormEvent, useMemo, useRef, useState } from "react";
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

export function TablyAgent() {
  const availableItems = COMMUNITY_ITEMS.filter((item) => item.status === "available");
  const defaultItem = availableItems[0] ?? COMMUNITY_ITEMS[0];
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedItem, setSelectedItem] = useState(defaultItem);
  const [rentalHours, setRentalHours] = useState(defaultItem.expectedHours);
  const [input, setInput] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [agentLine, setAgentLine] = useState("Ask for gear, or tap any listing.");

  const expectedFee = useMemo(
    () => Math.max(selectedItem.minimumFee, rentalHours * selectedItem.ratePerHour),
    [rentalHours, selectedItem.minimumFee, selectedItem.ratePerHour]
  );
  const recommendations = useMemo(() => getRecommendations(availableItems, selectedItem), [availableItems, selectedItem]);

  function selectItem(item: RentalItem, hours = item.expectedHours, note?: string) {
    const fee = Math.max(item.minimumFee, hours * item.ratePerHour);
    setSelectedItem(item);
    setRentalHours(hours);
    setDrawerOpen(true);
    setAgentLine(note ?? `${item.name} is available near ${item.locationLabel}. Estimated rental: ${fee} USDC.`);
    inputRef.current?.focus();
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
      setDrawerOpen(true);
      inputRef.current?.focus();
      return;
    }
    const intent = parseIntent(text);
    const fee = Math.max(intent.item.minimumFee, intent.hours * intent.item.ratePerHour);
    const budgetLine = intent.budget ? (fee <= intent.budget ? ` Fits ${intent.budget} USDC budget.` : ` Above ${intent.budget} USDC budget.`) : "";
    selectItem(intent.item, intent.hours, `${intent.note ? `${intent.note} ` : ""}Found 3 good options.${budgetLine}`);
    setInput("");
  }

  return (
    <section
      id="agent"
      className="grain-field relative h-[100svh] overflow-hidden bg-[#f7f3ea] px-4 pb-4 pt-20 text-[#061725] sm:px-8 sm:pb-6 sm:pt-24"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(200,255,24,0.34),transparent_22%),radial-gradient(circle_at_86%_12%,rgba(95,214,255,0.28),transparent_22%),radial-gradient(circle_at_14%_78%,rgba(151,110,255,0.2),transparent_26%),linear-gradient(135deg,#fffaf0_0%,#f7fbff_52%,#fbf3ff_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0)_32%,rgba(255,255,255,0.74)_100%)]" />

      <InventoryWall items={availableItems} selectedItem={selectedItem} onSelectItem={selectItem} />

      <AgentDrawer
        agentLine={agentLine}
        drawerOpen={drawerOpen}
        expectedFee={expectedFee}
        input={input}
        inputRef={inputRef}
        onInputChange={setInput}
        onSelectItem={selectItem}
        onSubmit={handleSubmit}
        recommendations={recommendations}
        rentalHours={rentalHours}
        selectedItem={selectedItem}
        setDrawerOpen={setDrawerOpen}
      />
    </section>
  );
}

function InventoryWall({
  items,
  selectedItem,
  onSelectItem,
}: {
  items: RentalItem[];
  selectedItem: RentalItem;
  onSelectItem: (item: RentalItem, hours?: number, note?: string) => void;
}) {
  const visibleItems = items.slice(0, 10);

  return (
    <div className="absolute inset-x-0 top-20 bottom-40 overflow-hidden sm:top-24 sm:bottom-44">
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/60 to-transparent" />
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 sm:grid-cols-3 sm:gap-5 sm:px-8 lg:grid-cols-5">
        {visibleItems.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            selected={item.id === selectedItem.id}
            onClick={() => onSelectItem(item, item.expectedHours, `Found 3 similar rentals for ${item.name}.`)}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#fffaf4] via-[#fffaf4]/86 to-transparent" />
    </div>
  );
}

function ProductCard({ item, selected, onClick }: { item: RentalItem; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View recommendations for ${item.name}`}
      className={`group w-40 shrink-0 overflow-hidden rounded-[22px] border bg-white/86 p-2 text-left shadow-[0_18px_45px_rgba(6,23,37,0.08)] backdrop-blur-md transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_24px_60px_rgba(6,23,37,0.14)] sm:w-52 ${
        selected ? "border-[#c8ff18] ring-4 ring-[#c8ff18]/34" : "border-white/76"
      }`}
    >
      <span className="relative block aspect-[4/3] overflow-hidden rounded-[17px] bg-[#eef2f6]">
        <Image src={item.imageUrl} alt={item.name} fill sizes="220px" className="object-cover transition duration-500 group-hover:scale-105" />
      </span>
      <span className="block px-1 pb-1 pt-3">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-black leading-tight text-[#061725] sm:text-[16px]">{item.name}</span>
            <span className="mt-1 block truncate text-[11px] font-bold text-[#607489] sm:text-[12px]">{item.locationLabel}</span>
          </span>
          <span className="rounded-full bg-[#c8ff18] px-2.5 py-1 text-[12px] font-black text-[#061725]">${item.ratePerHour}/h</span>
        </span>
      </span>
    </button>
  );
}

function AgentDrawer({
  agentLine,
  drawerOpen,
  expectedFee,
  input,
  inputRef,
  onInputChange,
  onSelectItem,
  onSubmit,
  recommendations,
  rentalHours,
  selectedItem,
  setDrawerOpen,
}: {
  agentLine: string;
  drawerOpen: boolean;
  expectedFee: number;
  input: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onSelectItem: (item: RentalItem, hours?: number, note?: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  recommendations: RentalItem[];
  rentalHours: number;
  selectedItem: RentalItem;
  setDrawerOpen: (open: boolean) => void;
}) {
  return (
    <div className="absolute inset-x-4 bottom-4 z-20 mx-auto max-w-[760px] rounded-[28px] border border-white/80 bg-white/86 p-3 shadow-[0_34px_100px_rgba(6,23,37,0.2)] backdrop-blur-2xl sm:bottom-6 sm:p-4">
      <button
        type="button"
        aria-label={drawerOpen ? "Collapse rental drawer" : "Open rental drawer"}
        onClick={() => setDrawerOpen(!drawerOpen)}
        className="mx-auto mb-3 block h-1.5 w-14 rounded-full bg-[#061725]/18 transition hover:bg-[#061725]/34"
      />

      <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-full border border-[#dfe5ee] bg-white p-1.5 shadow-[0_14px_34px_rgba(6,23,37,0.08)]">
        <label className="sr-only" htmlFor="agent-command">Ask Tably</label>
        <input
          id="agent-command"
          ref={inputRef}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="What do you need to borrow?"
          className="h-11 min-w-0 flex-1 rounded-full bg-transparent px-4 text-[15px] font-semibold text-[#061725] outline-none placeholder:text-[#6a7a87] sm:h-12 sm:px-5 sm:text-[17px]"
        />
        <button
          type="submit"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#c8ff18] text-[24px] font-black leading-none text-[#061725] transition hover:scale-105 hover:bg-[#ff7867] sm:h-12 sm:w-12"
          aria-label="Ask Tably"
        >
          &gt;
        </button>
      </form>

      {drawerOpen && (
        <div className="pt-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="min-w-0 truncate text-[12px] font-bold text-[#53697d] sm:text-[13px]">{agentLine}</p>
            <p className="shrink-0 text-[12px] font-black text-[#061725]">
              {rentalHours}h / ${expectedFee}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            {recommendations.map((item) => (
              <RecommendationCard
                key={item.id}
                item={item}
                selected={item.id === selectedItem.id}
                onClick={() => onSelectItem(item, item.expectedHours, `${item.name} selected. I can prepare checkout when you are ready.`)}
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

function getRecommendations(items: RentalItem[], selectedItem: RentalItem) {
  const sameCategory = items.filter((item) => item.category === selectedItem.category && item.id !== selectedItem.id);
  const fallback = items.filter((item) => item.id !== selectedItem.id && !sameCategory.some((candidate) => candidate.id === item.id));
  return [selectedItem, ...sameCategory, ...fallback]
    .sort((a, b) => (a.id === selectedItem.id ? -1 : b.id === selectedItem.id ? 1 : b.ownerScore - a.ownerScore || a.ratePerHour - b.ratePerHour))
    .slice(0, 3);
}
