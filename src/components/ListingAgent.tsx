"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/lib/types";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

interface ListingAgentProps {
  onDone: () => void;
}

interface AgentState {
  step: number;
  category: string;
  itemName: string;
  brand: string;
  model: string;
  condition: number;
  description: string;
}

const STEPS = [
  { key: "category", question: "What kind of item are you listing?", options: ["Sports", "Tools", "Electronics", "Kitchen", "Luxury", "Other"] },
  { key: "itemName", question: "What's the item called?" },
  { key: "brand", question: "What brand is it?" },
  { key: "model", question: "What's the specific model?" },
  { key: "condition", question: "On a scale of 1-10, what condition is it in?", options: ["10 — Like new", "8 — Great", "7 — Good", "5 — Fair", "3 — Rough"] },
  { key: "description", question: "Describe it briefly — any scratches, what's included, etc." },
];

function suggestPrice(state: AgentState): { daily: number; retail: number } {
  const conditionMultiplier = state.condition / 10;
  const categoryPrices: Record<string, { daily: number; retail: number }> = {
    Sports: { daily: 18, retail: 1200 },
    Tools: { daily: 8, retail: 200 },
    Electronics: { daily: 35, retail: 1500 },
    Kitchen: { daily: 10, retail: 400 },
    Luxury: { daily: 40, retail: 2000 },
    Other: { daily: 15, retail: 500 },
  };
  const base = categoryPrices[state.category] || categoryPrices.Other;
  return {
    daily: Math.round(base.daily * conditionMultiplier),
    retail: Math.round(base.retail),
  };
}

export function ListingAgent({ onDone }: ListingAgentProps) {
  const { connected } = useWallet();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "agent", content: "Hey! I'm your RentChain listing agent. I'll help you list your item for rent in about 60 seconds. Let's get started." },
    { role: "agent", content: STEPS[0].question, options: STEPS[0].options },
  ]);
  const [state, setState] = useState<AgentState>({
    step: 0,
    category: "",
    itemName: "",
    brand: "",
    model: "",
    condition: 0,
    description: "",
  });
  const [input, setInput] = useState("");
  const [minting, setMinting] = useState(false);
  const [minted, setMinted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(text?: string) {
    const userText = text || input;
    if (!userText.trim()) return;
    setInput("");

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userText }];
    const newState = { ...state };
    const currentStep = STEPS[state.step];

    // Parse response into state
    switch (currentStep.key) {
      case "category":
        newState.category = userText.replace(/^\d+\s*[—-]\s*/, "");
        break;
      case "itemName":
        newState.itemName = userText;
        break;
      case "brand":
        newState.brand = userText;
        break;
      case "model":
        newState.model = userText;
        break;
      case "condition":
        const num = parseInt(userText);
        newState.condition = isNaN(num) ? 7 : Math.min(10, Math.max(1, num));
        break;
      case "description":
        newState.description = userText;
        break;
    }

    const nextStep = state.step + 1;
    newState.step = nextStep;

    if (nextStep < STEPS.length) {
      // Ask next question
      const next = STEPS[nextStep];
      newMessages.push({ role: "agent", content: next.question, options: next.options });
    } else {
      // All info collected — suggest pricing
      const price = suggestPrice(newState);
      newMessages.push({
        role: "agent",
        content: `Here's what I've got:\n\n**${newState.itemName}**\n${newState.brand} ${newState.model}\nCondition: ${newState.condition}/10\n"${newState.description}"\n\nBased on market data, I'd recommend:\n- **$${price.daily}/day** rental rate\n- **$${price.retail}** retail backstop (what renter pays if they don't return it)\n\nReady to mint this on Solana and go live?`,
        options: ["Mint it!", "Adjust price", "Start over"],
      });
    }

    setMessages(newMessages);
    setState(newState);
  }

  async function handleMint() {
    setMinting(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Mint it!" },
      { role: "agent", content: "Minting your item on Solana..." },
    ]);

    await new Promise((r) => setTimeout(r, 2500));

    const mintSeed = `${state.category}-${state.itemName}-${state.brand}-${state.model}`.toLowerCase();
    const mintId = Array.from(mintSeed).reduce((sum, char) => sum + char.charCodeAt(0), 0).toString(36);
    const fakeMint = `rent_${mintId.padStart(6, "0")}...demo`;
    setMessages((prev) => [
      ...prev,
      {
        role: "agent",
        content: `Your item is live!\n\n**${state.itemName}** has been tokenized on Solana.\n\nMint address: \`${fakeMint}\`\nStatus: Available for rent\n\nBuyers can now find and rent your item on the marketplace.`,
        options: ["View marketplace", "List another item"],
      },
    ]);
    setMinting(false);
    setMinted(true);
  }

  function handleOptionClick(option: string) {
    if (option === "Mint it!") {
      handleMint();
    } else if (option === "View marketplace") {
      onDone();
    } else if (option === "Start over") {
      setState({ step: 0, category: "", itemName: "", brand: "", model: "", condition: 0, description: "" });
      setMessages([
        { role: "agent", content: "No problem, let's start fresh!" },
        { role: "agent", content: STEPS[0].question, options: STEPS[0].options },
      ]);
    } else if (option === "List another item") {
      setState({ step: 0, category: "", itemName: "", brand: "", model: "", condition: 0, description: "" });
      setMessages([
        { role: "agent", content: "Let's list another one!" },
        { role: "agent", content: STEPS[0].question, options: STEPS[0].options },
      ]);
      setMinted(false);
    } else if (option === "Adjust price") {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: "Adjust price" },
        { role: "agent", content: "What daily rate would you like? (just type a number)" },
      ]);
    } else {
      handleSend(option);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-purple-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold">Listing Agent</h2>
          <p className="text-sm text-gray-500">List your item in 60 seconds</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, (state.step / STEPS.length) * 100)}%` }}
        />
      </div>

      {/* Chat messages */}
      <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto pr-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === "agent" ? "chat-bubble-agent" : "chat-bubble-user"
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.options && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {msg.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleOptionClick(opt)}
                      disabled={minting}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-green-500/50 transition-all disabled:opacity-50"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {minting && (
          <div className="flex justify-start">
            <div className="chat-bubble-agent rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-green-400">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Minting on Solana...
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      {!minted && state.step < STEPS.length + 1 && (
        <div className="flex gap-2">
          {!connected ? (
            <div className="flex-1 flex justify-center">
              <WalletMultiButton className="!bg-purple-600 !rounded-xl !h-12" />
            </div>
          ) : (
            <>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type your answer..."
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 transition-colors"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="px-4 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-medium transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
