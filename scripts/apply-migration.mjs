// Applies supabase/migrations/*.sql to the recco project via the Supabase
// Management API, then additively exposes the `gimi` schema in PostgREST.
// Requires env: RECCO_SUPABASE_REF, SUPABASE_MGMT_TOKEN.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const REF = process.env.RECCO_SUPABASE_REF;
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!REF || !TOKEN) {
  console.error("Missing RECCO_SUPABASE_REF or SUPABASE_MGMT_TOKEN");
  process.exit(1);
}

const api = async (method, url, body) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}${url}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
};

const dir = path.join(import.meta.dirname, "..", "supabase", "migrations");
for (const file of readdirSync(dir).sort()) {
  if (!file.endsWith(".sql")) continue;
  const sql = readFileSync(path.join(dir, file), "utf8");
  console.log(`Applying ${file}...`);
  await api("POST", "/database/query", { query: sql });
}

const current = await api("GET", "/postgrest");
const schemas = current.db_schema.split(",").map((s) => s.trim());
if (!schemas.includes("gimi")) {
  const db_schema = [...schemas, "gimi"].join(",");
  console.log(`Exposing schemas: ${db_schema}`);
  await api("PATCH", "/postgrest", { db_schema });
} else {
  console.log("gimi schema already exposed");
}
console.log("Migration complete");
