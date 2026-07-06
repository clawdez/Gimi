import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  try {
    const items = await getStore().getItems();
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
