import { NextRequest, NextResponse } from "next/server";
import { getItem } from "@/lib/store";

export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get("draftId") ?? "draft_power_bank_18";
  return NextResponse.json({
    label: "Tably RentProof",
    icon: "/globe.svg",
    title: "Start rental",
    description: `Approve RentProof rental request ${draftId}`,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const item = getItem(body.itemId ?? "power_bank_18");

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const draftId = `draft_${item.id}`;
  const solanaPayUrl = `solana:https://rentproof.local/api/solana-pay/start-rental?draftId=${draftId}`;

  return NextResponse.json({
    draftId,
    solanaPayUrl,
    transactionPlan: [
      "start_rental",
      `lock_${item.buyoutCap}_usdc_escrow`,
      "create_rental_session",
      "mint_non_transferable_rental_token",
    ],
    item: {
      id: item.id,
      name: item.name,
      escrowAmount: item.buyoutCap,
      expectedHours: body.hours ?? item.expectedHours,
      renterWallet: body.renterWallet ?? "crossmint_embedded_wallet",
    },
  });
}
