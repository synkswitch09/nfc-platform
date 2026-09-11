import { cache } from "react";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { DeploymentEnvironment, Prisma, StoreCapability, StoreStatus } from "@prisma/client";
import { z } from "zod";
import { currentAppEnvironment, getRuntimeConfig, type AppEnvironment } from "@/lib/config";
import { db } from "@/lib/db";

export const TAPKIN_STORE_ID = "00000000-0000-4000-8000-000000000001";

const themeSchema = z.object({
  accent: z.string().regex(/^#[0-9a-f]{6}$/i).default("#ee6c4d"),
  accentSecondary: z.string().regex(/^#[0-9a-f]{6}$/i).default("#2f7f77"),
  background: z.string().regex(/^#[0-9a-f]{6}$/i).default("#f7f3eb"),
  foreground: z.string().regex(/^#[0-9a-f]{6}$/i).default("#14213d"),
  radius: z.string().regex(/^\d+(?:\.\d+)?(?:px|rem)$/).default("1.25rem"),
  fontStyle: z.enum(["editorial", "modern", "technical"]).default("editorial"),
});

const homepageSchema = z.object({
  variant: z.enum(["tapkin", "home-demo", "editorial"]).default("editorial"),
  heroEyebrow: z.string().trim().max(100).default("Thoughtfully made"),
  heroHeadline: z.string().trim().max(180).default("Useful products for everyday life"),
  heroDescription: z.string().trim().max(360).default("Designed with care and made for real life."),
  primaryCtaLabel: z.string().trim().max(50).default("Shop products"),
  primaryCtaHref: z.string().regex(/^\/(?!\/)/).default("/shop"),
});

type StoreWithDomains = Prisma.StoreGetPayload<{ include: { domains: true } }>;

export type StorefrontTheme = z.infer<typeof themeSchema>;
export type StorefrontHomepage = z.infer<typeof homepageSchema>;
export type Storefront = {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  legalName: string | null;
  status: StoreStatus;
  logoUrl: string | null;
  faviconUrl: string | null;
  supportEmail: string;
  country: string;
  currency: string;
  timezone: string;
  theme: StorefrontTheme;
  homepage: StorefrontHomepage;
  seoTitle: string;
  seoDescription: string;
  socialImageUrl: string | null;
  organization: Record<string, unknown>;
  socialLinks: Record<string, string>;
  shippingConfig: { flatRateCents: number; freeOverCents: number };
  capabilities: StoreCapability[];
  paymentProfileKey: string | null;
  hostname: string;
  origin: string;
  environment: DeploymentEnvironment;
};

export class UnknownStorefrontError extends Error {
  constructor(readonly hostname: string) {
    super(`No store is configured for host ${hostname}`);
  }
}

export function deploymentEnvironment(environment: AppEnvironment): DeploymentEnvironment {
  return environment.toUpperCase() as DeploymentEnvironment;
}

export function normaliseRequestHost(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw || raw.length > 253 || /[\s/@\\,]/.test(raw)) throw new UnknownStorefrontError("invalid-host");
  try {
    const hostname = new URL(`http://${raw}`).hostname.toLowerCase();
    if (!hostname || hostname.includes("%") || hostname.endsWith(".")) throw new Error("invalid");
    return hostname;
  } catch {
    throw new UnknownStorefrontError("invalid-host");
  }
}

function asObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mapStorefront(row: StoreWithDomains, hostname: string, environment: DeploymentEnvironment): Storefront {
  const primary = row.domains.find(domain => domain.environment === environment && domain.isPrimary)
    ?? row.domains.find(domain => domain.environment === environment);
  if (!primary) throw new UnknownStorefrontError(hostname);
  const shipping = asObject(row.shippingConfig);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    displayName: row.displayName,
    legalName: row.legalName,
    status: row.status,
    logoUrl: row.logoUrl,
    faviconUrl: row.faviconUrl,
    supportEmail: row.supportEmail ?? "hello@example.com",
    country: row.country,
    currency: row.currency,
    timezone: row.timezone,
    theme: themeSchema.parse(row.theme),
    homepage: homepageSchema.parse(row.homepage),
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    socialImageUrl: row.socialImageUrl,
    organization: asObject(row.organization),
    socialLinks: asObject(row.socialLinks) as Record<string, string>,
    shippingConfig: {
      flatRateCents: typeof shipping.flatRateCents === "number" ? shipping.flatRateCents : 900,
      freeOverCents: typeof shipping.freeOverCents === "number" ? shipping.freeOverCents : 6000,
    },
    capabilities: row.capabilities,
    paymentProfileKey: row.paymentProfileKey,
    hostname,
    origin: `${primary.protocol}://${primary.hostname}`,
    environment,
  };
}

function developmentFallback(hostname: string): Storefront {
  return {
    id: TAPKIN_STORE_ID,
    slug: "tapkin",
    name: "Tapkin",
    displayName: "Tapkin",
    legalName: null,
    status: StoreStatus.ACTIVE,
    logoUrl: null,
    faviconUrl: null,
    supportEmail: "hello@example.com",
    country: "AU",
    currency: "AUD",
    timezone: "Australia/Adelaide",
    theme: themeSchema.parse({}),
    homepage: homepageSchema.parse({ variant: "tapkin", heroEyebrow: "Smart products, thoughtfully connected", heroHeadline: "Useful objects with a digital superpower", heroDescription: "Personalised products made in Australia with 3D printing, NFC and QR.", primaryCtaLabel: "Shop smart products" }),
    seoTitle: "Tapkin Smart Products",
    seoDescription: "Personalised smart products combining 3D printing, NFC, QR and secure digital profiles.",
    socialImageUrl: null,
    organization: { type: "Organization", name: "Tapkin" },
    socialLinks: {},
    shippingConfig: { flatRateCents: 900, freeOverCents: 6000 },
    capabilities: Object.values(StoreCapability),
    paymentProfileKey: null,
    hostname,
    origin: "http://localhost:3000",
    environment: DeploymentEnvironment.DEVELOPMENT,
  };
}

export async function resolveStorefront(host: string, appEnvironment: AppEnvironment = currentAppEnvironment()): Promise<Storefront> {
  const hostname = normaliseRequestHost(host);
  const environment = deploymentEnvironment(appEnvironment);
  if (!process.env.DATABASE_URL) {
    if (appEnvironment === "development" && ["localhost", "127.0.0.1"].includes(hostname)) return developmentFallback(hostname);
    throw new UnknownStorefrontError(hostname);
  }
  const domain = await db.storeDomain.findUnique({
    where: { environment_hostname: { environment, hostname } },
    include: { store: { include: { domains: true } } },
  });
  if (!domain) throw new UnknownStorefrontError(hostname);
  return mapStorefront(domain.store, hostname, environment);
}

export const getCurrentStorefront = cache(async (): Promise<Storefront> => {
  const requestHeaders = await headers();
  const configuredHost = new URL(getRuntimeConfig().appUrl).host;
  return resolveStorefront(requestHeaders.get("host") ?? configuredHost);
});

export function hasStoreCapability(store: Pick<Storefront, "capabilities">, capability: StoreCapability) {
  return store.capabilities.includes(capability);
}

export function storeThemeStyle(theme: StorefrontTheme): CSSProperties {
  return {
    "--store-accent": theme.accent,
    "--store-accent-secondary": theme.accentSecondary,
    "--store-background": theme.background,
    "--store-foreground": theme.foreground,
    "--store-radius": theme.radius,
  } as CSSProperties;
}
