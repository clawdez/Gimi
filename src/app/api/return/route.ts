import { NextRequest, NextResponse } from "next/server";
import { getPayments } from "@/lib/payments";
import { executeReturn, RentFlowError } from "@/lib/rentflow";
import { getStore } from "@/lib/store";

const ERROR_STATUS: Record<string, number> = {
  payment_not_configured: 503,
  card_not_linked: 402,
  item_not_found: 404,
  rental_not_found: 404,
  rental_not_active: 409,
  charge_failed: 402,
};

// POST /api/return — return an item; charges Redbox overage if late.
export async function POST(req: NextRequest) {
  const { rentalId } = await req.json();
  if (!rentalId) {
    return NextResponse.json({ error: "Missing rentalId" }, { status: 400 });
  }

  try {
    const result = await executeReturn({ store: getStore(), payments: getPayments() }, { rentalId });
    return NextResponse.json({ ...result, message: "Item returned" });
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
