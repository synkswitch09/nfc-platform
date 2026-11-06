import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { validateCampaignSend } from "@/lib/assistants/growth/campaigns";
const campaignId = "916cad1a-07b8-4fa8-9315-7c1ef1fd88ae",
  contactId = "716cad1a-07b8-4fa8-9315-7c1ef1fd88ae",
  conversationId = "616cad1a-07b8-4fa8-9315-7c1ef1fd88ae",
  reference = { campaignId, contactId, version: 1 };
function client() {
  return {
    assistantResource: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce({
          id: campaignId,
          data: {
            objective: "Answer product enquiries",
            channel: "CHAT",
            contactIds: [contactId],
          },
        })
        .mockResolvedValueOnce({
          id: contactId,
          data: {
            name: "Customer",
            conversationId,
            consent: {
              channel: "CHAT",
              evidence: "Requested follow-up about their quote",
              at: "2026-11-08T00:00:00Z",
              expiresAt: null,
            },
          },
        }),
    },
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-09T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());
it("lets an owner prepare future replies outside customer contact hours", async () => {
  await expect(
    validateCampaignSend(
      client() as never,
      "business",
      conversationId,
      reference,
      false,
    ),
  ).resolves.toBeUndefined();
});
it("still blocks an actual campaign send outside local contact hours", async () => {
  await expect(
    validateCampaignSend(
      client() as never,
      "business",
      conversationId,
      reference,
    ),
  ).rejects.toThrow("local weekdays");
});
