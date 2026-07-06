import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Connection } from "@solana/web3.js";
import {
  createReceiptMinter,
  explorerUrl,
  loadOrCreateKeypair,
  receiptHash,
  ReceiptPayload,
} from "@/lib/receipts";

const payload: ReceiptPayload = {
  itemId: "1",
  renter: "r@x.com",
  amountUsd: 60,
  rentalDays: 3,
  timestamp: 1751760000000,
};

function makeFakeConnection(balanceLamports = 10_000_000_000) {
  return {
    getBalance: vi.fn().mockResolvedValue(balanceLamports),
    requestAirdrop: vi.fn().mockResolvedValue("airdropsig"),
    getLatestBlockhash: vi
      .fn()
      .mockResolvedValue({ blockhash: "hash", lastValidBlockHeight: 1 }),
    confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
    sendTransaction: vi.fn().mockResolvedValue("FAKE_DEVNET_SIGNATURE"),
  };
}

describe("receipts (Solana devnet proof layer)", () => {
  const tmpDirs: string[] = [];
  afterEach(() => {
    for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("receiptHash is the sha256 of the canonical rental facts", () => {
    const expected = createHash("sha256")
      .update(
        JSON.stringify({
          itemId: "1",
          renter: "r@x.com",
          amountUsd: 60,
          rentalDays: 3,
          timestamp: 1751760000000,
        })
      )
      .digest("hex");
    expect(receiptHash(payload)).toBe(expected);
    expect(receiptHash(payload)).toHaveLength(64);
  });

  it("explorerUrl points at the devnet explorer", () => {
    expect(explorerUrl("sig123")).toBe("https://explorer.solana.com/tx/sig123?cluster=devnet");
  });

  it("mint sends a memo transaction containing gimi:<hash> and returns the devnet link", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "gimi-keys-"));
    tmpDirs.push(dir);
    const keypair = loadOrCreateKeypair(path.join(dir, "kp.json"));
    const connection = makeFakeConnection();
    const minter = createReceiptMinter({ connection: connection as unknown as Connection, keypair });

    const receipt = await minter.mint(payload);

    expect(receipt.txSignature).toBe("FAKE_DEVNET_SIGNATURE");
    expect(receipt.txSignature).not.toMatch(/^mock_/);
    expect(receipt.cluster).toBe("devnet");
    expect(receipt.explorerUrl).toBe(
      "https://explorer.solana.com/tx/FAKE_DEVNET_SIGNATURE?cluster=devnet"
    );
    expect(receipt.memoHash).toBe(receiptHash(payload));

    const sentTx = connection.sendTransaction.mock.calls[0][0];
    const memoIx = sentTx.instructions[0];
    expect(memoIx.programId.toBase58()).toBe("Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo");
    expect(memoIx.data.toString("utf8")).toBe(`gimi:${receiptHash(payload)}`);
  });

  it("ensureFunds airdrops devnet SOL only when balance is low", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "gimi-keys-"));
    tmpDirs.push(dir);
    const keypair = loadOrCreateKeypair(path.join(dir, "kp.json"));

    const poor = makeFakeConnection(0);
    const minterPoor = createReceiptMinter({ connection: poor as unknown as Connection, keypair });
    await minterPoor.ensureFunds();
    expect(poor.requestAirdrop).toHaveBeenCalledOnce();

    const rich = makeFakeConnection();
    const minterRich = createReceiptMinter({ connection: rich as unknown as Connection, keypair });
    await minterRich.ensureFunds();
    expect(rich.requestAirdrop).not.toHaveBeenCalled();
  });

  it("loadOrCreateKeypair persists and reloads the same keypair", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "gimi-keys-"));
    tmpDirs.push(dir);
    const file = path.join(dir, "kp.json");
    const first = loadOrCreateKeypair(file);
    const second = loadOrCreateKeypair(file);
    expect(second.publicKey.toBase58()).toBe(first.publicKey.toBase58());
  });
});
