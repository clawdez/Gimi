# Tably

AI rental agent for school, community, and hackathon inventory.

Tably is one product: an agentic rental marketplace with Solana settlement built in. It handles community inventory search, refundable escrow, temporary rental-token state, return-confirm burn, on-chain receipt events, and reputation-ready outcomes.

## Product Loop

```text
User asks for an item
-> Agent searches community inventory
-> Agent selects the best available item
-> Crossmint embedded wallet login creates/loads the renter wallet
-> LI.FI quote routes Base USDC into Solana USDC when real wallet addresses are supplied
-> Solana Pay endpoint returns an unsigned serialized devnet transaction
-> Wallet signs and sends the prepared transaction from the chat UI
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
- Owner listing flow that prepares an owner-signed `initialize_item` devnet transaction, verifies the confirmed item PDA, and publishes it into renter inventory.
- Program-aware Solana Pay endpoints returning unsigned serialized wallet transactions for `initialize_item`, `start_rental`, `confirm_return`, and `auto_buyout`.
- Wallet signing/sending from the chat UI through Crossmint Solana wallets or Solana wallet adapter wallets.
- LI.FI quote endpoint at `/api/lifi/quote` using live LI.FI REST quotes when real source/destination wallets are supplied, with demo fallback for local UI mode.
- ElevenLabs server tools endpoint at `/api/elevenlabs/tools`.
- MCP-style read/prepare endpoint at `/api/mcp`.
- Crossmint React provider and wallet CTA for real embedded-wallet onboarding. The UI does not mint a fake renter wallet when Crossmint is not configured.

## Track Alignment

| Track | Implementation |
| --- | --- |
| Solana | Anchor program for escrow, rental sessions, rental-token PDA lifecycle, receipt events, and auto-buyout |
| LI.FI | `/api/lifi/quote` calls LI.FI REST for Base USDC to Solana USDC routes and returns the LI.FI transaction request when real wallet addresses are supplied |
| ElevenLabs | `/api/elevenlabs/tools` exposes server tools for inventory search, terms drafting, LI.FI funding quotes, and unsigned Solana rental transactions |
| Virtuals | Agent perceives inventory, decides best item, and acts around physical-world handoff/return workflows |
| MCP | `/api/mcp` exposes read/prepare rental tools for external agents |
| Solana Pay | `/api/solana-pay/initialize-item`, `/api/solana-pay/start-rental`, `/api/solana-pay/confirm-return`, and `/api/solana-pay/auto-buyout` return Solana Pay-style request payloads plus program id, PDA accounts, required signer, and instruction args |
| Crossmint | `@crossmint/client-sdk-react-ui` provides real email/Google login and creates/loads a Solana renter wallet through `NEXT_PUBLIC_CROSSMINT_API_KEY` |

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

### `POST /api/solana-pay/initialize-item`

Prepares an owner-signed devnet `initialize_item` transaction for a new listing. The server canonicalizes the item metadata, hashes it, derives the item PDA, and returns a base64 transaction.

Example request:

```bash
curl -s -X POST http://localhost:3000/api/solana-pay/initialize-item \
  -H 'content-type: application/json' \
  -d '{"ownerWallet":"7Fmr5t2h2SZ55n4w3dkgWTjaXRafDnBLLy1RhdmPJk6b","name":"Anker Power Bank","brand":"Anker","model":"20K USB-C","category":"Power","condition":9,"description":"High-capacity USB-C power bank with cable.","imageUrl":"https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=900&h=700&fit=crop","locationLabel":"Library desk","included":["USB-C cable"],"ratePerHour":2,"minimumFee":3,"buyoutCap":30,"autoBuyoutGraceSeconds":3600}'
```

Response includes:

- `draftId`
- `itemPda`
- `metadataHash`
- `listingPreview`
- `transaction`
- `transactionMetadata.requiredSigner`

### `POST /api/listings/publish`

Publishes a listing after the owner has signed and sent `initialize_item`. The server checks the devnet signature, verifies the item PDA is owned by the Tably program, decodes the on-chain `RentalItem`, checks pricing and hashes, then stores the listing.

### `GET /api/listings`

Returns published listings plus renter-ready inventory. The renter agent uses this endpoint first and falls back to seeded demo inventory when no published listing exists.

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

### `POST /api/solana-pay/confirm-return`

Returns an unsigned serialized devnet `confirm_return` transaction for the owner wallet to sign. It settles metered fee, platform fee, owner payout, renter refund, closes escrow/rental-token state, and emits the return receipt event.

Example request:

```bash
curl -s -X POST http://localhost:3000/api/solana-pay/confirm-return \
  -H 'content-type: application/json' \
  -d '{"itemId":"mic_11","renterWallet":"5pNLovuXAbyKM8UGDKZg9Qqe85Sqt1kMPNaippombvwC","rentalId":"draft_mic_11"}'
```

### `POST /api/solana-pay/auto-buyout`

Returns an unsigned serialized devnet `auto_buyout` transaction for the owner wallet to sign after due time plus grace. It claims the buyout escrow, closes rental-token state, marks the item bought out, and emits the buyout receipt event.

Example request:

```bash
curl -s -X POST http://localhost:3000/api/solana-pay/auto-buyout \
  -H 'content-type: application/json' \
  -d '{"itemId":"mic_11","renterWallet":"5pNLovuXAbyKM8UGDKZg9Qqe85Sqt1kMPNaippombvwC","rentalId":"draft_mic_11"}'
```

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
- `rentproof.prepare_return`
- `rentproof.prepare_auto_buyout`

### `POST /api/rent`

Starts the local demo rental state and returns the same Tably PDA metadata used by the agent UI.

### `GET /idl/rental_session.json`

Serves the generated Anchor IDL.

## Current Boundary

This repo now has a deployed devnet Anchor settlement program, a product-ready demo surface, owner listing prepare/sign/publish flow, live LI.FI quote support, ElevenLabs server-tool endpoints, unsigned serialized Solana transaction generation, and wallet-side signing/sending for prepared transactions.

- Program id: `AVL316tYxrg8MhEeWtaxbwdShMWybzRAH1zNQWvX355K`.
- Published listings currently use file-backed local storage. On Vercel this is ephemeral; production needs Postgres, Supabase, or another durable database before real user listings are relied on.
- Crossmint wallet login requires a client API key with Wallet API scopes in `NEXT_PUBLIC_CROSSMINT_API_KEY`.
- LI.FI live quotes require valid source and destination wallet addresses; local demo mode falls back when those are missing.
- ElevenLabs is server-tool ready, but the hosted ElevenLabs agent still needs to be configured with this endpoint and `ELEVENLABS_API_KEY`.
- MCP and ElevenLabs tools never sign or move funds; they expose read/prepare tools only.

## Next Steps

1. Replace file-backed listing storage with a durable production database.
2. Run an end-to-end owner listing test with a funded owner wallet, then rent that newly listed item from a funded renter wallet.
3. Register `/api/elevenlabs/tools` in the ElevenLabs agent console.
4. Add indexed session/receipt persistence so refreshed production pages can show prior tx state.
