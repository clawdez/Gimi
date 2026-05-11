import { NextResponse } from "next/server";
import { getRentableItems } from "@/lib/rentableItems";
import { getListingsRepository } from "@/lib/listingsRepository";

export async function GET() {
  const repository = getListingsRepository();
  const listings = await repository.listAvailable();
  const inventory = await getRentableItems();

  return NextResponse.json({
    listings,
    inventory,
    count: listings.length,
    storage: repository.storageKind,
  });
}
