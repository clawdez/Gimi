import { NextRequest, NextResponse } from "next/server";
import { getPayments } from "@/lib/payments";
import { getReceiptMinter } from "@/lib/receipts";
import { executeRent, RentFlowError } from "@/lib/rentflow";
import { getStore } from "@/lib/store";
import { getAuthContext } from "@/lib/supabase/server";
import { asInt, asStr, readJson } from "@/lib/validate";

const ERROR_STATUS: Record<string, number> = {
  payment_not_configured: 503,
  card_not_linked: 402,
  item_not_found: 404,
  item_not_available: 409,
  charge_failed: 402,
  forbidden: 403,
};

// POST /api/rent — Redbox flow: charge the saved card (Stripe TEST mode),
// persist the rental, mint a Solana devnet memo receipt. Renter identity
// comes from the authenticated session, never from the request body.
export async function POST(req: NextRequest) {
  const { user } = await getAuthContext();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to rent items" },
      { status: 401 }
    );
  }

  const body = await readJson(req);
  const itemId = body ? asStr(body.itemId, { max: 64 }) : null;
  const rentalDays = body ? asInt(body.rentalDays, { min: 1, max: 30 }) : null;
  if (!itemId || rentalDays === null) {
    return NextResponse.json(
      { error: "invalid_input", message: "itemId and rentalDays (1-30) are required" },
      { status: 400 }
    );
  }

  try {
    const result = await executeRent(
      { store: getStore(), payments: getPayments(), minter: getReceiptMinter() },
      { itemId, renter: user, rentalDays }
    );
    return NextResponse.json({ ...result, message: "Rental confirmed" });
  } catch (e) {
    if (e instanceof RentFlowError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: ERROR_STATUS[e.code] ?? 500 }
      );
    }
    console.error("rent failed:", e);
    return NextResponse.json(
      { error: "internal_error", message: "Rental failed" },
      { status: 500 }
    );
  }
}
