import type { ZodIssue } from "zod";

export type ProductValidationFeedback = {
  path: string;
  field: string;
  section: "product-details" | "shipping" | "variants" | "choices" | "search";
  message: string;
};

const rootFields: Record<string, { field: string; section: ProductValidationFeedback["section"] }> = {
  name: { field: "Product name", section: "product-details" },
  slug: { field: "Product URL", section: "product-details" },
  description: { field: "Short description", section: "product-details" },
  fullDescription: { field: "Full description", section: "product-details" },
  categoryId: { field: "Category", section: "product-details" },
  brand: { field: "Brand", section: "product-details" },
  personalisationMode: { field: "Personalisation purchase mode", section: "choices" },
  weightGrams: { field: "Product weight", section: "shipping" },
  lengthMm: { field: "Product length", section: "shipping" },
  widthMm: { field: "Product width", section: "shipping" },
  heightMm: { field: "Product height", section: "shipping" },
  countryOfOrigin: { field: "Country of origin", section: "shipping" },
  customsDescription: { field: "Customs description", section: "shipping" },
  hsCode: { field: "HS code", section: "shipping" },
  seoTitle: { field: "SEO title", section: "search" },
  seoDescription: { field: "Meta description", section: "search" },
  canonicalUrl: { field: "Canonical URL", section: "search" },
  ogImageUrl: { field: "Social image", section: "search" },
};

function issueText(issue: ZodIssue, field: string) {
  if (issue.code === "too_small") {
    const minimum = "minimum" in issue ? issue.minimum : null;
    return `${field} must contain at least ${minimum} character${minimum === 1 ? "" : "s"}.`;
  }
  if (issue.code === "too_big") {
    const maximum = "maximum" in issue ? issue.maximum : null;
    return `${field} must contain no more than ${maximum} characters.`;
  }
  if (issue.code === "invalid_format") return `${field} has an invalid format.`;
  return issue.message || `${field} is invalid.`;
}

export function productValidationFeedback(issues: ZodIssue[]): ProductValidationFeedback[] {
  return issues.map((issue) => {
    const path = issue.path.map(String);
    const key = path.join(".");
    if (path[0] === "variants") {
      const number = Number(path[1]) + 1;
      const label = path[2] === "optionSelection" ? "product choices" : path[2] === "sku" ? "SKU" : path[2] === "name" ? "name" : path[2] === "inventory" ? "stock" : path[2] === "priceCents" ? "price" : String(path[2] ?? "details");
      const field = `Variant ${number} — ${label}`;
      return { path: key, field, section: "variants", message: issueText(issue, field) };
    }
    if (path[0] === "options") {
      const number = Number(path[1]) + 1;
      const label = path[2] === "values" ? `choice ${Number(path[3]) + 1}` : path[2] === "code" ? "code" : path[2] === "name" ? "label" : String(path[2] ?? "details");
      const field = `Product choice ${number} — ${label}`;
      return { path: key, field, section: "choices", message: issueText(issue, field) };
    }
    const root = rootFields[path[0]] ?? { field: path[0] || "Product", section: "product-details" as const };
    return { path: key, field: root.field, section: root.section, message: issueText(issue, root.field) };
  });
}
