import { NextRequest, NextResponse } from "next/server";
import {
  moonPayStatusToIntent,
  parseMoonPayWebhook,
  verifyMoonPayWebhook,
} from "@/lib/moonpayCommerce";
import { getRentalIntentsRepository } from "@/lib/rentalIntentsRepository";

function errorResponse(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const verification = await verifyMoonPayWebhook(req, rawBody);
  if (!verification.ok) {
    return errorResponse("Invalid MoonPay webhook signature", 401, { verificationMode: verification.mode });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  try {
    const event = parseMoonPayWebhook(body);
    const repository = getRentalIntentsRepository();
    const intent =
      (event.rentalIntentId ? await repository.getById(event.rentalIntentId) : undefined) ??
      (await repository.getByProviderPaymentId(event.providerPaymentId));
    if (!intent) {
      return errorResponse("Rental intent not found for provider payment", 404, {
        providerPaymentId: event.providerPaymentId,
        rentalIntentId: event.rentalIntentId ?? null,
      });
    }

    const mapped = moonPayStatusToIntent(event.status);
    const updatedIntent = await repository.save({
      ...intent,
      provider: "moonpay_commerce",
      providerPaymentId: event.providerPaymentId,
      paymentStatus: mapped.paymentStatus,
      escrowStatus: mapped.escrowStatus,
      sessionStatus: mapped.sessionStatus,
      receiptStatus: mapped.receiptStatus,
      notes: `MoonPay webhook ${event.status}`,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      intent: updatedIntent,
      event: {
        providerPaymentId: event.providerPaymentId,
        status: event.status,
      },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to process MoonPay webhook", 400);
  }
}
