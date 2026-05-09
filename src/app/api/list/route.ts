import { NextRequest, NextResponse } from "next/server";

// POST /api/list — create a new listing (would mint on-chain in production)
export async function POST(req: NextRequest) {
  const body = await req.json();

  const { name, brand, model, condition, description, category, dailyRate, retailPrice } = body;

  if (!name || !brand || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // In production: mint NFT on Solana, store metadata on Arweave
  const listing = {
    id: crypto.randomUUID(),
    name,
    brand,
    model: model || "",
    condition: condition || 7,
    description: description || "",
    category,
    dailyRate: dailyRate || 15,
    retailPrice: retailPrice || 500,
    overageMultiplier: 1.5,
    status: "available",
    imageUrl: "https://images.unsplash.com/photo-1560472355-536de3962603?w=400&h=300&fit=crop",
    trustScore: 50, // new user starts at 50
    createdAt: Date.now(),
    // Would include: mintAddress, ownerWallet, arweaveUri
    mintAddress: `mock_${crypto.randomUUID().substring(0, 8)}`,
  };

  return NextResponse.json({ listing, message: "Item listed successfully" });
}
