# Gimi

AI rental agent for school, community, and hackathon inventory.

Gimi is one product: an agentic rental marketplace with Solana settlement built in. It handles community inventory search, refundable escrow, temporary rental-token state, return-confirm burn, on-chain receipt events, and reputation-ready outcomes.

The current demo opens at `/` and renders the Gimi one-page agent shell from `public/gimi.html` inside a Next controller shell: a large central agent orb, a bottom chat input, nearby inventory, a product checkout drawer, and same-page Privy wallet connection for email, Google, or Solana wallet users.

## Product Loop

```text
User asks for an item
-> Agent searches community inventory
-> Agent selects the best available item
-> Privy login creates/loads the renter Solana wallet
-> LI.FI quote routes Base USDC into Solana USDC when real wallet addresses are supplied
-> Solana Pay endpoint returns an unsigned serialized devnet transaction
-> Wallet signs and sends the prepared transaction from the chat UI
-> Gimi Anchor program locks escrow and creates rental session state
-> Renter receives a program-owned rental token PDA
-> Owner confirms physical return, or auto-buyout triggers after grace
-> Rental token closes, escrow settles, receipt event is emitted
```

The MVP is designed for physical-world rentals where the agent helps people borrow real items from a school, community, apartment, coworking space, or hackathon venue.

## What Is Implemented

- Gimi one-page agent shell at `/`, rendered by `src/app/page.tsx` with `public/gimi.html` as the visual shell.
- Central orb plus bottom chat input for natural-language rental requests.
- Clickable nearby inventory and product checkout drawer.
- Same-page Privy controller for direct email, Google, or Solana wallet login. The controller signs a Solana sign-in message before the shell stores the wallet session.
- Wallet session reuse: once Privy connects, the checkout drawer changes from `Connect wallet` to `Start rental` instead of asking the user to connect again.
- Demo inventory, rental session state, return flow, receipt copy, and reputation-ready result.
- Receipt/history page for recent settled rentals, item context, wallet parties, payout/refund split, and Solana explorer links.
- Anchor `rental_session` program for SPL-token escrow and rental lifecycle.
- Public generated IDL at `/idl/rental_session.json`.
- Owner listing flow that prepares an owner-signed `initialize_item` devnet transaction, verifies the confirmed item PDA, and publishes it into renter inventory.
- Supabase-backed listing storage when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, with local file fallback for development.
- Program-aware Solana Pay endpoints returning unsigned serialized wallet transactions for `initialize_item`, `start_rental`, `confirm_return`, and `auto_buyout`.
- Wallet signing/sending through Privy Solana wallets from the active Gimi shell.
- LI.FI quote endpoint at `/api/lifi/quote` using live LI.FI REST quotes when real source/destination wallets are supplied, with demo fallback for local UI mode.
- ElevenLabs server tools endpoint at `/api/elevenlabs/tools`.
- MCP-style read/prepare endpoint at `/api/mcp`.
- Privy React provider and bridge CTA for real wallet onboarding. The UI does not mint a fake renter wallet when Privy is not configured.

## Track Alignment

