import { createHash } from "node:crypto";
import {
  Connection,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";

export const RENTAL_SESSION_PROGRAM_ID = new PublicKey("AVL316tYxrg8MhEeWtaxbwdShMWybzRAH1zNQWvX355K");
export const DEMO_OWNER_WALLET = new PublicKey("7Fmr5t2h2SZ55n4w3dkgWTjaXRafDnBLLy1RhdmPJk6b");
export const DEMO_RENTER_WALLET = new PublicKey("5pNLovuXAbyKM8UGDKZg9Qqe85Sqt1kMPNaippombvwC");
export const DEMO_FEE_AUTHORITY = new PublicKey("AWesFzR3x97q5QWk6MBxLU8kRGZcuobtKuoABtMiHWH1");
export const DEMO_USDC_MINT = new PublicKey("FGzrpZ3DnvoeQj2au9g4cMoawrvoyRdgn51yXDtHqQzp");

export const PLATFORM_FEE_BPS = 500;
export const USDC_DECIMALS = 6;
export const AUTO_BUYOUT_GRACE_SECONDS = 60 * 60;
export const SOLANA_CLUSTER = "devnet";
export const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export function bytes32Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function bytes32Array(value: string) {
  return Array.from(createHash("sha256").update(value).digest());
}

export function usdcBaseUnits(amount: number) {
  return Math.round(amount * 10 ** USDC_DECIMALS);
}

export function ratePerSecondBaseUnits(ratePerHour: number) {
  return Math.max(1, Math.ceil(usdcBaseUnits(ratePerHour) / 3600));
}

export function publicKeyOrFallback(value: unknown, fallback: PublicKey) {
  if (typeof value !== "string") return fallback;
  try {
    return new PublicKey(value);
  } catch {
    return fallback;
  }
}

export function deriveRentProofAccounts(input: {
  itemId: string;
  ownerWallet?: unknown;
  renterWallet?: unknown;
  rentalId?: string;
  paymentMint?: PublicKey;
}) {
  const owner = publicKeyOrFallback(input.ownerWallet, DEMO_OWNER_WALLET);
  const renter = publicKeyOrFallback(input.renterWallet, DEMO_RENTER_WALLET);
  const paymentMint = input.paymentMint ?? DEMO_USDC_MINT;
  const itemIdHash = Buffer.from(bytes32Array(input.itemId));
  const rentalIdHash = Buffer.from(bytes32Array(input.rentalId ?? `${input.itemId}:${renter.toBase58()}`));

  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], RENTAL_SESSION_PROGRAM_ID);
  const [item] = PublicKey.findProgramAddressSync(
    [Buffer.from("item"), owner.toBuffer(), itemIdHash],
    RENTAL_SESSION_PROGRAM_ID
  );
  const [session] = PublicKey.findProgramAddressSync(
    [Buffer.from("session"), item.toBuffer(), rentalIdHash],
    RENTAL_SESSION_PROGRAM_ID
  );
  const [rentalToken] = PublicKey.findProgramAddressSync(
    [Buffer.from("rental_token"), session.toBuffer()],
    RENTAL_SESSION_PROGRAM_ID
  );
  const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), session.toBuffer()],
    RENTAL_SESSION_PROGRAM_ID
  );
  const [escrowAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_authority"), session.toBuffer()],
    RENTAL_SESSION_PROGRAM_ID
  );
  const renterTokenAccount = getAssociatedTokenAddressSync(paymentMint, renter);
  const ownerTokenAccount = getAssociatedTokenAddressSync(paymentMint, owner);
  const platformFeeTokenAccount = getAssociatedTokenAddressSync(paymentMint, DEMO_FEE_AUTHORITY);

  return {
    programId: RENTAL_SESSION_PROGRAM_ID.toBase58(),
    idlPath: "/idl/rental_session.json",
    itemIdHash: bytes32Hex(input.itemId),
    rentalIdHash: Buffer.from(rentalIdHash).toString("hex"),
    accounts: {
      config: config.toBase58(),
      item: item.toBase58(),
      session: session.toBase58(),
      rentalToken: rentalToken.toBase58(),
      escrowTokenAccount: escrowTokenAccount.toBase58(),
      escrowAuthority: escrowAuthority.toBase58(),
      renterTokenAccount: renterTokenAccount.toBase58(),
      ownerTokenAccount: ownerTokenAccount.toBase58(),
      platformFeeTokenAccount: platformFeeTokenAccount.toBase58(),
      owner: owner.toBase58(),
      renter: renter.toBase58(),
      feeAuthority: DEMO_FEE_AUTHORITY.toBase58(),
      paymentMint: paymentMint.toBase58(),
    },
  };
}

export function anchorInstructionDiscriminator(name: string) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

export function startRentalInstructionData(input: {
  rentalIdHash: string;
  rentalSeconds: number;
}) {
  const data = Buffer.alloc(8 + 32 + 8);
  anchorInstructionDiscriminator("start_rental").copy(data, 0);
  Buffer.from(input.rentalIdHash, "hex").copy(data, 8);
  data.writeBigInt64LE(BigInt(input.rentalSeconds), 40);
  return data;
}

export async function buildStartRentalTransaction(input: {
  itemId: string;
  ownerWallet?: unknown;
  renterWallet?: unknown;
  rentalId: string;
  rentalSeconds: number;
}) {
  const rentProof = deriveRentProofAccounts(input);
  const accounts = rentProof.accounts;
  const renter = new PublicKey(accounts.renter);
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const instruction = new TransactionInstruction({
    programId: RENTAL_SESSION_PROGRAM_ID,
    keys: [
      { pubkey: new PublicKey(accounts.config), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(accounts.item), isSigner: false, isWritable: true },
      { pubkey: renter, isSigner: true, isWritable: true },
      { pubkey: new PublicKey(accounts.session), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(accounts.rentalToken), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(accounts.escrowTokenAccount), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(accounts.escrowAuthority), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(accounts.renterTokenAccount), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(accounts.paymentMint), isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: startRentalInstructionData({
      rentalIdHash: rentProof.rentalIdHash,
      rentalSeconds: input.rentalSeconds,
    }),
  });

  const transaction = new Transaction({
    feePayer: renter,
    recentBlockhash: blockhash,
  }).add(instruction);

  return {
    rentProof,
    transactionBase64: transaction
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64"),
    blockhash,
    lastValidBlockHeight,
    cluster: SOLANA_CLUSTER,
    rpcUrl: SOLANA_RPC_URL,
  };
}
