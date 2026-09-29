import { beforeEach, describe, expect, it } from "vitest";
import { codeChallenge, createOAuthTransaction, readOAuthTransaction } from "@/lib/oauth";

describe("OAuth transaction protection", () => {
  const store = { id: "00000000-0000-4000-8000-000000000001", origin: "https://tapkin.com.au" };
  beforeEach(() => { process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters"; });
  it("round-trips signed state and constrains the return path", async () => {
    const transaction = createOAuthTransaction("google", "https://evil.example", store);
    expect(readOAuthTransaction(transaction.cookie)).toMatchObject({ provider: "google", state: transaction.value.state, next: "/dashboard", storeId: store.id, origin: store.origin });
    expect(await codeChallenge(transaction.value.verifier)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("rejects a tampered transaction", () => {
    const transaction = createOAuthTransaction("apple", "/checkout", store);
    expect(readOAuthTransaction(`${transaction.cookie.slice(0, -1)}x`)).toBeNull();
    expect(readOAuthTransaction(`${transaction.cookie}.ignored`)).toBeNull();
  });
});
