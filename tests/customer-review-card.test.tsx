import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerReviewCard } from "@/components/customer-review-card";
import { KosykinHomeSection } from "@/components/kosykin-home-section";
import { validateLandingSections } from "@/lib/landing-sections";

describe("Customer review cards", () => {
  it("renders the supplied product, real score, quote and author in reference order", () => {
    const html = renderToStaticMarkup(<CustomerReviewCard productName="Wavy Multi Stand" rating={4.9} body="Such a simple piece." author="Mike Taylor" />);
    expect(html.indexOf("Wavy Multi Stand")).toBeLessThan(html.indexOf("4.9 out of 5 stars"));
    expect(html.indexOf("4.9 out of 5 stars")).toBeLessThan(html.indexOf("Such a simple piece."));
    expect(html.indexOf("Such a simple piece.")).toBeLessThan(html.indexOf("Mike Taylor"));
    expect(html).toContain("★★★★☆");
    expect(html).toContain("“Such a simple piece.”");
    expect(html).not.toContain("<img");
  });
  it("keeps CMS rating/product fields and never invents missing scores", () => {
    const section = validateLandingSections([{ type: "FEATURE_BADGES", name: "Reviews", visible: true, content: { layoutVariant: "KOSYKIN_REVIEWS", items: [{ title: "Buyer", description: "Lovely stand", productName: "Wavy Stand", rating: 4 }] } }])[0];
    const html = renderToStaticMarkup(<KosykinHomeSection type="FEATURE_BADGES" value={section.content} products={[]} currency="AUD" />);
    expect(html).toContain("Wavy Stand");
    expect(html).toContain("4.0");
    const example = renderToStaticMarkup(<CustomerReviewCard body="Example text" author="Example review" supportingText="Illustrative text" />);
    expect(example).not.toContain("kosy-review-rating");
    expect(example).toContain("Illustrative text");
  });
});
