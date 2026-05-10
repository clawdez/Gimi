"use client";

import { useCrossmintAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { SolanaWallet } from "@crossmint/wallets-sdk";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Connection, Transaction } from "@solana/web3.js";
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

type RentalActionStatus = "idle" | "preparing" | "ready" | "signing" | "sent" | "error";
type RentalTransactionKind = "start" | "return" | "buyout";

interface PreparedRentalTransaction {
  kind: RentalTransactionKind;
  cluster: string;
  blockhash: string;
  draftId: string;
  itemId: string;
  lastValidBlockHeight: number;
  renterWallet: string;
  requiredSigner: string;
  rpcUrl: string;
  transactionBase64: string;
}

interface ActiveRental {
  draftId: string;
  itemId: string;
  renterWallet: string;
  startSignature: string;
}

type CrossmintWalletInstance = NonNullable<ReturnType<typeof useWallet>["wallet"]>;
type SolanaSendTransaction = ReturnType<typeof useSolanaWallet>["sendTransaction"];

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
  const { wallet: crossmintWallet } = useWallet();
  const solanaWallet = useSolanaWallet();
  const crossmintSigner = crossmintWallet?.address ?? "";
  const solanaSigner = solanaWallet.publicKey?.toBase58() ?? "";
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedItem, setSelectedItem] = useState(defaultItem);
  const [rentalHours, setRentalHours] = useState(defaultItem.expectedHours);
  const [input, setInput] = useState("");
  const [wallet, setWallet] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [rentalActionStatus, setRentalActionStatus] = useState<RentalActionStatus>("idle");
  const [txPreview, setTxPreview] = useState("");
  const [preparedTx, setPreparedTx] = useState<PreparedRentalTransaction | null>(null);
  const [activeRental, setActiveRental] = useState<ActiveRental | null>(null);
  const [txSignature, setTxSignature] = useState("");
  const [agentLine, setAgentLine] = useState("Tell Tably what you need. Recommendations appear after you ask.");

  const expectedFee = useMemo(
    () => Math.max(selectedItem.minimumFee, rentalHours * selectedItem.ratePerHour),
    [rentalHours, selectedItem.minimumFee, selectedItem.ratePerHour]
  );
  const recommendations = useMemo(() => getRecommendations(availableItems, selectedItem), [availableItems, selectedItem]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  function focusQueryForItem(item: RentalItem) {
    setInput(`${item.name} for ${item.expectedHours}h`);
    setHasSearched(false);
    setIsSearching(false);
    setRentalActionStatus("idle");
    setTxPreview("");
    setPreparedTx(null);
    setActiveRental(null);
    setTxSignature("");
    setAgentLine(`Press enter to compare ${item.name} with similar rentals.`);
    inputRef.current?.focus();
  }

  function selectItem(item: RentalItem, hours = item.expectedHours, note?: string) {
    const fee = Math.max(item.minimumFee, hours * item.ratePerHour);
    setSelectedItem(item);
    setRentalHours(hours);
    setIsSearching(false);
    setHasSearched(true);
    setRentalActionStatus("idle");
    setTxPreview("");
    setPreparedTx(null);
    setActiveRental(null);
    setTxSignature("");
    setAgentLine(note ?? `${item.name} is available near ${item.locationLabel}. Estimated rental: ${fee} USDC.`);
  }

  async function prepareRental() {
    const renterWallet = solanaSigner || crossmintSigner || wallet;
    if (!renterWallet) {
      setAgentLine("Connect a wallet first, then Tably can prepare the rental transaction.");
      return;
    }

    setRentalActionStatus("preparing");
    setTxPreview("");
    setPreparedTx(null);
    setTxSignature("");
    setAgentLine(`Preparing rental transaction for ${selectedItem.name}...`);

    try {
      const res = await fetch("/api/solana-pay/start-rental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItem.id, renterWallet, hours: rentalHours }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to prepare rental");
      const metadata = data.transactionMetadata ?? {};
      setPreparedTx({
        kind: "start",
        cluster: metadata.cluster ?? "devnet",
        blockhash: metadata.blockhash,
        draftId: data.draftId,
        itemId: selectedItem.id,
        lastValidBlockHeight: metadata.lastValidBlockHeight,
        renterWallet,
        requiredSigner: metadata.requiredSigner,
        rpcUrl: metadata.rpcUrl ?? "https://api.devnet.solana.com",
        transactionBase64: data.transaction,
      });
      setRentalActionStatus("ready");
      setTxPreview(`${metadata.cluster ?? "devnet"} / ${shortKey(metadata.requiredSigner)} / ${String(data.transaction ?? "").length} chars`);
      setAgentLine(
        solanaSigner || crossmintSigner
          ? `Rental transaction prepared for ${selectedItem.name}. Sign with your wallet to send it.`
          : `Rental transaction prepared for ${selectedItem.name}. Connect a Solana wallet to sign and send.`
      );
    } catch (error) {
      setRentalActionStatus("error");
      setAgentLine(error instanceof Error ? `Could not prepare transaction: ${error.message}` : "Could not prepare the rental transaction. Try again.");
    }
  }

  async function prepareSettlement(kind: Exclude<RentalTransactionKind, "start">) {
    if (!activeRental) {
      setAgentLine("Start a rental first, then the owner can prepare return or buyout settlement.");
      return;
    }

    setRentalActionStatus("preparing");
    setTxPreview("");
    setPreparedTx(null);
    setTxSignature("");
    setAgentLine(kind === "return" ? "Preparing owner return confirmation..." : "Preparing owner auto-buyout transaction...");

    try {
      const endpoint = kind === "return" ? "/api/solana-pay/confirm-return" : "/api/solana-pay/auto-buyout";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: activeRental.itemId,
          rentalId: activeRental.draftId,
          renterWallet: activeRental.renterWallet,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to prepare settlement");
      const metadata = data.transactionMetadata ?? {};
      setPreparedTx({
        kind,
        cluster: metadata.cluster ?? "devnet",
        blockhash: metadata.blockhash,
        draftId: data.rentalId,
        itemId: activeRental.itemId,
        lastValidBlockHeight: metadata.lastValidBlockHeight,
        renterWallet: activeRental.renterWallet,
        requiredSigner: metadata.requiredSigner,
        rpcUrl: metadata.rpcUrl ?? "https://api.devnet.solana.com",
        transactionBase64: data.transaction,
      });
      setRentalActionStatus("ready");
      setTxPreview(`${metadata.cluster ?? "devnet"} / ${shortKey(metadata.requiredSigner)} / ${String(data.transaction ?? "").length} chars`);
      setAgentLine(
        kind === "return"
          ? "Return confirmation prepared. Owner wallet must sign to settle escrow and burn the rental token."
          : "Auto-buyout prepared. Owner wallet must sign after due time plus grace."
      );
    } catch (error) {
      setRentalActionStatus("error");
      setAgentLine(error instanceof Error ? `Could not prepare settlement: ${error.message}` : "Could not prepare settlement. Try again.");
    }
  }

  async function signAndSendRental() {
    if (!preparedTx) {
      await prepareRental();
      return;
    }
    const canUseSolanaAdapter = solanaSigner === preparedTx.requiredSigner;
    const canUseCrossmintWallet = Boolean(crossmintWallet && crossmintSigner === preparedTx.requiredSigner);

    if (!canUseSolanaAdapter && !canUseCrossmintWallet) {
      setAgentLine("Connected signer does not match this prepared transaction. Prepare again with the wallet you want to use.");
      return;
    }

    setRentalActionStatus("signing");
    setAgentLine("Waiting for wallet signature...");

    try {
      const connection = new Connection(preparedTx.rpcUrl, "confirmed");
      const signature = canUseSolanaAdapter
        ? await sendWithSolanaAdapter(preparedTx, connection, solanaWallet.sendTransaction)
        : await sendWithCrossmintWallet(preparedTx, crossmintWallet);
      await connection.confirmTransaction(
        {
          signature,
          blockhash: preparedTx.blockhash,
          lastValidBlockHeight: preparedTx.lastValidBlockHeight,
        },
        "confirmed"
      );
      setTxSignature(signature);
      setTxPreview(`${preparedTx.cluster} / ${shortKey(signature)}`);
      setRentalActionStatus("sent");
      if (preparedTx.kind === "start") {
        setActiveRental({
          draftId: preparedTx.draftId,
          itemId: preparedTx.itemId,
          renterWallet: preparedTx.renterWallet,
          startSignature: signature,
        });
      }
      setAgentLine(`${transactionKindLabel(preparedTx.kind)} sent on ${preparedTx.cluster}: ${shortKey(signature)}.`);
    } catch (error) {
      setRentalActionStatus("error");
      setAgentLine(error instanceof Error ? `Transaction not sent: ${error.message}` : "Transaction was not sent.");
    }
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
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setHasSearched(false);
    setIsSearching(true);
    setAgentLine("Checking nearby inventory and trust receipts...");
    setInput("");
    searchTimeoutRef.current = setTimeout(() => {
      selectItem(intent.item, intent.hours, `${intent.note ? `${intent.note} ` : ""}Found 3 related rentals.${budgetLine}`);
    }, 420);
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
          isSearching={isSearching}
          onCrossmintStart={startCrossmint}
          onInputChange={setInput}
          onPrepareRental={() => void prepareRental()}
          onPrepareSettlement={(kind) => void prepareSettlement(kind)}
          onSignAndSendRental={() => void signAndSendRental()}
          onSelectItem={selectItem}
          onSubmit={handleSubmit}
          onWalletReady={handleWalletReady}
          recommendations={recommendations}
          activeRental={activeRental}
          preparedTxKind={preparedTx?.kind ?? null}
          rentalActionStatus={rentalActionStatus}
          rentalHours={rentalHours}
          selectedItem={selectedItem}
          canSignRental={canSignPreparedRental(preparedTx, solanaSigner, crossmintSigner)}
          txSignature={txSignature}
          txPreview={txPreview}
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
  activeRental,
  agentLine,
  crossmintConfigured,
  expectedFee,
  hasSearched,
  input,
  inputRef,
  isSearching,
  onCrossmintStart,
  onInputChange,
  onPrepareRental,
  onPrepareSettlement,
  onSignAndSendRental,
  onSelectItem,
  onSubmit,
  onWalletReady,
  recommendations,
  preparedTxKind,
  rentalActionStatus,
  rentalHours,
  selectedItem,
  canSignRental,
  txSignature,
  txPreview,
  wallet,
}: {
  activeRental: ActiveRental | null;
  agentLine: string;
  canSignRental: boolean;
  crossmintConfigured: boolean;
  expectedFee: number;
  hasSearched: boolean;
  input: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isSearching: boolean;
  onCrossmintStart: () => void;
  onInputChange: (value: string) => void;
  onPrepareRental: () => void;
  onPrepareSettlement: (kind: Exclude<RentalTransactionKind, "start">) => void;
  onSignAndSendRental: () => void;
  onSelectItem: (item: RentalItem, hours?: number, note?: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onWalletReady: (address: string) => void;
  recommendations: RentalItem[];
  preparedTxKind: RentalTransactionKind | null;
  rentalActionStatus: RentalActionStatus;
  rentalHours: number;
  selectedItem: RentalItem;
  txSignature: string;
  txPreview: string;
  wallet: string;
}) {
  const [walletChooserOpen, setWalletChooserOpen] = useState(false);
  const { setVisible: setSolanaWalletVisible } = useWalletModal();

  return (
    <div className="w-full max-w-[620px] rounded-[34px] bg-white/72 p-3 shadow-[0_30px_100px_rgba(6,23,37,0.16)] ring-1 ring-white/80 backdrop-blur-2xl sm:rounded-[44px] sm:p-4">
      <form
        onSubmit={(event) => {
          setWalletChooserOpen(false);
          onSubmit(event);
        }}
        className="flex items-center gap-2 rounded-full border border-[#dfe5ee] bg-white/96 p-1.5 shadow-[0_16px_42px_rgba(6,23,37,0.09)]"
      >
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

      <div className="mt-3 flex items-center gap-3 px-2">
        <p className="min-w-0 truncate text-[12px] font-bold text-[#53697d] sm:text-[13px]">{agentLine}</p>
        <div className="relative ml-auto w-[148px] shrink-0 sm:w-[168px]">
          <WalletConnectButton
            chooserOpen={walletChooserOpen}
            crossmintConfigured={crossmintConfigured}
            onChooserOpenChange={setWalletChooserOpen}
            onCrossmintStart={onCrossmintStart}
            onWalletReady={onWalletReady}
            wallet={wallet}
          />
        </div>
      </div>

      {!hasSearched && !isSearching && (
        <div className="mt-3 flex flex-wrap gap-2 px-1">
          {["charger 3h", "camera for demo", "mic for recording"].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                onInputChange(prompt);
                inputRef.current?.focus();
              }}
              className="rounded-full bg-white/70 px-3 py-1.5 text-[12px] font-black text-[#53697d] ring-1 ring-[#e5ebf1] transition hover:bg-[#c8ff18] hover:text-[#061725]"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {isSearching && <SearchingPanel />}

      {hasSearched && (
        <div className="tably-results-enter pt-3">
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
                onClick={() => onSelectItem(item, item.expectedHours, `${item.name} selected. ${wallet ? "Ready to prepare rental." : "Connect wallet to prepare rental."}`)}
              />
            ))}
          </div>
          <SelectedRentalPanel
            activeRental={activeRental}
            canSignRental={canSignRental}
            expectedFee={expectedFee}
            onPrepareRental={onPrepareRental}
            onPrepareSettlement={onPrepareSettlement}
            onRequestSolanaSigner={() => setSolanaWalletVisible(true)}
            onRequestWalletConnect={() => setWalletChooserOpen(true)}
            onSignAndSendRental={onSignAndSendRental}
            preparedTxKind={preparedTxKind}
            rentalActionStatus={rentalActionStatus}
            rentalHours={rentalHours}
            selectedItem={selectedItem}
            txSignature={txSignature}
            txPreview={txPreview}
            wallet={wallet}
          />
        </div>
      )}
    </div>
  );
}

