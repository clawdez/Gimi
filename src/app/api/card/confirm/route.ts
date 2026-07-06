import { NextRequest, NextResponse } from "next/server";
import { getPayments } from "@/lib/payments";

// POST /api/card/confirm — finalize a card link after the SetupIntent succeeds.
export async function POST(req: NextRequest) {
  const { setupIntentId } = await req.json();
  if (!setupIntentId) {
    return NextResponse.json({ error: "Missing setupIntentId" }, { status: 400 });
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
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
