import { NextRequest, NextResponse } from "next/server";
import { getPayments } from "@/lib/payments";
import { executeReturn, RentFlowError } from "@/lib/rentflow";
import { getStore } from "@/lib/store";
import { getAuthContext } from "@/lib/supabase/server";
import { asStr, readJson } from "@/lib/validate";

const ERROR_STATUS: Record<string, number> = {
  payment_not_configured: 503,
  card_not_linked: 402,
  item_not_found: 404,
  rental_not_found: 404,
  rental_not_active: 409,
  charge_failed: 402,
  forbidden: 403,
};

// POST /api/return — return an item; charges Redbox overage if late.
// Only the renter who holds the rental may return it.
export async function POST(req: NextRequest) {
  const { user } = await getAuthContext();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to return items" },
      { status: 401 }
    );
  }

  const body = await readJson(req);
  const rentalId = body ? asStr(body.rentalId, { max: 64 }) : null;
  if (!rentalId) {
    return NextResponse.json(
      { error: "invalid_input", message: "rentalId is required" },
      { status: 400 }
    );
  }

  try {
    const result = await executeReturn(
      { store: getStore(), payments: getPayments() },
      { rentalId, requester: user }
    );
    return NextResponse.json({ ...result, message: "Item returned" });
  } catch (e) {
    if (e instanceof RentFlowError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: ERROR_STATUS[e.code] ?? 500 }
      );
    }
    console.error("return failed:", e);
    return NextResponse.json(
      { error: "internal_error", message: "Return failed" },
      { status: 500 }
    );
  }
}