function SelectedRentalPanel({
  activeRental,
  canSignRental,
  expectedFee,
  onPrepareRental,
  onPrepareSettlement,
  onRequestSolanaSigner,
  onRequestWalletConnect,
  onSignAndSendRental,
  preparedTxKind,
  rentalActionStatus,
  rentalHours,
  selectedItem,
  txSignature,
  txPreview,
  wallet,
}: {
  activeRental: ActiveRental | null;
  canSignRental: boolean;
  expectedFee: number;
  onPrepareRental: () => void;
  onPrepareSettlement: (kind: Exclude<RentalTransactionKind, "start">) => void;
  onRequestSolanaSigner: () => void;
  onRequestWalletConnect: () => void;
  onSignAndSendRental: () => void;
  preparedTxKind: RentalTransactionKind | null;
  rentalActionStatus: RentalActionStatus;
  rentalHours: number;
  selectedItem: RentalItem;
  txSignature: string;
  txPreview: string;
  wallet: string;
}) {
  const explorerUrl = txSignature ? `https://explorer.solana.com/tx/${txSignature}?cluster=devnet` : "";
  const buttonLabel = !wallet && !canSignRental
    ? "Connect wallet first"
    : rentalActionStatus === "preparing"
      ? "Preparing..."
      : rentalActionStatus === "signing"
        ? "Signing..."
        : rentalActionStatus === "sent"
          ? "View transaction"
      : rentalActionStatus === "ready"
        ? canSignRental
          ? `Sign ${transactionKindLabel(preparedTxKind)}`
          : "Connect matching wallet"
        : activeRental
          ? "Prepare return"
          : "Prepare rental";

  function handlePrimaryAction() {
    if (!wallet && !canSignRental) {
      onRequestWalletConnect();
      return;
    }
    if (rentalActionStatus === "sent" && explorerUrl) {
      window.open(explorerUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (rentalActionStatus === "ready") {
      if (canSignRental) {
        onSignAndSendRental();
      } else {
        onRequestSolanaSigner();
      }
      return;
    }
    if (activeRental && !preparedTxKind) {
      onPrepareSettlement("return");
      return;
    }
    onPrepareRental();
  }

  return (
    <div className="tably-results-enter mt-3 rounded-[22px] border border-[#e8edf2] bg-white/82 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-black text-[#061725]">{selectedItem.name}</p>
          <p className="mt-1 truncate text-[11px] font-bold text-[#607489]">
            {selectedItem.locationLabel} / {selectedItem.ownerScore}% trust
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] font-black text-[#061725]">${expectedFee}</p>
          <p className="text-[10px] font-bold text-[#607489]">{rentalHours}h fee</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-[16px] border border-[#edf1f5] text-center">
        <div className="border-r border-[#edf1f5] bg-[#f8fafb] px-2 py-2">
          <p className="text-[12px] font-black text-[#061725]">${selectedItem.buyoutCap}</p>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#607489]">Escrow</p>
        </div>
        <div className="border-r border-[#edf1f5] bg-white px-2 py-2">
          <p className="text-[12px] font-black text-[#061725]">${Math.max(0, selectedItem.buyoutCap - expectedFee)}</p>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#607489]">Refund</p>
        </div>
        <div className="bg-[#f8fafb] px-2 py-2">
          <p className="text-[12px] font-black text-[#061725]">{selectedItem.returnedOkCount}</p>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#607489]">Returns</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handlePrimaryAction}
        disabled={rentalActionStatus === "preparing" || rentalActionStatus === "signing"}
        className="mt-3 min-h-[42px] w-full rounded-full bg-[#061725] px-4 text-[13px] font-black text-white transition hover:bg-[#c8ff18] hover:text-[#061725] disabled:cursor-default disabled:bg-[#c8ff18] disabled:text-[#061725]"
      >
        {buttonLabel}
      </button>

      {activeRental && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPrepareSettlement("return")}
            disabled={rentalActionStatus === "preparing" || rentalActionStatus === "signing"}
            className="min-h-[36px] rounded-full border border-[#dfe7ef] bg-white px-3 text-[11px] font-black text-[#061725] transition hover:border-[#c8ff18] hover:bg-[#f7fbef] disabled:opacity-50"
          >
            Confirm return
          </button>
          <button
            type="button"
            onClick={() => onPrepareSettlement("buyout")}
            disabled={rentalActionStatus === "preparing" || rentalActionStatus === "signing"}
            className="min-h-[36px] rounded-full border border-[#dfe7ef] bg-white px-3 text-[11px] font-black text-[#061725] transition hover:border-[#ff7867] hover:bg-[#fff5f2] disabled:opacity-50"
          >
            Auto-buyout
          </button>
        </div>
      )}

      {(txPreview || rentalActionStatus === "error") && (
        <p className={`mt-2 truncate text-[11px] font-bold ${rentalActionStatus === "error" ? "text-[#ff4c36]" : "text-[#607489]"}`}>
          {rentalActionStatus === "error" ? "Transaction failed." : `Tx ${txPreview}`}
        </p>
      )}
    </div>
  );
}

function SearchingPanel() {
  return (
    <div className="tably-results-enter mt-3 rounded-[22px] border border-[#e8edf2] bg-white/72 p-3">
      <div className="flex items-center gap-2 text-[12px] font-black text-[#53697d]">
        <span className="h-2 w-2 rounded-full bg-[#c8ff18] shadow-[0_0_0_6px_rgba(200,255,24,0.22)]" />
        Searching community inventory
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="rounded-[16px] bg-[#f3f6f8] p-2">
            <div className="h-16 rounded-[12px] bg-white/80" />
            <div className="mt-2 h-3 rounded-full bg-white/80" />
            <div className="mt-1 h-3 w-2/3 rounded-full bg-white/70" />
          </div>
        ))}
      </div>
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

