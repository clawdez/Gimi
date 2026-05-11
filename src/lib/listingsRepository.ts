import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { PersistedListing } from "./listings";

export interface ListingsRepository {
  storageKind: string;
  listAvailable(): Promise<PersistedListing[]>;
  save(listing: PersistedListing): Promise<PersistedListing>;
  getById(id: string): Promise<PersistedListing | undefined>;
}

class FileListingsRepository implements ListingsRepository {
  readonly storageKind = process.env.VERCEL ? "file-ephemeral" : "file";

  constructor(private readonly filePath = process.env.LISTINGS_FILE_PATH ?? defaultListingsFilePath()) {}

  async listAvailable() {
    const listings = await this.readAll();
    return listings.filter((listing) => listing.status === "available");
  }

  async getById(id: string) {
    const listings = await this.readAll();
    return listings.find((listing) => listing.id === id);
  }

  async save(listing: PersistedListing) {
    const listings = await this.readAll();
    const index = listings.findIndex((entry) => entry.id === listing.id || entry.itemPda === listing.itemPda);
    const next = index >= 0 ? [...listings.slice(0, index), listing, ...listings.slice(index + 1)] : [...listings, listing];
    await this.writeAll(next);
    return listing;
  }

  private async readAll() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as PersistedListing[];
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }

  private async writeAll(listings: PersistedListing[]) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(listings, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
  }
}

let repository: ListingsRepository | undefined;

export function getListingsRepository() {
  repository ??= new FileListingsRepository();
  return repository;
}

function defaultListingsFilePath() {
  if (process.env.VERCEL) return path.join("/tmp", "tably-listings.json");
  return path.join(process.cwd(), ".rentproof", "listings.json");
}
