import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";

// POST /api/list — create a new listing, persisted to gimi.items.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, brand, model, condition, description, category, dailyRate, retailPrice, owner } = body;

  if (!name || !brand || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const listing = await getStore().addItem({
      name,
      brand,
      model,
      condition,
      description,
      category,
      dailyRate,
      retailPrice,
      owner,
    });
    return NextResponse.json({ listing, message: "Item listed successfully" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
