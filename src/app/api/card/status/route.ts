import { NextResponse } from "next/server";
import { getPayments, isStripeConfigured } from "@/lib/payments";
import { getAuthContext } from "@/lib/supabase/server";

// GET /api/card/status — whether payments are configured and the signed-in
// user has a linked card. Email comes from the session, not a query param.
export async function GET() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ configured: false, linked: false });
  }

  const { user } = await getAuthContext();
  if (!user) {
    return NextResponse.json({ configured: true, linked: false });
  }

  try {
    const card = await getPayments()!.getLinkedCard(user.email);
    return NextResponse.json({
      configured: true,
      linked: Boolean(card),
      card: card ? { brand: card.brand, last4: card.last4 } : null,
    });
  } catch (e) {
    console.error("card status failed:", e);
    return NextResponse.json(
      { error: "internal_error", message: "Card status unavailable" },
      { status: 500 }
    );
  }
}
