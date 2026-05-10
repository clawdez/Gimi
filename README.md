# Tably / RentProof

AI rental agent for school, community, and hackathon inventory.

Tably is the consumer-facing agent interface. RentProof is the Solana settlement layer underneath it: refundable escrow, temporary rental-token state, return-confirm burn, on-chain receipt events, and reputation-ready outcomes.

## Product Loop

```text
User asks for an item
-> Agent searches community inventory
-> Agent selects the best available item
-> Demo Crossmint wallet path prepares a renter wallet
-> LI.FI quote estimates funding into Solana USDC
-> Solana Pay endpoint prepares the rental transaction plan
-> RentProof Anchor program locks escrow and creates rental session state
-> Renter receives a program-owned rental token PDA
-> Owner confirms physical return, or auto-buyout triggers after grace
-> Rental token closes, escrow settles, receipt event is emitted
```

The MVP is designed for physical-world rentals where the agent helps people borrow real items from a school, community, apartment, coworking space, or hackathon venue.

## What Is Implemented

- SKYLRK-inspired storefront page with clickable floating inventory.
- Usable chat agent that can parse natural-language item requests.
- Demo inventory, rental session state, return flow, receipt copy, and reputation-ready result.
- Anchor `rental_session` program for SPL-token escrow and rental lifecycle.
- Public generated IDL at `/idl/rental_session.json`.
- Program-aware Solana Pay planning endpoint at `/api/solana-pay/start-rental`.
- Demo LI.FI quote endpoint at `/api/lifi/quote`.
- MCP-style read/prepare endpoint at `/api/mcp`.

## Track Alignment

| Track | Implementation |
| --- | --- |
| Solana | Anchor program for escrow, rental sessions, rental-token PDA lifecycle, receipt events, and auto-buyout |
| LI.FI | `/api/lifi/quote` quotes cross-chain funding into the required Solana escrow amount |
| ElevenLabs | Chat/voice-ready agent workflow with tool-call boundaries for inventory, funding, rental, return, and receipt |
| Virtuals | Agent perceives inventory, decides best item, and acts around physical-world handoff/return workflows |
| MCP | `/api/mcp` exposes read/prepare rental tools for external agents |
| Solana Pay | `/api/solana-pay/start-rental` returns a Solana Pay request plus program id, PDA accounts, and instruction args |
| Crossmint | Non-web3 onboarding is represented as demo embedded-wallet mode; live SDK wiring is the next integration step |

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful checks:

```bash
npm run lint
npm run build
npm run test:anchor
```

## Anchor Program

Program path:

```text
programs/rental_session
```

Program id:

```text
AVL316tYxrg8MhEeWtaxbwdShMWybzRAH1zNQWvX355K
```

Build:

```bash
npm run anchor:build
```

Instructions:

- `initialize_config` sets platform fee authority and fee bps.
- `initialize_item` records owner, payment mint, metered rate, minimum fee, buyout cap, and auto-buyout grace window.
- `start_rental` transfers the full SPL-token buyout cap from renter to escrow, creates `RentalSession`, and creates the non-transferable `RentalToken` PDA.
- `confirm_return` settles metered fee, platform fee, owner payout, renter refund, closes escrow, closes rental token, and emits `RentalReturned`.
- `auto_buyout` lets the owner claim the buyout cap after due time plus grace, closes escrow/token state, marks the item bought out, and emits `RentalBoughtOut`.

The rental token is intentionally a program-owned PDA account, not a transferable SPL token. That keeps the rental right bound to the session and prevents a renter from transferring away the obligation.

## API Surface

### `POST /api/solana-pay/start-rental`

Returns a Solana Pay request payload and the program metadata needed to build the real transaction.

Example request:

```bash
curl -s -X POST http://localhost:3000/api/solana-pay/start-rental \
  -H 'content-type: application/json' \
  -d '{"itemId":"mic_11","renterWallet":"5pNLovuXAbyKM8UGDKZg9Qqe85Sqt1kMPNaippombvwC","hours":2}'
```

Response includes:

- `rentProof.programId`
- `rentProof.accounts.config`
- `rentProof.accounts.item`
- `rentProof.accounts.session`
- `rentProof.accounts.rentalToken`
- `rentProof.accounts.escrowTokenAccount`
- `instructionArgs.initializeConfig`
- `instructionArgs.initializeItem`
- `instructionArgs.startRental`

### `POST /api/lifi/quote`

Returns a demo LI.FI route for funding the Solana escrow amount.

### `POST /api/rent`

Starts the local demo rental state and returns the same RentProof PDA metadata used by the agent UI.

### `GET /idl/rental_session.json`

Serves the generated Anchor IDL.

## Current Boundary

This repo now has a buildable Anchor settlement program and a product-ready demo surface. It still does not sign or send real user transactions by itself.

- The Anchor program builds and has unit tests, but has not been deployed to devnet from this repo.
- The Solana Pay endpoint is program-aware, but still returns a transaction plan instead of a serialized wallet transaction.
- LI.FI is a demo quote adapter until live LI.FI SDK/API execution is configured.
- Crossmint is demo embedded-wallet mode until the Crossmint React SDK and `NEXT_PUBLIC_CROSSMINT_API_KEY` are wired.
- MCP never signs or moves funds; it only exposes read/prepare tools.

## Next Steps

1. Deploy `rental_session` to devnet and publish the matching IDL.
2. Replace the Solana Pay plan with a serialized transaction request using live token accounts.
3. Wire Crossmint embedded wallets for non-web3 renters.
4. Replace the LI.FI mock with real route execution.
5. Connect ElevenLabs voice agent tools to the same API flow.
