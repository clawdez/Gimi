import { NextRequest, NextResponse } from "next/server";
import { getRentalIntentsRepository } from "@/lib/rentalIntentsRepository";

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
  if (action !== "mark_handed_off") return errorResponse("action must be mark_handed_off", 400);

  try {
    const repository = getRentalIntentsRepository();
    const intent = await repository.getById(intentId);
    if (!intent) return errorResponse("Rental intent not found", 404);
    if (intent.ownerWallet !== ownerWallet) return errorResponse("Only the owner wallet can activate this reservation", 403);
    if (intent.paymentMethod !== "card") return errorResponse("Only card reservations use this activation path", 400);
    if (intent.paymentStatus !== "confirmed") return errorResponse("Card payment must be confirmed before handoff", 409, { intent });
    if (intent.escrowStatus !== "provider_authorized" && intent.escrowStatus !== "provider_captured") {
      return errorResponse("Card escrow must be authorized or captured before handoff", 409, { intent });
    }
    if (intent.sessionStatus === "cancelled") return errorResponse("Cancelled reservations cannot be activated", 409, { intent });

    const updatedIntent = await repository.save({
      ...intent,
      sessionStatus: "active",
      receiptStatus: "pending_onchain",
      notes: "Owner marked physical handoff complete for card-funded rental.",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      intent: updatedIntent,
      nextAction: "track_return_and_settle_card_rental",
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to update rental intent", 400);
  }
}
