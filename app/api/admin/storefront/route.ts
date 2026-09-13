import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { footerConfigSchema, headerConfigSchema } from "@/lib/site-chrome";

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("https://"))
  .or(z.literal(""));
const socialLinksSchema = z.object({
  instagram: httpsUrl,
  facebook: httpsUrl,
  tiktok: httpsUrl,
  linkedin: httpsUrl,
});
const schema = z.discriminatedUnion("area", [
  z.object({ area: z.literal("header"), config: headerConfigSchema }),
  z.object({
    area: z.literal("footer"),
    config: footerConfigSchema,
    socialLinks: socialLinksSchema,
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
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid storefront settings",
    );
  }
  const value = parsed.data;
  const storefrontData =
    value.area === "header"
      ? { headerConfig: value.config }
      : { footerConfig: value.config, socialLinks: value.socialLinks };
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
