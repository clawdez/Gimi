# Tably

AI rental agent for school, community, and hackathon inventory.

Tably is one product: an agentic rental marketplace with Solana settlement built in. It handles community inventory search, refundable escrow, temporary rental-token state, return-confirm burn, on-chain receipt events, and reputation-ready outcomes.

## Product Loop

```text
User asks for an item
-> Agent searches community inventory
-> Agent selects the best available item
-> Demo Crossmint wallet path prepares a renter wallet
-> LI.FI quote routes Base USDC into Solana USDC when real wallet addresses are supplied
-> Solana Pay endpoint returns an unsigned serialized devnet transaction
-> Tably Anchor program locks escrow and creates rental session state
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
- Program-aware Solana Pay endpoint at `/api/solana-pay/start-rental` returning an unsigned serialized wallet transaction.
- LI.FI quote endpoint at `/api/lifi/quote` using live LI.FI REST quotes when real source/destination wallets are supplied, with demo fallback for local UI mode.
- ElevenLabs server tools endpoint at `/api/elevenlabs/tools`.
- MCP-style read/prepare endpoint at `/api/mcp`.

## Track Alignment

| Track | Implementation |
| --- | --- |
| Solana | Anchor program for escrow, rental sessions, rental-token PDA lifecycle, receipt events, and auto-buyout |
| LI.FI | `/api/lifi/quote` calls LI.FI REST for Base USDC to Solana USDC routes and returns the LI.FI transaction request when real wallet addresses are supplied |
| ElevenLabs | `/api/elevenlabs/tools` exposes server tools for inventory search, terms drafting, LI.FI funding quotes, and unsigned Solana rental transactions |
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

Devnet setup:

```bash
npm run devnet:setup
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

Returns a Solana Pay request payload, Tably PDA metadata, and an unsigned serialized devnet transaction for the renter wallet to sign.

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
- `instructionArgs.startRental`
- `transaction`
- `transactionMetadata.requiredSigner`
- `transactionMetadata.lastValidBlockHeight`

### `POST /api/lifi/quote`

Returns a LI.FI route for funding the Solana escrow amount. With real wallet addresses, it calls LI.FI REST and returns the LI.FI `transactionRequest`.

Example live quote:

```bash
curl -s -X POST http://localhost:3000/api/lifi/quote \
  -H 'content-type: application/json' \
  -d '{"amount":30,"fromAddress":"0x000000000000000000000000000000000000dEaD","toAddress":"5pNLovuXAbyKM8UGDKZg9Qqe85Sqt1kMPNaippombvwC","requireReal":true}'
```

Without valid wallet addresses, the endpoint returns a demo route so the chat UI can still run locally.

### `GET /api/elevenlabs/tools`

Returns the ElevenLabs server-tool registration metadata for the Tably agent.

### `POST /api/elevenlabs/tools`

Handles tool calls:

- `rentproof.find_offers`
- `rentproof.draft_terms`
- `rentproof.quote_funding`
- `rentproof.create_rental_request`

### `POST /api/rent`

Starts the local demo rental state and returns the same Tably PDA metadata used by the agent UI.

### `GET /idl/rental_session.json`

Serves the generated Anchor IDL.

## Current Boundary

This repo now has a deployed devnet Anchor settlement program, a product-ready demo surface, live LI.FI quote support, ElevenLabs server-tool endpoints, and unsigned serialized Solana transaction generation. It still does not sign or send user transactions by itself.

- Program id: `AVL316tYxrg8MhEeWtaxbwdShMWybzRAH1zNQWvX355K`.
- LI.FI live quotes require valid source and destination wallet addresses; local demo mode falls back when those are missing.
- ElevenLabs is server-tool ready, but the hosted ElevenLabs agent still needs to be configured with this endpoint and `ELEVENLABS_API_KEY`.
- Crossmint is demo embedded-wallet mode until the Crossmint React SDK and `NEXT_PUBLIC_CROSSMINT_API_KEY` are wired.
- MCP never signs or moves funds; it only exposes read/prepare tools.

## Next Steps

1. Register `/api/elevenlabs/tools` in the ElevenLabs agent console.
2. Wire Crossmint embedded wallets for non-web3 renters.
3. Add wallet UI signing for the returned `transaction`.
4. Add serialized `confirm_return` and `auto_buyout` transactions.
