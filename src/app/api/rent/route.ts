import { NextRequest, NextResponse } from "next/server";
import { getPayments } from "@/lib/payments";
import { getReceiptMinter } from "@/lib/receipts";
import { executeRent, RentFlowError } from "@/lib/rentflow";
import { getStore } from "@/lib/store";

const ERROR_STATUS: Record<string, number> = {
  payment_not_configured: 503,
  card_not_linked: 402,
  item_not_found: 404,
  item_not_available: 409,
  charge_failed: 402,
};

// POST /api/rent — Redbox flow: charge the saved card (Stripe TEST mode),
// persist the rental, mint a Solana devnet memo receipt.
export async function POST(req: NextRequest) {
  const { itemId, renterEmail, rentalDays } = await req.json();

  if (!itemId || !renterEmail || !rentalDays || rentalDays < 1) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const result = await executeRent(
      { store: getStore(), payments: getPayments(), minter: getReceiptMinter() },
      { itemId, renterEmail, rentalDays: Number(rentalDays) }
    );
    return NextResponse.json({ ...result, message: "Rental confirmed" });
  } catch (e) {
    if (e instanceof RentFlowError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: ERROR_STATUS[e.code] ?? 500 }
      );
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
