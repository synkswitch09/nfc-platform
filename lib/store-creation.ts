import { DeploymentEnvironment, StoreCapability } from "@prisma/client";
import { z } from "zod";

export const createStoreSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens").max(50),
  hostname: z.string().trim().toLowerCase().max(253).refine(
    (value) => value.length > 3 && value.split(".").length >= 2 &&
      value.split(".").every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)) &&
      !/^\d+$/.test(value.split(".").at(-1) ?? ""),
    "Enter a valid domain without https:// or a path",
  ),
  supportEmail: z.string().trim().email().max(254),
  capabilities: z.array(z.nativeEnum(StoreCapability)).min(1).max(Object.values(StoreCapability).length)
    .refine((items) => new Set(items).size === items.length, "Select each capability only once")
    .refine((items) => !items.includes(StoreCapability.NFC) || items.includes(StoreCapability.DIGITAL_PROFILE), "NFC requires digital profiles"),
});

export function newStoreData(value: z.infer<typeof createStoreSchema>, environment: DeploymentEnvironment) {
  return {
    slug: value.slug,
    name: value.name,
    displayName: value.name,
    supportEmail: value.supportEmail,
    seoTitle: value.name,
    seoDescription: `Explore products from ${value.name}.`,
    organization: { type: "Organization", name: value.name },
    homepage: {
      variant: "editorial", heroEyebrow: value.name,
      heroHeadline: `Welcome to ${value.name}`,
      heroDescription: `Discover products from ${value.name}.`,
      primaryCtaLabel: "Shop products", primaryCtaHref: "/shop",
    },
    capabilities: value.capabilities,
    // Keep an empty store offline until its content, DNS and payments are checked.
    status: "DRAFT" as const,
    domains: { create: { hostname: value.hostname, environment, protocol: "https", isPrimary: true } },
  };
}
