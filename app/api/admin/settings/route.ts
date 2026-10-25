import { pickupConfigSchema } from "@/lib/local-pickup";
import { jsonValidationError } from "@/lib/admin-validation-feedback";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

import { StoreCapability, StoreStatus } from "@prisma/client";
import { footerConfigSchema, headerConfigSchema } from "@/lib/site-chrome";
import { isSafeImageSource } from "@/lib/image-source";
import { googleVerificationToken } from "@/lib/site-verification";
import { storefrontThemeSchema } from "@/lib/storefront-theme";
import { businessAbnSchema } from "@/lib/business-identity";

const url = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https:\/\//i.test(value), "Use an HTTPS URL")
  .or(z.literal(""));
const imageSource = z
  .string()
  .trim()
  .refine(isSafeImageSource, "Use an uploaded image or an HTTPS image URL")
  .or(z.literal(""));
const homepage = z.object({
  heroEyebrow: z.string().trim().min(2).max(100),
  heroHeadline: z.string().trim().min(5).max(180),
  heroDescription: z.string().trim().min(10).max(360),
  primaryCtaLabel: z.string().trim().min(2).max(50),
  primaryCtaHref: z.string().regex(/^\/(?!\/)/),
});
const schema = z
  .object({
    storeName: z.string().trim().min(2).max(100),
    businessName: z.string().trim().max(150).optional(),
    businessAbn: businessAbnSchema.optional(),
    registeredBusinessName: z.string().trim().max(150).optional(),
    gstRegistration: z.enum(["registered", "not-registered", "unspecified"]).optional(),
    supportEmail: z.string().trim().email(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    defaultCountry: z.string().regex(/^[A-Z]{2}$/),
    timezone: z.string().trim().min(3).max(80),
    logoUrl: imageSource.optional(),
    faviconUrl: imageSource.optional(),
    siteTitle: z.string().trim().min(5).max(70),
    siteDescription: z.string().trim().min(20).max(170),
    googleSiteVerification: googleVerificationToken.optional(),
    defaultSocialImageUrl: imageSource.optional(),
    instagram: url.optional(),
    tumblr: url.optional(),
    facebook: url.optional(),
    tiktok: url.optional(),
    linkedin: url.optional(),
    pickup: pickupConfigSchema.optional(),
    flatRateCents: z.number().int().min(0).max(100_000),
    freeOverCents: z.number().int().min(0).max(10_000_000),
    theme: storefrontThemeSchema,
    homepage: homepage.optional(),
    headerConfig: headerConfigSchema.optional(),
    footerConfig: footerConfigSchema.optional(),
    status: z.nativeEnum(StoreStatus).optional(),
    capabilities: z
      .array(z.nativeEnum(StoreCapability))
      .max(Object.values(StoreCapability).length)
      .optional(),
  })
  .superRefine((value, context) => {
    if (
      value.capabilities?.includes(StoreCapability.NFC) &&
      !value.capabilities.includes(StoreCapability.DIGITAL_PROFILE)
    )
      context.addIssue({
        code: "custom",
        path: ["capabilities"],
        message: "NFC requires the DIGITAL_PROFILE capability",
      });
  });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request))
    return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !canManageStore(context))
    return jsonError("Store administrator access required", 403);
  const { user, store } = context;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonValidationError(parsed.error);
const value = parsed.data;
  const removingNfc =
    store.capabilities.includes(StoreCapability.NFC) &&
    value.capabilities &&
    !value.capabilities.includes(StoreCapability.NFC);
  if (removingNfc && (await db.nFCTag.count({ where: { storeId: store.id } })))
    return jsonError(
      "NFC cannot be disabled while this store has issued tags",
      409,
    );
  const platformData = context.isPlatformAdmin
    ? { status: value.status, capabilities: value.capabilities }
    : {};
  await db.$transaction([
    db.store.update({
      where: { id: store.id },
      data: {
        displayName: value.storeName,
        legalName: value.businessName || null,
        organization: { ...store.organization, ...(value.businessAbn !== undefined ? { abn: value.businessAbn } : {}), ...(value.registeredBusinessName !== undefined ? { registeredBusinessName: value.registeredBusinessName } : {}), ...(value.gstRegistration !== undefined ? { gstRegistered: value.gstRegistration === "unspecified" ? null : value.gstRegistration === "registered" } : {}) },
        supportEmail: value.supportEmail,
        currency: value.currency,
        country: value.defaultCountry,
        timezone: value.timezone,
        logoUrl: value.logoUrl || null,
        faviconUrl: value.faviconUrl || null,
        seoTitle: value.siteTitle,
        seoDescription: value.siteDescription,
        googleSiteVerification: value.googleSiteVerification,
        socialImageUrl: value.defaultSocialImageUrl || null,
        ...([value.instagram, value.tumblr, value.facebook, value.tiktok, value.linkedin].some(link => link !== undefined) ? { socialLinks: {
          ...store.socialLinks,
          ...(value.instagram !== undefined ? { instagram: value.instagram || null } : {}),
          ...(value.tumblr !== undefined ? { tumblr: value.tumblr || null } : {}),
          ...(value.facebook !== undefined ? { facebook: value.facebook || null } : {}),
          ...(value.tiktok !== undefined ? { tiktok: value.tiktok || null } : {}),
          ...(value.linkedin !== undefined ? { linkedin: value.linkedin || null } : {}),
        } } : {}),
        shippingConfig: {
          ...store.shippingConfig,
          ...(value.pickup !== undefined ? { pickup: value.pickup } : {}),
          flatRateCents: value.flatRateCents,
          freeOverCents: value.freeOverCents,
        },
        ...(value.headerConfig !== undefined ? { headerConfig: value.headerConfig } : {}),
        ...(value.footerConfig !== undefined ? { footerConfig: value.footerConfig } : {}),
        theme: value.theme,
        ...(value.homepage !== undefined ? { homepage: { ...store.homepage, ...value.homepage } } : {}),
        ...platformData,
      },
    }),
    db.auditLog.create({
      data: {
        actorId: user.id,
        storeId: store.id,
        action: "STORE_SETTINGS_UPDATED",
        entityType: "Store",
        entityId: store.id,
        metadata: {
          status: platformData.status ?? store.status,
          capabilitiesChanged: Boolean(platformData.capabilities),
        },
      },
    }),
  ]);
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return NextResponse.json({ ok: true });
}
