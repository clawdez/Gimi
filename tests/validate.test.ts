import { describe, expect, it } from "vitest";
import { asEmail, asInt, asStr, readJson } from "@/lib/validate";

describe("asStr", () => {
  it("accepts strings within bounds and trims", () => {
    expect(asStr("  DeWalt  ", { max: 80 })).toBe("DeWalt");
  });
  it("rejects non-strings, empty, and too-long values", () => {
    expect(asStr(42, { max: 80 })).toBeNull();
    expect(asStr("", { max: 80 })).toBeNull();
    expect(asStr("   ", { max: 80 })).toBeNull();
    expect(asStr("x".repeat(81), { max: 80 })).toBeNull();
  });
  it("allows empty when optional", () => {
    expect(asStr(undefined, { max: 80, optional: true })).toBe("");
  });
});

describe("asInt", () => {
  it("accepts integers in range (also numeric strings)", () => {
    expect(asInt(3, { min: 1, max: 30 })).toBe(3);
    expect(asInt("7", { min: 1, max: 30 })).toBe(7);
  });
  it("rejects out-of-range, non-numeric, and non-integer values", () => {
    expect(asInt(0, { min: 1, max: 30 })).toBeNull();
    expect(asInt(31, { min: 1, max: 30 })).toBeNull();
    expect(asInt(2.5, { min: 1, max: 30 })).toBeNull();
    expect(asInt("abc", { min: 1, max: 30 })).toBeNull();
    expect(asInt(NaN, { min: 1, max: 30 })).toBeNull();
    expect(asInt(Infinity, { min: 1, max: 30 })).toBeNull();
  });
});

describe("asEmail", () => {
  it("accepts a normal email", () => {
    expect(asEmail("Renter@Example.com")).toBe("renter@example.com");
  });
  it("rejects garbage", () => {
    expect(asEmail("not-an-email")).toBeNull();
    expect(asEmail(123)).toBeNull();
    expect(asEmail("a@b")).toBeNull();
  });
});

describe("readJson", () => {
  it("returns parsed body for valid JSON", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
      headers: { "Content-Type": "application/json" },
    });
    expect(await readJson(req)).toEqual({ a: 1 });
  });
  it("returns null for invalid JSON and non-object bodies", async () => {
    const bad = new Request("http://x", { method: "POST", body: "{oops" });
    expect(await readJson(bad)).toBeNull();
    const arr = new Request("http://x", { method: "POST", body: "[1,2]" });
    expect(await readJson(arr)).toBeNull();
  });
});
