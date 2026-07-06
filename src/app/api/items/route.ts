import { NextResponse } from "next/server";
import { createStore } from "@/lib/store";
import { createServerSupabase } from "@/lib/supabase/server";

// GET /api/items — public catalog, read through the anon/RLS client.
export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const items = await createStore(supabase).getItems();
    return NextResponse.json({ items });
  } catch (e) {
    console.error("items failed:", e);
    return NextResponse.json(
      { error: "internal_error", message: "Could not load items" },
      { status: 500 }
    );
  }
}
