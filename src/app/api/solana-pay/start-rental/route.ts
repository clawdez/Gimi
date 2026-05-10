import { NextRequest, NextResponse } from "next/server";
import { getItem } from "@/lib/store";
import {
  AUTO_BUYOUT_GRACE_SECONDS,
  PLATFORM_FEE_BPS,
  deriveRentProofAccounts,
  ratePerSecondBaseUnits,
  usdcBaseUnits,
} from "@/lib/rentproofProgram";

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
  const hours = body.hours ?? item.expectedHours;
  const rentProof = deriveRentProofAccounts({
    itemId: item.id,
    ownerWallet: item.owner,
    renterWallet: body.renterWallet,
    rentalId: draftId,
  });

  return NextResponse.json({
    draftId,
    solanaPayUrl,
    rentProof,
    programStatus: "anchor_program_builds_transaction_plan_not_signed",
    transactionPlan: [
      "initialize_config_if_needed",
      "initialize_item_if_needed",
      "start_rental",
      `lock_${item.buyoutCap}_usdc_escrow`,
      "create_rental_session",
      "mint_program_owned_rental_token_pda",
    ],
    instructionArgs: {
      initializeConfig: {
        feeBps: PLATFORM_FEE_BPS,
      },
      initializeItem: {
        itemIdHash: rentProof.itemIdHash,
        metadataHash: rentProof.itemIdHash,
        ratePerSecond: ratePerSecondBaseUnits(item.ratePerHour),
        minimumFee: usdcBaseUnits(item.minimumFee),
        buyoutCap: usdcBaseUnits(item.buyoutCap),
        autoBuyoutGraceSeconds: AUTO_BUYOUT_GRACE_SECONDS,
      },
      startRental: {
        rentalIdHash: rentProof.rentalIdHash,
        rentalSeconds: Math.ceil(hours * 3600),
      },
    },
    item: {
      id: item.id,
      name: item.name,
      escrowAmount: item.buyoutCap,
      expectedHours: hours,
      renterWallet: body.renterWallet ?? "crossmint_embedded_wallet",
    },
  });
}
