import { NextRequest, NextResponse } from "next/server";
import { isEvmAddress } from "@/lib/baseMcp";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();

  if (!wallet || !isEvmAddress(wallet)) {
    return NextResponse.json({ error: "wallet must be a 0x-prefixed EVM address" }, { status: 400 });
  }

  return NextResponse.json({
    wallet,
    rentals: [],
    receipts: [],
    status:
      "Base MCP status is prepared for agent UX. Persisted Base-funded rental intents need the next PR to add base_wallet payment_method and webhook/indexer settlement sync.",
    supportedNow: ["inventory", "quote", "prepare_deposit_call"],
    next: ["persist Base rental intent", "Base escrow contract", "return settlement", "receipt issuance"],
  });
}
