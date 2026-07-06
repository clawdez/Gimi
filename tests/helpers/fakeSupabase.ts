// Minimal in-memory fake of the supabase-js query builder, covering exactly
// the call patterns the store uses. Lets DB-layer tests run with no network.

type Row = Record<string, unknown>;

const TABLE_DEFAULTS: Record<string, Row> = {
  items: { renter: null, rental_start: null, rental_days: null },
  rentals: {
    stripe_customer_id: null,
    stripe_payment_intent_id: null,
    stripe_payment_status: null,
    overage_payment_intent_id: null,
    overage_amount_usd: null,
    returned_at: null,
  },
  receipts: {},
};

class FakeBuilder {
  private op: "select" | "insert" | "update" = "select";
  private payload: Row | null = null;
  private filters: Array<[string, unknown]> = [];
  private orderBy: { col: string; ascending: boolean } | null = null;
  private mode: "many" | "single" | "maybeSingle" = "many";

  constructor(
    private table: string,
    private rows: Row[],
    private genId: () => string
  ) {}

  select(_cols?: string) {
    return this;
  }
  insert(payload: Row) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, ascending: opts?.ascending ?? true };
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybeSingle";
    return this;
  }

  private execute(): { data: unknown; error: { message: string } | null } {
    let matching = this.rows.filter((r) => this.filters.every(([c, v]) => r[c] === v));

    if (this.op === "insert") {
      const row: Row = {
        id: this.genId(),
        created_at: new Date().toISOString(),
        ...(this.table === "rentals" ? { rental_start: new Date().toISOString() } : {}),
        ...TABLE_DEFAULTS[this.table],
        ...this.payload,
      };
      this.rows.push(row);
      matching = [row];
    } else if (this.op === "update") {
      for (const row of matching) Object.assign(row, this.payload);
    }

    if (this.orderBy) {
      const { col, ascending } = this.orderBy;
      matching = [...matching].sort((a, b) => {
        const av = String(a[col]);
        const bv = String(b[col]);
        return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }

    if (this.mode === "single") {
      if (matching.length !== 1) {
        return { data: null, error: { message: `expected 1 row, got ${matching.length}` } };
      }
      return { data: matching[0], error: null };
    }
    if (this.mode === "maybeSingle") {
      return { data: matching[0] ?? null, error: null };
    }
    return { data: matching, error: null };
  }

  then<T>(resolve: (value: { data: unknown; error: { message: string } | null }) => T): Promise<T> {
    return Promise.resolve(this.execute()).then(resolve);
  }
}

export function createFakeSupabase(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  let idCounter = 0;
  return {
    tables,
    from(table: string) {
      if (!tables[table]) tables[table] = [];
      return new FakeBuilder(table, tables[table], () => `gen-${++idCounter}`);
    },
  };
}
