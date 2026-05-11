import { NextRequest, NextResponse } from "next/server";
import { getRentableItem } from "@/lib/rentableItems";
import { buildSettleRentalTransaction, deriveRentProofAccounts } from "@/lib/rentproofProgram";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const item = await getRentableItem(body.itemId ?? "power_bank_18");

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (!body.renterWallet) {
    return NextResponse.json({ error: "Missing renter wallet" }, { status: 400 });
  }
  if (!body.rentalId && !body.draftId) {
    return NextResponse.json({ error: "Missing rental id" }, { status: 400 });
  }

  const rentalId = body.rentalId ?? body.draftId;
  const rentProof = deriveRentProofAccounts({
    itemId: item.id,
    ownerWallet: body.ownerWallet ?? item.owner,
    renterWallet: body.renterWallet,
    rentalId,
  });
  const serialized = await buildSettleRentalTransaction({
    kind: "confirm_return",
    itemId: item.id,
    ownerWallet: body.ownerWallet ?? item.owner,
    renterWallet: body.renterWallet,
    rentalId,
  });

  return NextResponse.json({
    rentalId,
    rentProof,
    programStatus: "devnet_program_deployed_unsigned_transaction_serialized",
    transaction: serialized.transactionBase64,
    message: `Confirm return for ${item.name}. Owner signs to burn/close rental token state, settle platform fee, owner payout, and renter refund.`,
    transactionMetadata: {
      cluster: serialized.cluster,
      rpcUrl: serialized.rpcUrl,
      blockhash: serialized.blockhash,
      lastValidBlockHeight: serialized.lastValidBlockHeight,
      feePayer: serialized.rentProof.accounts.owner,
      requiredSigner: serialized.rentProof.accounts.owner,
    },
    transactionPlan: [
      "confirm_return",
      "settle_metered_fee",
      "pay_owner_and_platform",
      "refund_renter",
      "close_escrow_and_rental_token",
      "emit_rental_returned_receipt",
    ],
    instructionArgs: {
      confirmReturn: {
        rentalIdHash: rentProof.rentalIdHash,
      },
    },
    item: {
      id: item.id,
      name: item.name,
      renterWallet: body.renterWallet,
    },
  });
}
