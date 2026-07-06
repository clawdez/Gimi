import { NextRequest, NextResponse } from "next/server";
import { getPayments } from "@/lib/payments";

// POST /api/card/setup — start the "Link your card" step (Stripe SetupIntent).
export async function POST(req: NextRequest) {
  const { renterEmail } = await req.json();
  if (!renterEmail) {
    return NextResponse.json({ error: "Missing renterEmail" }, { status: 400 });
  }

  const payments = getPayments();
  if (!payments) {
    return NextResponse.json(
      { configured: false, error: "payment_not_configured" },
      { status: 503 }
    );
  }

  try {
    const { clientSecret, customerId } = await payments.createCardSetupIntent(renterEmail);
    return NextResponse.json({ configured: true, clientSecret, customerId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
