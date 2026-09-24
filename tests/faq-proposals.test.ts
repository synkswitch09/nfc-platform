import { describe, expect, it } from "vitest";
import { availableFaqProposals, faqProposals } from "@/lib/faq-proposals";

describe("FAQ proposals for an existing store", () => {
  it("keeps NFC topics out of a 3D-only storefront", () => {
    const available = availableFaqProposals(faqProposals, [], { nfc: false, print3d: true });
    expect(available.length).toBeGreaterThan(0);
    expect(available.every((item) => item.topic === "3D printing")).toBe(true);
  });

  it("does not offer existing category or general questions again", () => {
    const available = availableFaqProposals(faqProposals, [
      "  WHAT is 3d PRINTING ? ",
      "What is the difference between NFC and a QR code?",
    ], { nfc: true, print3d: true });
    expect(available.some((item) => item.question === "What is 3D printing?")).toBe(false);
    expect(available.some((item) => item.question === "What is the difference between NFC and a QR code?")).toBe(false);
  });
});
