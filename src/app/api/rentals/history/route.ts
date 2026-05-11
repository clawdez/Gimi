import { NextRequest, NextResponse } from "next/server";
import { getRentableItem } from "@/lib/rentableItems";
import { getRentalReceiptsRepository, PersistedRentalReceipt } from "@/lib/rentalReceiptsRepository";
import { USDC_DECIMALS } from "@/lib/rentproofProgram";

const WALLET_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
const RENTAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;

function explorerUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function shortWallet(value: string) {
  if (value.length < 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeUsdcAmount(rawAmount: string) {
  const raw = BigInt(rawAmount);
  const divisor = BigInt(10) ** BigInt(USDC_DECIMALS);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  const fractionText = fraction.toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  const uiAmount = fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();

  return {
    raw: rawAmount,
    uiAmount,
    decimals: USDC_DECIMALS,
    symbol: "USDC",
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet")?.trim() ?? "";
  const rentalId = searchParams.get("rentalId")?.trim() ?? "";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  if (wallet && !WALLET_PATTERN.test(wallet)) {
    return errorResponse("wallet must be a Solana-style address", 400);
  }
  if (rentalId && !RENTAL_ID_PATTERN.test(rentalId)) {
    return errorResponse("rentalId contains unsupported characters", 400);
  }
  if (limitParam && (!Number.isFinite(limit) || Number(limit) < 1)) {
    return errorResponse("limit must be a positive number", 400);
  }

  try {
    const repository = getRentalReceiptsRepository();
    const receipts = await repository.listRecent({
      wallet: wallet || undefined,
      rentalId: rentalId || undefined,
      limit,
    });
    const records = await Promise.all(receipts.map(enrichReceipt));

    return NextResponse.json({
      receipts: records,
      count: records.length,
      storage: repository.storageKind,
      filters: {
        wallet: wallet || null,
        rentalId: rentalId || null,
      },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load rental history", 500);
  }
}

async function enrichReceipt(receipt: PersistedRentalReceipt) {
  const item = await getRentableItem(receipt.itemId);

  return {
    id: receipt.id,
    rentalId: receipt.rentalId,
    itemId: receipt.itemId,
    item: item
      ? {
          id: item.id,
          name: item.name,
          imageUrl: item.imageUrl,
          category: item.category,
          locationLabel: item.locationLabel,
          ownerScore: item.ownerScore,
          status: item.status,
        }
      : null,
    outcome: receipt.outcome,
    settlementSignature: receipt.settlementSignature,
    explorerUrl: explorerUrl(receipt.settlementSignature),
    grossFee: receipt.grossFee,
    platformFee: receipt.platformFee,
    ownerPayout: receipt.ownerPayout,
    renterRefund: receipt.renterRefund,
    amounts: {
      grossFee: normalizeUsdcAmount(receipt.grossFee),
      platformFee: normalizeUsdcAmount(receipt.platformFee),
      ownerPayout: normalizeUsdcAmount(receipt.ownerPayout),
      renterRefund: normalizeUsdcAmount(receipt.renterRefund),
    },
    ownerWallet: receipt.ownerWallet,
    renterWallet: receipt.renterWallet,
    ownerWalletShort: shortWallet(receipt.ownerWallet),
    renterWalletShort: shortWallet(receipt.renterWallet),
    paymentMint: receipt.paymentMint,
    rentalTokenStatus: receipt.rentalTokenStatus,
    createdAt: receipt.createdAt,
  };
}
