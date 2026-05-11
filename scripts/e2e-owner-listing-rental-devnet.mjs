import { readFileSync } from "node:fs";
import { Connection, Keypair, Transaction } from "@solana/web3.js";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const ownerPath = process.env.RENT_PROOF_OWNER_KEYPAIR ?? "/tmp/rentchain-anchor/owner.json";
const renterPath = process.env.RENT_PROOF_RENTER_KEYPAIR ?? "/tmp/rentchain-anchor/renter.json";

function loadKeypair(path) {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

async function jsonFetch(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function signSimulateSend(connection, transactionBase64, signer, label) {
  const transaction = Transaction.from(Buffer.from(transactionBase64, "base64"));
  transaction.partialSign(signer);

  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err) {
    throw new Error(`${label} simulation failed: ${JSON.stringify(simulation.value.err)} logs=${JSON.stringify(simulation.value.logs)}`);
  }

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    {
      signature,
      blockhash: transaction.recentBlockhash,
      lastValidBlockHeight: Number.MAX_SAFE_INTEGER,
    },
    "confirmed"
  );
  return signature;
}

async function main() {
  const connection = new Connection(rpcUrl, "confirmed");
  const owner = loadKeypair(ownerPath);
  const renter = loadKeypair(renterPath);
  const unique = Date.now().toString(36);

  console.log(`baseUrl=${baseUrl}`);
  console.log(`rpc=${rpcUrl}`);
  console.log(`owner=${owner.publicKey.toBase58()}`);
  console.log(`renter=${renter.publicKey.toBase58()}`);

  const preparedListing = await jsonFetch("/api/solana-pay/initialize-item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ownerWallet: owner.publicKey.toBase58(),
      name: `E2E Power Bank ${unique}`,
      brand: "Anker",
      model: "Devnet Smoke",
      category: "Power",
      condition: 9,
      description: "End-to-end devnet listing created by the Tably smoke test.",
      imageUrl: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=900&h=700&fit=crop",
      locationLabel: "Devnet table",
      included: ["USB-C cable"],
      ratePerHour: 2,
      minimumFee: 3,
      buyoutCap: 30,
      autoBuyoutGraceSeconds: 3600,
    }),
  });

  const initializeSignature = await signSimulateSend(
    connection,
    preparedListing.transaction,
    owner,
    "initialize_item"
  );
  console.log(`initialize_item_signature=${initializeSignature}`);

  const published = await jsonFetch("/api/listings/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      draftId: preparedListing.draftId,
      initializeSignature,
      listingPreview: preparedListing.listingPreview,
    }),
  });
  console.log(`published_item=${published.listing.id}`);
  console.log(`item_pda=${published.listing.itemPda}`);

  const listings = await jsonFetch("/api/listings");
  const listedItem = listings.inventory.find((item) => item.id === published.listing.id);
  if (!listedItem) throw new Error("Published listing did not appear in renter inventory.");
  console.log(`inventory_storage=${listings.storage}`);
  console.log(`inventory_match=${listedItem.name}`);

  const preparedRental = await jsonFetch("/api/solana-pay/start-rental", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      itemId: published.listing.id,
      renterWallet: renter.publicKey.toBase58(),
      hours: 1,
    }),
  });
  if (!preparedRental.preflight?.ok) throw new Error(`Rental preflight was not ok: ${JSON.stringify(preparedRental.preflight)}`);
  console.log(`rental_preflight_ok=${preparedRental.preflight.ok}`);
  console.log(`renter_usdc=${preparedRental.preflight.tokenAccounts.renter.uiAmount}`);

  const startSignature = await signSimulateSend(
    connection,
    preparedRental.transaction,
    renter,
    "start_rental"
  );
  console.log(`start_rental_signature=${startSignature}`);
  console.log(`explorer_start=https://explorer.solana.com/tx/${startSignature}?cluster=devnet`);

  const recordedRental = await jsonFetch("/api/rentals/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      itemId: published.listing.id,
      rentalId: preparedRental.draftId,
      renterWallet: renter.publicKey.toBase58(),
      startSignature,
    }),
  });
  console.log(`recorded_session=${recordedRental.rentalSession.sessionPda}`);
  console.log(`listing_status=${recordedRental.listing?.status}`);

  const inventoryAfterStart = await jsonFetch("/api/listings");
  const stillAvailable = inventoryAfterStart.inventory.some((item) => item.id === published.listing.id && item.status === "available");
  if (stillAvailable) throw new Error("Started rental is still available in renter inventory.");
  console.log(`inventory_after_start_storage=${inventoryAfterStart.storage}`);
  console.log("inventory_removed_after_start=true");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
