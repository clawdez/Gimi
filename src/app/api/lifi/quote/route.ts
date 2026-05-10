import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const amount = Number(body.amount ?? 30);

  return NextResponse.json({
    route: {
      provider: "LI.FI demo route",
      from: `${body.sourceChain ?? "base"}:${body.sourceToken ?? "USDC"}`,
      to: `${body.targetChain ?? "solana"}:${body.targetToken ?? "USDC"}`,
      inputAmount: amount,
      estimatedOutput: Number((amount - 0.08).toFixed(2)),
      estimatedFee: 0.08,
      estimatedTimeSeconds: 52,
      status: "quoted",
    },
  });
}
