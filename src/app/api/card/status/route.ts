import { NextRequest, NextResponse } from "next/server";
import { getPayments, isStripeConfigured } from "@/lib/payments";

// GET /api/card/status?email= — whether payments are configured and a card is linked.
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!isStripeConfigured()) {
    return NextResponse.json({ configured: false, linked: false });
  }
  if (!email) {
    return NextResponse.json({ configured: true, linked: false });
  }
  try {
    const card = await getPayments()!.getLinkedCard(email);
    return NextResponse.json({
      configured: true,
      linked: Boolean(card),
      card: card ? { brand: card.brand, last4: card.last4 } : null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