| Track | Implementation |
| --- | --- |
| Solana | Anchor program for escrow, rental sessions, rental-token PDA lifecycle, receipt events, and auto-buyout |
| LI.FI | `/api/lifi/quote` calls LI.FI REST for Base USDC to Solana USDC routes and returns the LI.FI transaction request when real wallet addresses are supplied |
| ElevenLabs | `/api/elevenlabs/tools` exposes server tools for inventory search, terms drafting, LI.FI funding quotes, and unsigned Solana rental transactions |
| Virtuals | Agent perceives inventory, decides best item, and acts around physical-world handoff/return workflows |
| MCP | `/api/mcp` exposes read/prepare rental tools for external agents |
| Solana Pay | `/api/solana-pay/initialize-item`, `/api/solana-pay/start-rental`, `/api/solana-pay/confirm-return`, and `/api/solana-pay/auto-buyout` return Solana Pay-style request payloads plus program id, PDA accounts, required signer, and instruction args |
| Privy | `@privy-io/react-auth` provides email/Google onboarding and embedded Solana checkout wallets through `NEXT_PUBLIC_PRIVY_APP_ID` |

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For wallet login, create `.env.local`:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=YOUR_PRIVY_APP_ID
```

The production Vercel project must also have `NEXT_PUBLIC_PRIVY_APP_ID` configured. Without it, Gimi shows a setup screen instead of the rental shell.

Useful checks:

```bash
npm run lint
npm run build
npm run test:anchor
npm run devnet:setup
npm run e2e:devnet
```

## Supabase

Gimi uses Supabase for durable published listing and rental-session storage. Run the migrations in:

```text
supabase/migrations/001_create_listings.sql
supabase/migrations/002_create_rental_sessions.sql
supabase/migrations/003_create_rental_receipts.sql
```

Then configure these server-side environment variables:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-only. Do not prefix it with
`NEXT_PUBLIC_`.

If those env vars are missing, the app falls back to local file storage at
`.rentproof/listings.json`, `.rentproof/rental-sessions.json`, and
`.rentproof/rental-receipts.json` locally, and `/tmp/tably-*.json` files on Vercel.
The Vercel fallback is ephemeral and should only be used for smoke tests.

## Privy Wallet Flow

The static Gimi visual shell cannot call Privy hooks directly, so `/` renders a small React controller around it. The visible shell sends wallet requests to the parent page with `postMessage`; the parent page opens Privy's modal directly in the same page and then asks the Solana wallet to sign a Gimi sign-in message.

```text
public/gimi.html
-> posts gimi:request-privy-connect to the parent Next page
-> parent opens the Privy modal directly on the current page
-> parent asks the connected wallet to sign a Gimi sign-in message
-> parent posts the signed wallet session back to the shell
-> shell writes gimi.walletSession and updates the checkout drawer
```

For rental checkout, `public/gimi.html` stores the prepared base64 transaction in
`gimi.pendingPrivyTransaction` and asks the parent controller to sign/send it:

```text
gimi:request-privy-transaction
```

The parent controller signs and sends through the connected Privy Solana wallet, then posts
the devnet signature to the shell so `/api/rentals/start` can persist the rental
session and update listing status.

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

Publishes a listing after the owner has signed and sent `initialize_item`. The server checks the devnet signature, verifies the item PDA is owned by the Gimi program, decodes the on-chain `RentalItem`, checks pricing and hashes, then stores the listing.

### `GET /api/listings`

Returns published listings plus renter-ready inventory. The renter agent uses this endpoint first and falls back to seeded demo inventory when no published listing exists.

### `POST /api/solana-pay/start-rental`

Returns a Solana Pay request payload, Gimi PDA metadata, and an unsigned serialized devnet transaction for the renter wallet to sign.
Before returning a transaction, the route checks the item PDA, demo USDC mint,
renter token account, and renter escrow balance. If the renter cannot pay the
buyout-cap escrow, it returns `409` with `preflight.problems`.

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

### `POST /api/rentals/start`

Persists a successful `start_rental` after the renter signs and sends the
transaction. The server checks the devnet signature, derives the item/session
PDAs from the listing, rental id, and renter wallet, verifies the on-chain
`RentalItem` is rented with the expected active session, verifies the
`RentalSession` account is active, saves the session, and updates the listing
status to `rented`. After that, `GET /api/listings` no longer returns the item
as available.

Example request:

```bash
curl -s -X POST http://localhost:3000/api/rentals/start \
  -H 'content-type: application/json' \
  -d '{"itemId":"item_id_from_listing","renterWallet":"5pNLovuXAbyKM8UGDKZg9Qqe85Sqt1kMPNaippombvwC","rentalId":"draft_item_id_from_listing","startRentalSignature":"CONFIRMED_DEVNET_SIGNATURE"}'
```

Response includes:

- `rentalSession.sessionPda`
- `rentalSession.rentalTokenPda`
- `listing.status`
- `rentProof.accounts`
- `explorerUrl`

### `POST /api/solana-pay/confirm-return`

Returns an unsigned serialized devnet `confirm_return` transaction for the owner wallet to sign. It settles metered fee, platform fee, owner payout, renter refund, closes escrow/rental-token state, and emits the return receipt event.
The route verifies that the item/session PDAs exist before returning a
transaction. The settlement transaction idempotently creates missing renter,
owner, and platform fee token accounts before escrow settlement.

Example request:

```bash
curl -s -X POST http://localhost:3000/api/solana-pay/confirm-return \
  -H 'content-type: application/json' \
  -d '{"itemId":"mic_11","renterWallet":"5pNLovuXAbyKM8UGDKZg9Qqe85Sqt1kMPNaippombvwC","rentalId":"draft_mic_11"}'
```

### `POST /api/solana-pay/auto-buyout`

Returns an unsigned serialized devnet `auto_buyout` transaction for the owner wallet to sign after due time plus grace. It claims the buyout escrow, closes rental-token state, marks the item bought out, and emits the buyout receipt event.
The route uses the same settlement preflight and idempotent destination-token
account setup as `confirm_return`.

Example request:

```bash
curl -s -X POST http://localhost:3000/api/solana-pay/auto-buyout \
  -H 'content-type: application/json' \
  -d '{"itemId":"mic_11","renterWallet":"5pNLovuXAbyKM8UGDKZg9Qqe85Sqt1kMPNaippombvwC","rentalId":"draft_mic_11"}'
