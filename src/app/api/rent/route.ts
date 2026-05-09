import { NextRequest, NextResponse } from "next/server";

// POST /api/rent — rent an item (would interact with escrow contract in production)
export async function POST(req: NextRequest) {
  const body = await req.json();

  const { itemId, renterWallet, rentalDays } = body;

  if (!itemId || !renterWallet || !rentalDays) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // In production: call Solana program to transfer funds to escrow
  const rental = {
    id: crypto.randomUUID(),
    itemId,
    renter: renterWallet,
    rentalDays,
    rentalStart: Date.now(),
    status: "active",
    // Would include: escrowAddress, transactionSignature
    txSignature: `mock_${crypto.randomUUID().substring(0, 12)}`,
  };

  return NextResponse.json({ rental, message: "Item rented successfully" });
}
