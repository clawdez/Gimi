import { NextRequest, NextResponse } from "next/server";
import { getRentableItem, getRentableItems } from "@/lib/rentableItems";
import { quoteLifiFunding } from "@/lib/lifi";
import {
  buildSettleRentalTransaction,
  buildStartRentalTransaction,
  publicKeyOrFallback,
  DEMO_RENTER_WALLET,
  preflightSettleRental,
  preflightStartRental,
} from "@/lib/rentproofProgram";

const tools = [
  "rentproof.find_offers",
  "rentproof.draft_terms",
  "rentproof.quote_funding",
  "rentproof.create_rental_request",
  "rentproof.prepare_return",
  "rentproof.prepare_auto_buyout",
] as const;

function appUrl(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(req.url).origin;
}

export async function GET(req: NextRequest) {
  const url = `${appUrl(req)}/api/elevenlabs/tools`;
  return NextResponse.json({
    name: "gimi-elevenlabs-tools",
    status: process.env.ELEVENLABS_API_KEY ? "api_key_configured" : "server_tools_ready_api_key_not_configured",
    registration: {
      type: "webhook",
      url,
      method: "POST",
      response_timeout_secs: 20,
      content_type: "application/json",
    },
    tools: tools.map((tool) => ({
      name: tool,
      description:
        tool === "rentproof.find_offers"
          ? "Find rentable community inventory."
          : tool === "rentproof.draft_terms"
            ? "Draft rental terms for an item."
            : tool === "rentproof.quote_funding"
            ? "Quote cross-chain funding into Solana USDC using LI.FI."
              : tool === "rentproof.create_rental_request"
                ? "Create an unsigned serialized Solana devnet start_rental transaction."
                : tool === "rentproof.prepare_return"
                  ? "Create an unsigned serialized Solana devnet confirm_return transaction for the owner to sign."
                  : "Create an unsigned serialized Solana devnet auto_buyout transaction for the owner to sign.",
    })),
    request_body_schema: {
      type: "object",
      required: ["tool"],
      properties: {
        tool: { type: "string", enum: tools },
        itemId: { type: "string" },
        hours: { type: "number" },
        fromAddress: { type: "string", description: "EVM source wallet for LI.FI quote." },
        renterWallet: { type: "string", description: "Solana renter wallet." },
        requireReal: { type: "boolean" },
      },
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const tool = body.tool as (typeof tools)[number];

  if (!tools.includes(tool)) {
    return NextResponse.json({ error: "Unknown tool", tools }, { status: 400 });
  }

  if (tool === "rentproof.find_offers") {
    const items = await getRentableItems();
    return NextResponse.json({
      offers: items
        .filter((item) => item.status === "available")
        .map((item) => ({
          itemId: item.id,
          name: item.name,
          ratePerHour: item.ratePerHour,
          buyoutCap: item.buyoutCap,
          ownerScore: item.ownerScore,
          locationLabel: item.locationLabel,
          category: item.category,
        })),
    });
  }

  const items = await getRentableItems();
  const item = (await getRentableItem(body.itemId ?? "power_bank_18")) ?? items[0];
  if (!item) {
    return NextResponse.json({ error: "No rentable inventory is available" }, { status: 404 });
  }
  const hours = Number(body.hours ?? item.expectedHours);
  const expectedFee = Math.max(item.minimumFee, hours * item.ratePerHour);

  if (tool === "rentproof.draft_terms") {
    return NextResponse.json({
      draft: {
        itemId: item.id,
        itemName: item.name,
        hours,
        expectedFee,
        refundableEscrow: item.buyoutCap,
        ownerScore: item.ownerScore,
        locationLabel: item.locationLabel,
        nextAction: "Call rentproof.quote_funding or rentproof.create_rental_request.",
      },
    });
  }

  if (tool === "rentproof.quote_funding") {
    const route = await quoteLifiFunding({
      amount: item.buyoutCap,
      sourceChain: body.sourceChain,
      sourceToken: body.sourceToken,
      targetChain: "solana",
      targetToken: "USDC",
      fromAddress: body.fromAddress ?? body.sourceAddress,
      toAddress: body.toAddress ?? body.targetAddress ?? body.renterWallet,
      requireReal: Boolean(body.requireReal),
    });
    return NextResponse.json({ route });
  }

  const renter = publicKeyOrFallback(body.renterWallet, DEMO_RENTER_WALLET);
  const rentalId = body.draftId ?? `elevenlabs_${item.id}_${crypto.randomUUID()}`;

  if (tool === "rentproof.prepare_return" || tool === "rentproof.prepare_auto_buyout") {
    const kind = tool === "rentproof.prepare_return" ? "confirm_return" : "auto_buyout";
    const settleRentalId = body.rentalId ?? body.draftId ?? rentalId;
    const preflight = await preflightSettleRental({
      itemId: item.id,
      ownerWallet: item.owner,
      renterWallet: renter.toBase58(),
      rentalId: settleRentalId,
    });

    if (!preflight.ok) {
      return NextResponse.json({ error: "Settlement preflight failed", problems: preflight.problems, preflight }, { status: 409 });
    }

    const serialized = await buildSettleRentalTransaction({
      kind,
      itemId: item.id,
      ownerWallet: item.owner,
      renterWallet: renter.toBase58(),
      rentalId: settleRentalId,
    });

    return NextResponse.json({
      rentalId: settleRentalId,
      itemId: item.id,
      transaction: serialized.transactionBase64,
      transactionMetadata: {
        cluster: serialized.cluster,
        rpcUrl: serialized.rpcUrl,
        blockhash: serialized.blockhash,
        lastValidBlockHeight: serialized.lastValidBlockHeight,
        feePayer: serialized.rentProof.accounts.owner,
        requiredSigner: serialized.rentProof.accounts.owner,
      },
      rentProof: serialized.rentProof,
      preflight,
      safety: "Unsigned owner transaction only. The ElevenLabs tool cannot sign or move funds.",
    });
  }

  const preflight = await preflightStartRental({
    itemId: item.id,
    ownerWallet: item.owner,
    renterWallet: renter.toBase58(),
    rentalId,
    buyoutCap: item.buyoutCap,
  });

  if (!preflight.ok) {
    return NextResponse.json({ error: "Token account preflight failed", problems: preflight.problems, preflight }, { status: 409 });
  }

  const serialized = await buildStartRentalTransaction({
    itemId: item.id,
    ownerWallet: item.owner,
    renterWallet: renter.toBase58(),
    rentalId,
    rentalSeconds: Math.ceil(hours * 3600),
  });

  return NextResponse.json({
    draftId: rentalId,
    itemId: item.id,
    expectedFee,
    escrowAmount: item.buyoutCap,
    transaction: serialized.transactionBase64,
    transactionMetadata: {
      cluster: serialized.cluster,
      rpcUrl: serialized.rpcUrl,
      blockhash: serialized.blockhash,
      lastValidBlockHeight: serialized.lastValidBlockHeight,
      feePayer: serialized.rentProof.accounts.renter,
      requiredSigner: serialized.rentProof.accounts.renter,
    },
    rentProof: serialized.rentProof,
    preflight,
    safety: "Unsigned wallet transaction only. The ElevenLabs tool cannot sign or move funds.",
  });
}
