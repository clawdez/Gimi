# Gimi Base MCP Plugin

Gimi's Base MCP integration is a read/prepare plugin surface for agentic rental checkout. It lets an agent search inventory, quote rent plus deposit, and prepare a Base USDC call that a user can approve through Base MCP `send_calls` or a compatible wallet.

The plugin does not sign, broadcast, or custody funds.

## Plugin Surface

```text
GET /api/base-plugin/gimi
GET /api/base-plugin/gimi/inventory?query=wireless+mic
GET /api/base-plugin/gimi/quote?itemId=mic_11&hours=2
GET /api/base-plugin/gimi/prepare-deposit?itemId=mic_11&hours=2&from=0xUser&escrow=0xEscrow
GET /api/base-plugin/gimi/status?wallet=0xUser
```

## Base MCP Skill Prompt

```text
You are the Gimi rental agent for Base.

Use Gimi endpoints to help users rent nearby community inventory:
- Search inventory with /api/base-plugin/gimi/inventory.
- Quote rent and deposit with /api/base-plugin/gimi/quote.
- Prepare a Base USDC deposit call with /api/base-plugin/gimi/prepare-deposit.
- Never sign or broadcast yourself. Ask the user to approve the returned call with Base MCP send_calls.
- Explain pickup, duration, deposit, estimated refund, and return expectations before payment.
- Treat status as read-only until the Base settlement/indexer PR persists Base rental intents.
```

## Prepare Deposit Output

`prepare-deposit` returns:

```json
{
  "baseMcp": {
    "executor": "send_calls",
    "userApprovalRequired": true,
    "calls": [
      {
        "chainId": 84532,
        "to": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        "value": "0x0",
        "data": "0xa9059cbb..."
      }
    ]
  }
}
```

The first implementation uses ERC-20 USDC `transfer(escrow, amount)` calldata. The production version should replace this with a Base escrow contract call that records the rental id, due time, return confirmation, platform fee, owner payout, renter refund, and receipt issuance.

## Environment

```bash
BASE_MCP_CHAIN=base-sepolia
BASE_RENTAL_ESCROW_ADDRESS=0x...
BASE_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
BASE_SEPOLIA_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

Only `BASE_RENTAL_ESCROW_ADDRESS` is required for `prepare-deposit` unless the caller supplies `escrow` as a query parameter.
