// Minimal input validation for API route boundaries.

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function asStr(
  value: unknown,
  opts: { max: number; optional?: boolean }
): string | null {
  if (value === undefined || value === null) return opts.optional ? "" : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > opts.max) return null;
  if (trimmed.length === 0) return opts.optional ? "" : null;
  return trimmed;
}

export function asInt(value: unknown, opts: { min: number; max: number }): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n)) return null;
  if (n < opts.min || n > opts.max) return null;
  return n;
}

export function asEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}