function WalletConnectButton({
  chooserOpen,
  crossmintConfigured,
  onChooserOpenChange,
  onCrossmintStart,
  onWalletReady,
  wallet: externalWallet,
}: {
  chooserOpen: boolean;
  crossmintConfigured: boolean;
  onChooserOpenChange: (open: boolean) => void;
  onCrossmintStart: () => void;
  onWalletReady: (address: string) => void;
  wallet: string;
}) {
  const { login, status: authStatus } = useCrossmintAuth();
  const { wallet: crossmintWallet, status: walletStatus } = useWallet();
  const { connected, connecting, publicKey } = useSolanaWallet();
  const { setVisible } = useWalletModal();
  const solanaAddress = publicKey?.toBase58();

  useEffect(() => {
    if (crossmintWallet?.address) {
      onWalletReady(crossmintWallet.address);
    }
  }, [crossmintWallet?.address, onWalletReady]);

  useEffect(() => {
    if (connected && solanaAddress) {
      onWalletReady(solanaAddress);
    }
  }, [connected, onWalletReady, solanaAddress]);

  const isBusy = authStatus === "in-progress" || walletStatus === "in-progress";
  const connectedWallet = externalWallet || crossmintWallet?.address || solanaAddress || "";
  const label = isBusy || connecting ? "Connecting..." : connectedWallet ? `Wallet ${shortKey(connectedWallet)}` : "Connect wallet";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (connectedWallet) return;
          onChooserOpenChange(!chooserOpen);
        }}
        disabled={isBusy || connecting}
        className={`min-h-[36px] w-full rounded-full px-3 text-[12px] font-black transition disabled:opacity-50 sm:min-h-[38px] ${
          connectedWallet ? "bg-[#c8ff18] text-[#061725]" : "bg-[#061725] text-white hover:bg-[#c8ff18] hover:text-[#061725]"
        }`}
      >
        {label}
      </button>

      {chooserOpen && !connectedWallet && (
        <div className="absolute left-1/2 top-[calc(100%+8px)] z-30 grid w-full max-w-[360px] -translate-x-1/2 gap-2 rounded-[24px] border border-[#e4eaf0] bg-white/96 p-2 shadow-[0_22px_60px_rgba(6,23,37,0.16)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => {
              onCrossmintStart();
              if (crossmintConfigured) login();
              onChooserOpenChange(false);
            }}
            className="rounded-[18px] bg-[#061725] px-4 py-3 text-left text-[13px] font-black text-white transition hover:bg-[#c8ff18] hover:text-[#061725]"
          >
            Crossmint
            <span className="mt-1 block text-[11px] font-bold opacity-70">Email or social wallet</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setVisible(true);
              onChooserOpenChange(false);
            }}
            className="rounded-[18px] border border-[#dfe7ef] bg-white px-4 py-3 text-left text-[13px] font-black text-[#061725] transition hover:border-[#6b4cff]"
          >
            Solana wallet
            <span className="mt-1 block text-[11px] font-bold text-[#607489]">Phantom, Backpack, Solflare</span>
          </button>
        </div>
      )}
    </>
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

