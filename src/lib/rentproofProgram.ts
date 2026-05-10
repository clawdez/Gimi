import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";

export const RENTAL_SESSION_PROGRAM_ID = new PublicKey("AVL316tYxrg8MhEeWtaxbwdShMWybzRAH1zNQWvX355K");
export const DEMO_OWNER_WALLET = new PublicKey("7Fmr5t2h2SZ55n4w3dkgWTjaXRafDnBLLy1RhdmPJk6b");
export const DEMO_RENTER_WALLET = new PublicKey("5pNLovuXAbyKM8UGDKZg9Qqe85Sqt1kMPNaippombvwC");
export const DEMO_FEE_AUTHORITY = new PublicKey("AWesFzR3x97q5QWk6MBxLU8kRGZcuobtKuoABtMiHWH1");
export const DEMO_USDC_MINT = new PublicKey("FGzrpZ3DnvoeQj2au9g4cMoawrvoyRdgn51yXDtHqQzp");

export const PLATFORM_FEE_BPS = 500;
export const USDC_DECIMALS = 6;
export const AUTO_BUYOUT_GRACE_SECONDS = 60 * 60;

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
      owner: owner.toBase58(),
      renter: renter.toBase58(),
      feeAuthority: DEMO_FEE_AUTHORITY.toBase58(),
      paymentMint: paymentMint.toBase58(),
    },
  };
}
