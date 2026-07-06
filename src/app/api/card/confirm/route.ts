import { NextRequest, NextResponse } from "next/server";
import { getPayments } from "@/lib/payments";
import { getAuthContext } from "@/lib/supabase/server";
import { asStr, readJson } from "@/lib/validate";

// POST /api/card/confirm — finalize a card link after the SetupIntent succeeds.
export async function POST(req: NextRequest) {
  const { user } = await getAuthContext();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to link a card" },
      { status: 401 }
    );
  }

  const body = await readJson(req);
  const setupIntentId = body ? asStr(body.setupIntentId, { max: 128 }) : null;
  if (!setupIntentId) {
    return NextResponse.json(
      { error: "invalid_input", message: "setupIntentId is required" },
      { status: 400 }
    );
  }

  const payments = getPayments();
  if (!payments) {
    return NextResponse.json(
      { configured: false, error: "payment_not_configured" },
      { status: 503 }
    );
  }

  try {
    const card = await payments.finalizeCardLink(setupIntentId);
    return NextResponse.json({ card });
  } catch (e) {
    console.error("card confirm failed:", e);
    return NextResponse.json(
      { error: "internal_error", message: "Card link failed" },
      { status: 500 }
    );
  }
}
