import { NextRequest, NextResponse } from "next/server";
import { createStore } from "@/lib/store";
import { getAuthContext } from "@/lib/supabase/server";
import { asInt, asStr, readJson } from "@/lib/validate";

// POST /api/list — create a new listing owned by the signed-in user.
// Inserts through the RLS-scoped client so owner_id = auth.uid() is
// enforced by the database, not just this handler.
export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthContext();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to list items" },
      { status: 401 }
    );
  }

  const body = await readJson(req);
  if (!body) {
    return NextResponse.json(
      { error: "invalid_input", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const name = asStr(body.name, { max: 120 });
  const brand = asStr(body.brand, { max: 80 });
  const category = asStr(body.category, { max: 40 });
  if (!name || !brand || !category) {
    return NextResponse.json(
      { error: "invalid_input", message: "name, brand and category are required" },
      { status: 400 }
    );
  }

  const model = asStr(body.model, { max: 120, optional: true }) ?? "";
  const description = asStr(body.description, { max: 2000, optional: true }) ?? "";
  const condition = asInt(body.condition ?? 7, { min: 1, max: 10 });
  const dailyRate = asInt(body.dailyRate ?? 15, { min: 1, max: 10000 });
  const retailPrice = asInt(body.retailPrice ?? 500, { min: 1, max: 1000000 });
  if (condition === null || dailyRate === null || retailPrice === null) {
    return NextResponse.json(
      { error: "invalid_input", message: "condition (1-10), dailyRate and retailPrice must be valid numbers" },
      { status: 400 }
    );
  }

  try {
    const listing = await createStore(supabase).addItem({
      name,
      brand,
      model,
      condition,
      description,
      category,
      dailyRate,
      retailPrice,
      owner: user.email,
      ownerId: user.id,
    });
    return NextResponse.json({ listing, message: "Item listed successfully" });
  } catch (e) {
    console.error("list failed:", e);
    return NextResponse.json(
      { error: "internal_error", message: "Listing failed" },
      { status: 500 }
    );
  }
}
