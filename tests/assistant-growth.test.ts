import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  contactSchema,
  campaignSchema,
  contentSchema,
  localeSchema,
  languageInstructions,
} from "@/lib/assistants/growth/schema";
import { boundedJson } from "@/lib/assistants/growth/body";
import {
  assertCallbackEligible,
  assertMarketingConsent,
  voiceSettingsSchema,
} from "@/lib/assistants/voice/policy";
import { validVoiceSignature, eleven } from "@/lib/assistants/voice/provider";
import { validatePublication } from "@/lib/assistants/content/publishing";
import { anthropicProvider } from "@/lib/assistants/providers";
import { assistantConfig } from "@/lib/assistants/config";
const now = new Date("2026-11-09T01:30:00Z");
const person = contactSchema.parse({
  name: "Customer",
  phone: "+61412345678",
  consent: {
    channel: "VOICE",
    evidence: "Requested a product callback in our contact form",
    at: "2026-11-08T00:00:00Z",
    expiresAt: null,
  },
});
const settings = voiceSettingsSchema.parse({
  phoneNumberId: "line_1",
  enabled: true,
  monthlyMinuteLimit: 30,
  legalReviewUntil: "2026-12-01T00:00:00Z",
  holidayCalendarUntil: "2026-12-31",
  holidays: [],
  reviewEvidence: "Legal review document 001",
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("growth data and locale boundaries", () => {
  it.each(["en-AU", "es-CO", "ar", "ja"])(
    "accepts preferred language %s",
    (preferredLanguage) =>
      expect(
        localeSchema.parse({
          preferredLanguage,
          preferredCountry: "AU",
          timeZone: "Australia/Adelaide",
        }).preferredLanguage,
      ).toBe(preferredLanguage),
  );
  it.each(["english please", "en<script>"])(
    "rejects invalid language %s",
    (preferredLanguage) =>
      expect(() =>
        localeSchema.parse({
          preferredLanguage,
          preferredCountry: "AU",
          timeZone: "Australia/Adelaide",
        }),
      ).toThrow(),
  );
  it("rejects nonexistent time zones", () =>
    expect(() =>
      localeSchema.parse({
        preferredLanguage: "es",
        preferredCountry: "CO",
        timeZone: "Bogota",
      }),
    ).toThrow());
  it("does not invent a confirmed sale", () => {
    expect(() =>
      contactSchema.parse({ name: "Customer", stage: "WON" }),
    ).toThrow();
    expect(
      contactSchema.parse({
        name: "Customer",
        stage: "WON",
        outcomeEvidence: "Order 123 confirmed by business",
      }).stage,
    ).toBe("WON");
  });
  it("defaults a new contact to no marketing permission", () =>
    expect(contactSchema.parse({ name: "Customer" }).consent.channel).toBe(
      "NONE",
    ));
  it("rejects injected billing and tenant fields", () =>
    expect(() =>
      campaignSchema.parse({
        objective: "Get enquiries",
        workspaceId: "other",
        billingExempt: true,
      }),
    ).toThrow());
  it("adapts language without interpreting it as consent", () => {
    const prompt = languageInstructions({
      preferredLanguage: "es-CO",
      preferredCountry: "AU",
    });
    expect(prompt).toContain("es-CO");
    expect(prompt).toContain("latest message");
    expect(prompt).toContain("permission");
  });
});
describe("callback eligibility", () => {
  it("permits a documented callback in approved local hours", () =>
    expect(() => assertCallbackEligible(person, settings, now)).not.toThrow());
  it.each([
    "2026-11-08T01:30:00Z",
    "2026-11-09T20:30:00Z",
    "2026-11-09T06:30:00Z",
  ])("blocks weekend or out-of-hours at %s", (value) =>
    expect(() =>
      assertCallbackEligible(person, settings, new Date(value)),
    ).toThrow(),
  );
  it("applies the recipient holiday calendar", () =>
    expect(() =>
      assertCallbackEligible(
        person,
        { ...settings, holidays: ["2026-11-09"] },
        now,
      ),
    ).toThrow());
  it("blocks expired calendar coverage and compliance review", () => {
    expect(() =>
      assertCallbackEligible(
        person,
        { ...settings, holidayCalendarUntil: "2026-11-08" },
        now,
      ),
    ).toThrow();
    expect(() =>
      assertCallbackEligible(
        person,
        { ...settings, legalReviewUntil: now.toISOString() },
        now,
      ),
    ).toThrow();
  });
  it("blocks opt-out even with documented consent", () =>
    expect(() =>
      assertCallbackEligible({ ...person, optedOut: true }, settings, now),
    ).toThrow());
  it("does not convert chat permission into voice permission", () =>
    expect(() =>
      assertCallbackEligible(
        { ...person, consent: { ...person.consent, channel: "CHAT" } },
        settings,
        now,
      ),
    ).toThrow());
  it("rejects future and expired permission", () => {
    expect(() =>
      assertMarketingConsent(
        {
          ...person,
          consent: { ...person.consent, at: "2026-11-10T00:00:00Z" },
        },
        "VOICE",
        now,
      ),
    ).toThrow();
    expect(() =>
      assertMarketingConsent(
        {
          ...person,
          consent: { ...person.consent, expiresAt: now.toISOString() },
        },
        "VOICE",
        now,
      ),
    ).toThrow();
  });
  it("uses a conservative 90-day expiry if none is recorded", () =>
    expect(() =>
      assertMarketingConsent(
        {
          ...person,
          consent: { ...person.consent, at: "2026-06-01T00:00:00Z" },
        },
        "VOICE",
        now,
      ),
    ).toThrow());
  it("requires the contact location to match the phone and time zone", () => {
    expect(() =>
      assertCallbackEligible({ ...person, country: "CO" }, settings, now),
    ).toThrow();
    expect(() =>
      assertCallbackEligible(
        { ...person, timeZone: "Europe/London" },
        settings,
        now,
      ),
    ).toThrow();
  });
  it("handles Colombian local hours rather than the business time zone", () => {
    const colombian = {
      ...person,
      country: "CO",
      phone: "+573001234567",
      timeZone: "America/Bogota",
    };
    expect(() =>
      assertCallbackEligible(
        colombian,
        settings,
        new Date("2026-11-09T16:00:00Z"),
      ),
    ).not.toThrow();
    expect(() => assertCallbackEligible(colombian, settings, now)).toThrow();
  });
  it("cannot call with zero allowance or a paused line", () => {
    expect(() =>
      assertCallbackEligible(
        person,
        { ...settings, monthlyMinuteLimit: 0 },
        now,
      ),
    ).toThrow();
    expect(() =>
      assertCallbackEligible(person, { ...settings, enabled: false }, now),
    ).toThrow();
  });
});
describe("signed voice callbacks and provider containment", () => {
  const raw = '{"type":"post_call_transcription"}',
    secret = "private-webhook-secret",
    timestamp = String(now.getTime() / 1000),
    signature = `t=${timestamp},v0=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`;
  it("accepts an authentic recent signature only", () => {
    expect(validVoiceSignature(raw, signature, secret, +now)).toBe(true);
    expect(validVoiceSignature(raw + " ", signature, secret, +now)).toBe(false);
    expect(validVoiceSignature(raw, signature, "wrong", +now)).toBe(false);
    expect(validVoiceSignature(raw, signature, secret, +now + 301000)).toBe(
      false,
    );
    expect(validVoiceSignature(raw, "t=abc,v0=x", secret, +now)).toBe(false);
  });
  it("keeps unconfigured voice off", async () => {
    vi.stubEnv("AI_ASSISTANTS_VOICE_ENABLED", "false");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(eleven("/v1/voices")).rejects.toThrow("setup");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects arbitrary API paths without sending credentials", async () => {
    vi.stubEnv("AI_ASSISTANTS_VOICE_ENABLED", "true");
    vi.stubEnv("ELEVENLABS_API_KEY", "private");
    vi.stubEnv("ELEVENLABS_WEBHOOK_SECRET", "secret");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(eleven("https://evil.example")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
describe("media and request validation", () => {
  const content = contentSchema.parse({
    format: "POST",
    channel: "INSTAGRAM",
    brief: "Local business",
    caption: "Hello",
    mediaUrls: ["https://example.com/photo.jpg"],
  });
  it("requires media and reviewed format compatibility", () => {
    expect(() => validatePublication(content)).not.toThrow();
    expect(() => validatePublication({ ...content, mediaUrls: [] })).toThrow();
    expect(() =>
      validatePublication({ ...content, format: "CAROUSEL" }),
    ).toThrow();
    expect(() => validatePublication({ ...content, format: "REEL" })).toThrow();
    expect(() => validatePublication({ ...content, video: true })).toThrow();
  });
  it.each([
    "https://localhost/file.jpg",
    "https://127.0.0.1/file.jpg",
    "https://user:pass@example.com/photo.jpg",
    "https://example.com:9000/photo.jpg",
  ])("rejects unsafe media address %s", (url) =>
    expect(() =>
      validatePublication({ ...content, mediaUrls: [url] }),
    ).toThrow(),
  );
  it("surfaces unsupported Facebook Stories instead of silently publishing a post", () =>
    expect(() =>
      validatePublication({ ...content, channel: "FACEBOOK", format: "STORY" }),
    ).toThrow("Stories"));
  it("bounds a chunked body before parsing and rejects malformed JSON", async () => {
    await expect(
      boundedJson(
        new Request("https://example.test", {
          method: "POST",
          body: "123456789",
        }),
        4,
      ),
    ).rejects.toThrow("large");
    await expect(
      boundedJson(
        new Request("https://example.test", { method: "POST", body: "{" }),
      ),
    ).rejects.toThrow("JSON");
  });
});
describe("Claude-only research", () => {
  it("enables at most two searches and returns cited sources", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          content: [
            {
              type: "text",
              text: "Evidence",
              citations: [
                {
                  type: "web_search_result_location",
                  url: "https://example.com/report",
                  title: "Report",
                },
              ],
            },
          ],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      );
    const result = await anthropicProvider("key", request).reply(
      assistantConfig({}).models[0],
      {
        system: "Research",
        messages: [{ role: "user", content: "Local niche" }],
        research: true,
      },
    );
    expect(JSON.parse(request.mock.calls[0][1].body).tools).toEqual([
      { type: "web_search_20250305", name: "web_search", max_uses: 2 },
    ]);
    expect(result.sources).toEqual([
      { url: "https://example.com/report", title: "Report" },
    ]);
  });
});
