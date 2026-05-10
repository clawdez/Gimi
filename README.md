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
| Solana | Devnet-oriented rental state, escrow/token transaction plan, receipt state, wallet adapter support |
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

## Current Boundary

This sprint implements the full product surface and mocked integration adapters. The irreversible operations remain approval-gated:

- MCP never signs or moves funds.
- LI.FI endpoint is a demo quote adapter until keys/network execution are configured.
- Solana Pay endpoint returns a transaction request plan; wiring real serialized transactions requires the Anchor program.
- Crossmint is not live-connected in this build. The agent uses an explicit demo embedded wallet path until `@crossmint/client-sdk-react-ui`, `CrossmintProvider`, `CrossmintAuthProvider`, `CrossmintWalletProvider`, and `NEXT_PUBLIC_CROSSMINT_API_KEY` are wired.

## Build Next

1. Add Crossmint embedded wallet SDK and replace demo wallet mode with live Crossmint auth/wallet creation.
2. Replace LI.FI quote mock with SDK/REST route call.
3. Add Anchor `RentalSession` program and serialized Solana Pay transaction.
4. Connect ElevenLabs agent tools to the existing API routes.
5. Serve MCP through a proper MCP transport in addition to `/api/mcp`.
