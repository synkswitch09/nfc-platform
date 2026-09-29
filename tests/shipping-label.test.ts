import { describe, expect, it } from "vitest";
import { createShippingLabelPdf } from "@/lib/pdf-label";
import { createDocumentStorageKey, isSafeStorageKey, storageKeyEnvironment, storageKeyStore } from "@/lib/storage/keys";

describe("private shipping labels", () => {
  it("creates a compact valid PDF without embedding control characters", () => {
    const pdf = createShippingLabelPdf(["Tapkin", "Order TK-123", "Recipient (test)", "line\nnot allowed"]);
    expect(Buffer.from(pdf).subarray(0, 8).toString()).toBe("%PDF-1.4");
    expect(Buffer.from(pdf).toString("ascii")).toContain("Recipient \\(test\\)");
    expect(Buffer.from(pdf).toString("ascii")).not.toContain("line\nnot allowed");
  });

  it("uses environment and Store-scoped document keys", () => {
    const key = createDocumentStorageKey("development", "tapkin", "00000000-0000-4000-8000-000000000001", "pdf");
    expect(isSafeStorageKey(key)).toBe(true);
    expect(storageKeyEnvironment(key)).toBe("development");
    expect(storageKeyStore(key)).toBe("tapkin");
    expect(isSafeStorageKey("../../shipping-label.pdf")).toBe(false);
  });
});
