import { describe, expect, it } from "vitest";
import { defaultEmailTemplate, emailTemplateKeys, getEmailTemplateEntry, orderNoticeTemplate, parseEmailTemplates, renderEmailTemplate, safeEmailUrl, sampleEmailData, validateEmailTemplate } from "@/lib/email-templates";

describe("store email templates", () => {
  it("renders every standard notification with essential details and a text alternative", () => {
    for (const key of emailTemplateKeys) {
      const template = defaultEmailTemplate(key);
      expect(validateEmailTemplate(key, template).success).toBe(true);
      const data = sampleEmailData(key, "Kosykin", "https://kosykin.com.au");
      const result = renderEmailTemplate(template, data);
      expect(result.text).toContain(data.message);
      expect(result.html).toContain("Kosykin");
      expect(result.text).toContain("https://kosykin.com.au/support");
      expect(result.html).not.toContain("{{");
      if (!["password-reset", "team-invitation"].includes(key)) expect(result.html).not.toContain("Continue securely");
    }
  });
  it("escapes CMS text and customer values rather than executing uploaded HTML", () => {
    const template = { ...defaultEmailTemplate("payment"), blocks: [{ type: "text" as const, text: '<img src=x onerror="alert(1)"> {{customer.name}}' }] };
    const result = renderEmailTemplate(template, { storeName: "Kosykin", customerName: '<script>alert("x")</script>', subject: "Paid", message: "Tracking <123> & payment", origin: "https://kosykin.com.au" });
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).toContain("&lt;img");
    expect(result.html).not.toContain("<script>");
    expect(result.html).not.toContain('<img src=x');
    expect(result.html).toContain("Tracking &lt;123&gt; &amp; payment");
  });
  it("keeps verification codes, reset links and support instructions with an empty custom body", () => {
    const template = { ...defaultEmailTemplate("password-reset"), blocks: [] };
    const data = { ...sampleEmailData("password-reset", "Tapkin", "https://tapkin.com.au"), message: "Code: 908172. Reset instructions cannot be removed." };
    const result = renderEmailTemplate(template, data);
    expect(result.html).toContain("908172");
    expect(result.html).toContain('href="https://tapkin.com.au/reset-password?token=preview-only"');
    expect(result.text).toContain("Replies to this address are not monitored");
  });
  it("rejects script URLs, credentials, protocol-relative images and invalid dynamic fields", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,hi", "//evil.example/x", "https://user:password@example.test/x"]) {
      expect(safeEmailUrl(url, "https://kosykin.com.au")).toBeNull();
      expect(validateEmailTemplate("payment", { ...defaultEmailTemplate("payment"), blocks: [{ type: "button", text: "Go", url }] }).success).toBe(false);
    }
    for (const text of ["{{secret}}", "{{customer.name", "{{account.code}}", "{{order.number}}}"]) expect(validateEmailTemplate("payment", { ...defaultEmailTemplate("payment"), preheader: text }).success).toBe(false);
    expect(validateEmailTemplate("payment", { ...defaultEmailTemplate("payment"), blocks: [{ type: "image", url: "//evil.example/image.png", alt: "bad" }] }).success).toBe(false);
    expect(validateEmailTemplate("payment", { ...defaultEmailTemplate("payment"), subject: "Fake\nBcc: other@test" }).success).toBe(false);
    expect(validateEmailTemplate("payment", { ...defaultEmailTemplate("payment"), accent: 'red; background:url(x)' }).success).toBe(false);
  });
  it("resolves store media and dynamic buttons without mixing store origins", () => {
    const template = { ...defaultEmailTemplate("payment"), blocks: [{ type: "image" as const, url: "/images/logo.png", alt: "Logo" }, { type: "button" as const, text: "Help", url: "{{store.helpUrl}}" }] };
    expect(validateEmailTemplate("payment", template).success).toBe(true);
    const result = renderEmailTemplate(template, sampleEmailData("payment", "Kosykin", "https://staging.kosykin.com.au"));
    expect(result.html).toContain('src="https://staging.kosykin.com.au/images/logo.png"');
    expect(result.html).toContain('href="https://staging.kosykin.com.au/support"');
    expect(result.html).not.toContain("tapkin.com.au");
    const unsafe = renderEmailTemplate({ ...template, blocks: [{ type: "button", text: "Reset", url: "{{account.actionUrl}}" }] }, { ...sampleEmailData("password-reset", "Tapkin", "https://tapkin.com.au"), fields: { "account.actionUrl": 'javascript:alert("unsafe")' } });
    expect(unsafe.html).not.toContain('href="javascript:');
  });
  it("ignores corrupt templates while retaining healthy drafts and distinguishing published content", () => {
    const entry = { draft: defaultEmailTemplate("verification"), published: null, revision: 1, updatedAt: "2026-10-10", publishedAt: null };
    const templates = parseEmailTemplates({ verification: entry, payment: { ...entry, draft: { ...entry.draft, subject: "{{unknown}}" } } });
    expect(templates.verification?.published).toBeNull();
    expect(templates.payment).toBeUndefined();
    expect(getEmailTemplateEntry(templates, "payment").revision).toBe(0);
  });
  it("selects templates by durable event type and distinguishes production files from customer confirmations", () => {
    const expected = [["paid:o", "payment"], ["refund:r", "refund"], ["support:s", "support"], ["next-purchase:o", "reward"], ["production-date:o", "dispatch-estimate"], ["delivered:h", "delivered"]];
    for (const [key, result] of expected) expect(orderNoticeTemplate(key)).toBe(result);
    expect(orderNoticeTemplate("status:h", "Kosykin K1: Your order has shipped")).toBe("shipped");
    expect(orderNoticeTemplate("paid:o", "Paid", true)).toBe("operations");
  });
});