function transactionKindLabel(kind: RentalTransactionKind | null) {
  if (kind === "return") return "return";
  if (kind === "buyout") return "buyout";
  return "rental";
}

async function sendWithSolanaAdapter(
  preparedTx: PreparedRentalTransaction,
  connection: Connection,
  sendTransaction: SolanaSendTransaction
) {
  const transaction = Transaction.from(base64ToUint8Array(preparedTx.transactionBase64));
  return sendTransaction(transaction, connection);
}

async function sendWithCrossmintWallet(preparedTx: PreparedRentalTransaction, wallet: CrossmintWalletInstance | undefined) {
  if (!wallet) throw new Error("Crossmint wallet is not loaded.");
  const solanaWallet = SolanaWallet.from(wallet);
  const result = await solanaWallet.sendTransaction({ serializedTransaction: preparedTx.transactionBase64 });
  if (!result.hash) throw new Error("Crossmint did not return a transaction hash.");
  return result.hash;
}

function canSignPreparedRental(preparedTx: PreparedRentalTransaction | null, solanaSigner: string, crossmintSigner: string) {
  if (!preparedTx) return Boolean(solanaSigner || crossmintSigner);
  return preparedTx.requiredSigner === solanaSigner || preparedTx.requiredSigner === crossmintSigner;
}

function base64ToUint8Array(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
