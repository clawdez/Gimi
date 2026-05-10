# Tably / RentProof

AI rental agent for school, community, and hackathon items.

Tably is the consumer app. RentProof is the settlement layer underneath: refundable escrow, temporary rental token, return-confirm burn, receipt, and reputation.

## Demo Flow

```text
User asks for a power bank
-> Agent checks inventory and selects the best available item
-> Demo Crossmint wallet is prepared unless live Crossmint SDK is configured
-> Agent quotes LI.FI funding into Solana USDC
-> Agent creates a Solana Pay start_rental request
-> RentProof locks refundable escrow and mints a rental token
-> Agent monitors the meter
-> Owner confirms return
-> Rental token burns
-> Receipt and reputation update
```

## Track Integrations

| Track | Implementation in this repo |
| --- | --- |
| Solana | Anchor `rental_session` program for SPL-token escrow, rental-session state, rental-token PDA lifecycle, receipts, and auto-buyout |
| LI.FI | `/api/lifi/quote` returns a route tied to required rental escrow |
| ElevenLabs | Voice/chat agent surface and workflow-ready tool calls |
| Virtuals | Perceive/decide/act agent runtime for physical-world rentals |
| MCP | `/api/mcp` exposes read/prepare rental tools for external agents |
| Solana Pay | `/api/solana-pay/start-rental` creates a rental transaction request payload |
| Crossmint | Non-web3 onboarding step is shown as explicit demo wallet mode; live login requires the Crossmint React SDK and `NEXT_PUBLIC_CROSSMINT_API_KEY` |

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## RentProof Anchor Program

The on-chain MVP lives in `programs/rental_session`.

```bash
npm run anchor:build
npm run test:anchor
```

Program id:

```text
AVL316tYxrg8MhEeWtaxbwdShMWybzRAH1zNQWvX355K
```

The program supports:

- `initialize_config` — sets platform fee authority and fee bps.
- `initialize_item` — records an owner, payment mint, metered rate, minimum fee, buyout cap, and auto-buyout grace window.
- `start_rental` — transfers the full SPL-token buyout cap from renter into escrow, creates a `RentalSession`, and mints a non-transferable program-owned `RentalToken` PDA.
- `confirm_return` — owner-confirmed physical return; settles metered fee, platform fee, renter refund, closes escrow, closes the rental token PDA, and emits a receipt event.
- `auto_buyout` — after due time plus grace, owner can claim the buyout cap less platform fee; renter refund is zero, escrow closes, rental token PDA closes, and the item is marked bought out.

The generated IDL is served at `/idl/rental_session.json`. `/api/solana-pay/start-rental` now returns the program id, PDA addresses, and instruction args needed to assemble the real wallet transaction.

## Current Boundary

This sprint implements the full product surface plus a buildable Anchor settlement program. The irreversible operations remain approval-gated:

- MCP never signs or moves funds.
- LI.FI endpoint is a demo quote adapter until keys/network execution are configured.
- Solana Pay endpoint returns a program-aware transaction request plan; final wallet serialization/signing still needs live renter token accounts and a deployed program.
- Crossmint is not live-connected in this build. The agent uses an explicit demo embedded wallet path until `@crossmint/client-sdk-react-ui`, `CrossmintProvider`, `CrossmintAuthProvider`, `CrossmintWalletProvider`, and `NEXT_PUBLIC_CROSSMINT_API_KEY` are wired.

## Build Next

1. Add Crossmint embedded wallet SDK and replace demo wallet mode with live Crossmint auth/wallet creation.
2. Replace LI.FI quote mock with SDK/REST route call.
3. Deploy `rental_session` to devnet and replace the Solana Pay plan with a serialized transaction.
4. Connect ElevenLabs agent tools to the existing API routes.
5. Serve MCP through a proper MCP transport in addition to `/api/mcp`.