```

### `POST /api/rentals/settle`

Persists a successful `confirm_return` or `auto_buyout` after the owner signs
and sends the settlement transaction. The server checks the devnet signature,
re-derives the same PDAs, verifies the on-chain `RentalItem` and
`RentalSession` are in the expected settled state, updates the listing status,
updates the rental session settlement fields, and writes a durable receipt row.

For `kind: "return"`, the listing becomes `available` again and the receipt
outcome is `returned_ok`. For `kind: "buyout"`, the listing becomes `buyout`
and the receipt outcome is `auto_buyout`.

Example request:

```bash
curl -s -X POST http://localhost:3000/api/rentals/settle \
  -H 'content-type: application/json' \
  -d '{"kind":"return","itemId":"item_id_from_listing","renterWallet":"5pNLovuXAbyKM8UGDKZg9Qqe85Sqt1kMPNaippombvwC","rentalId":"draft_item_id_from_listing","settlementSignature":"CONFIRMED_DEVNET_SIGNATURE"}'
```

Response includes:

- `rentalSession.status`
- `rentalSession.finalFee`
- `rentalSession.ownerPayout`
- `rentalSession.platformFee`
- `rentalSession.renterRefund`
- `receipt.outcome`
- `receipt.settlementSignature`
- `listing.status`
- `explorerUrl`

### `GET /api/rentals/history`

Returns recent settled receipt rows for the user-visible receipt history page.
Each receipt is enriched with item display data when the listing or demo item
can be found, plus a Solana explorer URL for the settlement transaction.

Optional filters:

- `wallet`: matches either owner or renter wallet.
- `rentalId`: returns one rental id when present.
- `limit`: defaults to 20 and caps at 50.

Example request:

```bash
curl -s 'http://localhost:3000/api/rentals/history?limit=10'
```

Response includes:

- `receipts[].rentalId`
- `receipts[].item.name`
- `receipts[].outcome`
- `receipts[].settlementSignature`
- `receipts[].explorerUrl`
- `receipts[].grossFee`
- `receipts[].platformFee`
- `receipts[].ownerPayout`
- `receipts[].renterRefund`
- `receipts[].ownerWalletShort`
- `receipts[].renterWalletShort`

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

Returns the ElevenLabs server-tool registration metadata for the Gimi agent.

### `POST /api/elevenlabs/tools`

Handles tool calls:

- `rentproof.find_offers`
- `rentproof.draft_terms`
- `rentproof.quote_funding`
- `rentproof.create_rental_request`
- `rentproof.prepare_return`
- `rentproof.prepare_auto_buyout`

### `POST /api/rent`

Starts the local demo rental state and returns the same Gimi PDA metadata used by the agent UI.

### `GET /idl/rental_session.json`

Serves the generated Anchor IDL.

## Current Boundary

This repo now has a deployed devnet Anchor settlement program, a product-ready demo surface, owner listing prepare/sign/publish flow, rental start status sync, return/auto-buyout settlement sync, durable receipt persistence, a renter/owner-visible receipt history surface, live LI.FI quote support, ElevenLabs server-tool endpoints, unsigned serialized Solana transaction generation, and wallet-side signing/sending for prepared transactions.

- Program id: `AVL316tYxrg8MhEeWtaxbwdShMWybzRAH1zNQWvX355K`.
- Published listings, rental sessions, and rental receipts use Supabase when configured. Without Supabase env vars, the app falls back to ephemeral file storage.
- Privy wallet login requires `NEXT_PUBLIC_PRIVY_APP_ID`.
- LI.FI live quotes require valid source and destination wallet addresses; local demo mode falls back when those are missing.
- ElevenLabs is server-tool ready, but the hosted ElevenLabs agent still needs to be configured with this endpoint and `ELEVENLABS_API_KEY`.
- MCP and ElevenLabs tools never sign or move funds; they expose read/prepare tools only.

## Next Steps

1. Run the Supabase migrations and add `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` to Vercel.
2. Add `NEXT_PUBLIC_PRIVY_APP_ID` to Vercel production and local `.env.local`.
3. Run the devnet E2E with funded owner/renter wallets; it now covers owner listing, start rental, return settlement, auto-buyout settlement, listing status sync, and receipt persistence.
4. Register `/api/elevenlabs/tools` in the ElevenLabs agent console.
