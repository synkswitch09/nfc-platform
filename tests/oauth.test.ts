import { beforeEach, describe, expect, it } from "vitest";
import { codeChallenge, createOAuthTransaction, readOAuthTransaction } from "@/lib/oauth";

describe("OAuth transaction protection", () => {
  beforeEach(() => { process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters"; });
  it("round-trips signed state and constrains the return path", () => {
    const transaction = createOAuthTransaction("google", "https://evil.example");
    expect(readOAuthTransaction(transaction.cookie)).toMatchObject({ provider: "google", state: transaction.value.state, next: "/dashboard" });
    expect(codeChallenge(transaction.value.verifier)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("rejects a tampered transaction", () => {
    const transaction = createOAuthTransaction("apple", "/checkout");
    expect(readOAuthTransaction(`${transaction.cookie.slice(0, -1)}x`)).toBeNull();
  });
});
