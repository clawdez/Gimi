import { NextResponse } from "next/server";
import { createStore } from "@/lib/store";
import { getAuthContext } from "@/lib/supabase/server";

// GET /api/rentals — the signed-in user's rentals and receipts.
// Reads through the RLS-scoped client, so the database limits rows
// to rentals the caller is a party to.
export async function GET() {
  const { supabase, user } = await getAuthContext();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to view your rentals" },
      { status: 401 }
    );
  }

  try {
    const store = createStore(supabase);
    const [rentals, receipts] = await Promise.all([store.listRentals(), store.listReceipts()]);
    return NextResponse.json({ rentals, receipts });
  } catch (e) {
    console.error("rentals failed:", e);
    return NextResponse.json(
      { error: "internal_error", message: "Could not load rentals" },
      { status: 500 }
    );
  }
}
