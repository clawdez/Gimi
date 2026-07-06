import { NextResponse } from "next/server";
import { getPayments } from "@/lib/payments";
import { getAuthContext } from "@/lib/supabase/server";

// POST /api/card/setup — start the "Link your card" step (Stripe SetupIntent).
// Card is linked to the signed-in user's email, never a body-supplied one.
export async function POST() {
  const { user } = await getAuthContext();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to link a card" },
      { status: 401 }
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
    const { clientSecret, customerId } = await payments.createCardSetupIntent(user.email);
    return NextResponse.json({ configured: true, clientSecret, customerId });
  } catch (e) {
    console.error("card setup failed:", e);
    return NextResponse.json(
      { error: "internal_error", message: "Card setup failed" },
      { status: 500 }
    );
  }
}
