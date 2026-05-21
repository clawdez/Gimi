import { NextRequest, NextResponse } from "next/server";
import { getRentalIntentsRepository } from "@/lib/rentalIntentsRepository";
import { getNotificationsRepository, newNotification } from "@/lib/notificationsRepository";

function errorResponse(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const intentId = typeof body.intentId === "string" ? body.intentId.trim() : "";
  const ownerWallet = typeof body.ownerWallet === "string" ? body.ownerWallet.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";

  if (!intentId) return errorResponse("intentId is required", 400);
  if (!ownerWallet || ownerWallet.length > 140) return errorResponse("ownerWallet is required", 400);
  if (action !== "confirm_card_return") return errorResponse("action must be confirm_card_return", 400);

  try {
    const repository = getRentalIntentsRepository();
    const intent = await repository.getById(intentId);
    if (!intent) return errorResponse("Rental intent not found", 404);
    if (intent.ownerWallet !== ownerWallet) return errorResponse("Only the owner wallet can settle this reservation", 403);
    if (intent.paymentMethod !== "card") return errorResponse("Only card reservations use this settlement path", 400);
    if (intent.paymentStatus !== "confirmed") return errorResponse("Card payment must be confirmed before settlement", 409, { intent });
    if (intent.sessionStatus !== "active") return errorResponse("Card rental must be active before return settlement", 409, { intent });

    const now = new Date().toISOString();
    const fee = money(Math.min(intent.depositAmount, Math.max(intent.rentAmount, meteredFee(intent, now))));
    const platformFee = money(Math.min(fee, intent.platformFeeEstimate || fee * 0.05));
    const ownerPayout = money(Math.max(0, fee - platformFee));
    const renterRefund = money(Math.max(0, intent.depositAmount - fee));

    const updatedIntent = await repository.save({
      ...intent,
      sessionStatus: "returned",
      receiptStatus: "pending_onchain",
      returnedAt: now,
      finalFee: fee,
      ownerPayout,
      platformFee,
      renterRefund,
      settlementStatus: "pending_provider",
      notes: "Owner confirmed card-funded return. Provider refund/payout and Solana receipt issuance are pending.",
      updatedAt: now,
    });
    if (updatedIntent.renterWallet) {
      await getNotificationsRepository().save(
        newNotification({
          wallet: updatedIntent.renterWallet,
          kind: "rental_returned",
          title: "Return confirmed",
          body: `${updatedIntent.itemName} return was recorded. Estimated refund: ${renterRefund} ${updatedIntent.currency}.`,
        })
      );
    }
    await getNotificationsRepository().save(
      newNotification({
        wallet: updatedIntent.ownerWallet,
        kind: "rental_returned",
        title: "Card rental settled",
        body: `${updatedIntent.itemName} return ledger is recorded. Host payout: ${ownerPayout} ${updatedIntent.currency}.`,
      })
    );

    return NextResponse.json({
      intent: updatedIntent,
      settlement: {
        finalFee: fee,
        ownerPayout,
        platformFee,
        renterRefund,
        settlementStatus: updatedIntent.settlementStatus,
      },
      nextAction: "provider_refund_payout_then_issue_solana_receipt",
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to settle card rental", 400);
  }
}

function meteredFee(intent: { activatedAt?: string; rentAmount: number; durationHours: number }, nowIso: string) {
  if (!intent.activatedAt) return intent.rentAmount;
  const elapsedMs = Math.max(0, Date.parse(nowIso) - Date.parse(intent.activatedAt));
  const elapsedHours = elapsedMs / 3_600_000;
  const plannedHours = Math.max(1, Number(intent.durationHours || 1));
  const hourlyRate = intent.rentAmount / plannedHours;
  return hourlyRate * Math.min(plannedHours, Math.max(elapsedHours, 1 / 60));
}

function money(value: number) {
  return Number(value.toFixed(2));
}
