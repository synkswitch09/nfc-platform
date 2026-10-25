import { supportsPetProfiles } from "@/lib/storefront";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { footerConfigSchema, headerConfigSchema } from "@/lib/site-chrome";
import { petProfileConfigSchema } from "@/lib/pet-profile-cms";
import { storefrontValidationIssues } from "@/lib/storefront-form-validation";

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("https://"))
  .or(z.literal(""));
const socialLinksSchema = z.object({
  instagram: httpsUrl,
  tumblr: httpsUrl.default(""),
  facebook: httpsUrl,
  tiktok: httpsUrl,
  linkedin: httpsUrl,
});
const schema = z.discriminatedUnion("area", [
  z.object({ area: z.literal("header"), config: headerConfigSchema }),
  z.object({ area: z.literal("pet-profile"), config: petProfileConfigSchema }),
  z.object({
    area: z.literal("footer"),
    config: footerConfigSchema,
    socialLinks: socialLinksSchema.optional(),
  }),
]);

export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request))
    return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!context || !canManageStore(context)) {
    return jsonError("Store administrator access required", 403);
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issues = storefrontValidationIssues(parsed.error);
    return NextResponse.json({ error: "Check the highlighted fields before saving.", issues }, { status: 400 });
  }
  const value = parsed.data;
  if (value.area === "pet-profile" && !supportsPetProfiles(context.store)) {
    return jsonError("Pet profiles are not available for this store", 404);
  }
  const storefrontData =
    value.area === "header"
      ? { headerConfig: value.config }
      : value.area === "pet-profile"
        ? { petProfileConfig: value.config }
        : { footerConfig: value.config, ...(value.socialLinks !== undefined ? { socialLinks: value.socialLinks } : {}) };
  await db.$transaction([
    db.store.update({
      where: { id: context.store.id },
      data: storefrontData,
    }),
    db.auditLog.create({
      data: {
        actorId: context.user.id,
        storeId: context.store.id,
        action: `STOREFRONT_${value.area.toUpperCase()}_UPDATED`,
        entityType: "Store",
        entityId: context.store.id,
        metadata: { area: value.area } as Prisma.InputJsonValue,
      },
    }),
  ]);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
