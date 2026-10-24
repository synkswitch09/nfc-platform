import { NextRequest, NextResponse } from "next/server";
import { getAdminApiContext, canManageStore } from "@/lib/admin";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { experienceSchema } from "@/lib/store-experience";
export async function GET() {
  const context = await getAdminApiContext("content.read");
  if (!context) return jsonError("Forbidden", 403);
  const record = await db.storeExperience.findUnique({ where: { storeId: context.store.id } });
  const config = experienceSchema.parse(record?.config ?? {});
  return NextResponse.json({ groups: config.groups.map(g => ({ id: g.id, name: g.name })) });
}
export async function PUT(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext("content.write");
  if (!canManageStore(context)) return jsonError("Forbidden", 403);
  const parsed = experienceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid content", 400);
  const ids = parsed.data.groups.map(g => g.id);
  if (new Set(ids).size !== ids.length || parsed.data.groups.some(g => new Set(g.slides.map(s => s.id)).size !== g.slides.length)) return jsonError("Groups and slides need unique IDs", 400);
  await db.storeExperience.upsert({ where: { storeId: context!.store.id }, create: { storeId: context!.store.id, config: parsed.data }, update: { config: parsed.data } });
  return NextResponse.json({ ok: true });
}
