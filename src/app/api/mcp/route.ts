import { NextRequest, NextResponse } from "next/server";
import { getItem, getItems } from "@/lib/store";

const tools = [
  "rentproof.find_offers",
  "rentproof.draft_terms",
  "rentproof.quote_funding",
  "rentproof.create_rental_request",
  "rentproof.get_session",
  "rentproof.request_return",
  "rentproof.get_receipt",
];

export async function GET() {
  return NextResponse.json({
    name: "rentproof-mcp",
    mode: "read_prepare_only",
    safety: "MCP never signs transactions, custodies keys, or moves funds.",
    tools,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const tool = body.tool as string;

  if (!tools.includes(tool)) {
    return NextResponse.json({ error: "Unknown tool", tools }, { status: 400 });
  }

  if (tool === "rentproof.find_offers") {
    return NextResponse.json({
      offers: getItems().map((item) => ({
        itemId: item.id,
        name: item.name,
        ratePerHour: item.ratePerHour,
        buyoutCap: item.buyoutCap,
        ownerScore: item.ownerScore,
        locationLabel: item.locationLabel,
      })),
    });
  }

  if (tool === "rentproof.draft_terms") {
    const item = getItem(body.itemId ?? "power_bank_18") ?? getItems()[0];
    const hours = Number(body.hours ?? item.expectedHours);
    return NextResponse.json({
      draft: {
        itemId: item.id,
        expectedFee: Math.max(item.minimumFee, hours * item.ratePerHour),
        refundableEscrow: item.buyoutCap,
        sourceChain: body.sourceChain ?? "base",
        targetChain: "solana",
        riskSummary: "Low-value item, full buyout cap escrow, owner score above threshold.",
      },
    });
  }

  return NextResponse.json({
    result: {
      tool,
      status: "prepared",
      nextAction: "Wallet approval required before any irreversible transaction.",
    },
  });
}
