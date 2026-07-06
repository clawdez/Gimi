import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

// On-chain proof layer: every paid rental mints a Solana DEVNET memo tx whose
// memo is the sha256 hash of the rental facts. Never mainnet. Not a payment.

// Memo v1 — the v2 program (MemoSq4g...) is not deployed on current devnet.
const MEMO_PROGRAM_ID = new PublicKey("Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo");
const DEVNET_RPC = "https://api.devnet.solana.com";
const KEYPAIR_PATH = path.join(process.cwd(), ".keys", "gimi-devnet-keypair.json");

export interface ReceiptPayload {
  itemId: string;
  renter: string;
  amountUsd: number;
  rentalDays: number;
  timestamp: number;
}

export function receiptHash(p: ReceiptPayload): string {
  const canonical = JSON.stringify({
    itemId: p.itemId,
    renter: p.renter,
    amountUsd: p.amountUsd,
    rentalDays: p.rentalDays,
    timestamp: p.timestamp,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export interface MintedReceipt {
  memoHash: string;
  txSignature: string;
  explorerUrl: string;
  cluster: "devnet";
}

interface MinterDeps {
  connection: Connection;
  keypair: Keypair;
}

export function createReceiptMinter({ connection, keypair }: MinterDeps) {
  return {
    signerAddress: keypair.publicKey.toBase58(),

    async ensureFunds(): Promise<void> {
      const balance = await connection.getBalance(keypair.publicKey);
      if (balance >= 0.005 * LAMPORTS_PER_SOL) return;
      const sig = await connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL);
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...latest });
    },

    async mint(payload: ReceiptPayload): Promise<MintedReceipt> {
      const memoHash = receiptHash(payload);
      const ix = new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(`gimi:${memoHash}`, "utf8"),
      });
      const tx = new Transaction().add(ix);
      const txSignature = await sendAndConfirmTransaction(connection, tx, [keypair]);
      return { memoHash, txSignature, explorerUrl: explorerUrl(txSignature), cluster: "devnet" };
    },
  };
}

export type ReceiptMinter = ReturnType<typeof createReceiptMinter>;

export function loadOrCreateKeypair(filePath: string = KEYPAIR_PATH): Keypair {
  if (existsSync(filePath)) {
    const secret = Uint8Array.from(JSON.parse(readFileSync(filePath, "utf8")));
    return Keypair.fromSecretKey(secret);
  }
  const keypair = Keypair.generate();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(Array.from(keypair.secretKey)), { mode: 0o600 });
  return keypair;
}

let defaultMinter: ReceiptMinter | null = null;

export function getReceiptMinter(): ReceiptMinter {
  if (!defaultMinter) {
    defaultMinter = createReceiptMinter({
      connection: new Connection(DEVNET_RPC, "confirmed"),
      keypair: loadOrCreateKeypair(),
    });
  }
  return defaultMinter;
}
