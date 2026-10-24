import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ experience: vi.fn(), campaigns: vi.fn(), reviews: vi.fn() }));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@/lib/db", () => ({ db: { storeExperience: { findUnique: m.experience }, giftCampaign: { findMany: m.campaigns }, productReview: { findMany: m.reviews } } }));
import { experienceSchema, prepareExperienceSections, publicBannerGroups, type ExperienceSection } from "@/lib/store-experience";
const id = "00000000-0000-4000-8000-000000000001";
const config = experienceSchema.parse({ groups: [{ id, name: "Shared", home: true, shop: true, homePosition: 1, slides: [{ id, title: "Gift", description: "Tray", campaignKey: "launch-stands" }] }] });
const sections: ExperienceSection[] = [{ id: "hero", name: "Hero", type: "HERO", content: {} }, { id: "reviews", name: "Reviews", type: "CTA_BANNER", content: { layoutVariant: "KOSYKIN_REVIEWS", copy: "Examples", items: [{ id: "example", title: "Example", description: "Example copy" }] } }];
beforeEach(() => { vi.resetAllMocks(); m.experience.mockResolvedValue({ config }); m.campaigns.mockResolvedValue([{ key: "launch-stands", active: true, limit: 50, awardedCount: 0 }]); m.reviews.mockResolvedValue([]); });
it("uses one shared slide source with independent placement and removes paused/exhausted campaign slides", async () => {
  expect((await prepareExperienceSections("s", sections))[1].id).toBe(id);
  for (const campaign of [{ active: false, awardedCount: 1 }, { active: true, awardedCount: 50 }]) {
    m.campaigns.mockResolvedValue([{ key: "launch-stands", limit: 50, ...campaign }]); expect(await publicBannerGroups("s")).toEqual([]);
  }
});
it("hides samples when one real approved review exists, or when the CMS switch is off", async () => {
  m.reviews.mockResolvedValue([{ id: "real", displayName: "Buyer", body: "My review", rating: 3, product: { name: "Stand", slug: "stand" } }]);
  const real = (await prepareExperienceSections("s", sections)).find(s => s.id === "reviews")!;
  expect(JSON.stringify(real.content)).toContain("Verified purchase"); expect(JSON.stringify(real.content)).not.toContain("Example");
  m.reviews.mockResolvedValue([]); m.experience.mockResolvedValue({ config: { ...config, showExampleReviews: false } });
  expect((await prepareExperienceSections("s", sections)).some(s => s.id === "reviews")).toBe(false);
});
it("keeps unrelated banners when only the limited campaign ends and rejects unsafe links", async () => {
  const other = { ...config.groups[0].slides[0], id: "00000000-0000-4000-8000-000000000002", campaignKey: "" };
  m.experience.mockResolvedValue({ config: { ...config, groups: [{ ...config.groups[0], slides: [...config.groups[0].slides, other] }] } });
  m.campaigns.mockResolvedValue([]); expect((await publicBannerGroups("s"))[0].slides.map(s => s.id)).toEqual([other.id]);
  expect(experienceSchema.safeParse({ groups: [{ ...config.groups[0], slides: [{ ...other, ctaHref: "//evil.test" }] }] }).success).toBe(false);
});
