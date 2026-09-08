import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, jsonError } from "@/lib/http";

const optionalText = z.string().trim().max(500).optional().nullable();
const optionalPhone = z.string().trim().max(30).regex(/^[+()\d\s-]*$/).optional().nullable();
const optionalUrl = z.string().trim().max(500).url().refine(v => /^https?:\/\//i.test(v), "Use an http or https URL").optional().nullable().or(z.literal(""));
const contact = z.object({ name: z.string().trim().min(1).max(80), relationship: z.string().trim().max(80).optional(), phone: z.string().trim().min(5).max(30).regex(/^[+()\d\s-]+$/) });
const base = { displayName: z.string().trim().min(1).max(80), contacts: z.array(contact).max(2).default([]) };
const emergencyDetails = z.object({ approximateAge: optionalText, criticalMedicalInfo: optionalText, allergies: optionalText, communicationNotes: optionalText, photoUrl: optionalUrl, status: z.enum(["NORMAL", "MISSING"]) });
const linkDetails = z.object({ mode: z.enum(["DIRECT_REDIRECT", "MULTI_LINK"]), redirectUrl: optionalUrl, bio: optionalText, links: z.record(z.string().max(30), z.string().url().refine(v => /^https?:\/\//i.test(v))).default({}) });
const profileSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("PET"), details: z.object({ species: optionalText, breed: optionalText, sex: optionalText, approximateAge: optionalText, description: optionalText, medicalInfo: optionalText, allergies: optionalText, medications: optionalText, behaviourNotes: optionalText, veterinarian: optionalText, photoUrl: optionalUrl }) }),
  z.object({ ...base, type: z.literal("CHILD"), details: emergencyDetails }),
  z.object({ ...base, type: z.literal("EMERGENCY"), details: emergencyDetails }),
  z.object({ ...base, type: z.literal("SOCIAL"), details: linkDetails }),
  z.object({ ...base, type: z.literal("REVIEW"), details: linkDetails }),
  z.object({ ...base, type: z.literal("CUSTOM"), details: linkDetails }),
  z.object({ ...base, type: z.literal("BUSINESS"), details: z.object({ company: optionalText, jobTitle: optionalText, phone: optionalPhone, email: z.string().email().optional().nullable().or(z.literal("")), website: optionalUrl, linkedIn: optionalUrl, bio: optionalText }) }),
  z.object({ ...base, type: z.literal("LUGGAGE"), details: z.object({ message: optionalText, contactName: optionalText, contactPhone: optionalPhone, contactEmail: z.string().email().optional().nullable().or(z.literal("")) }) }),
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const user = await getCurrentUser(); if (!user) return jsonError("Unauthorised", 401);
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid profile");
  const { tagId } = await params;
  const tag = await db.nFCTag.findFirst({ where: { id: tagId, ownerId: user.id }, include: { profile: true } });
  if (!tag?.profile || tag.productType !== parsed.data.type) return jsonError("Tag not found", 404);
  const { displayName, contacts, details, type } = parsed.data;
  await db.$transaction(async tx => {
    await tx.tagProfile.update({ where: { id: tag.profile!.id }, data: { displayName } });
    await tx.emergencyContact.deleteMany({ where: { tagProfileId: tag.profile!.id } });
    if (contacts.length) await tx.emergencyContact.createMany({ data: contacts.map((item, priority) => ({ ...item, tagProfileId: tag.profile!.id, priority })) });
    if (type === "PET") await tx.petProfile.update({ where: { tagProfileId: tag.profile!.id }, data: details });
    if (type === "CHILD" || type === "EMERGENCY") await tx.childProfile.update({ where: { tagProfileId: tag.profile!.id }, data: details });
    if (type === "SOCIAL" || type === "REVIEW" || type === "CUSTOM") await tx.socialProfile.update({ where: { tagProfileId: tag.profile!.id }, data: details });
    if (type === "BUSINESS") await tx.businessProfile.update({ where: { tagProfileId: tag.profile!.id }, data: details });
    if (type === "LUGGAGE") await tx.luggageProfile.update({ where: { tagProfileId: tag.profile!.id }, data: details });
    await tx.auditLog.create({ data: { actorId: user.id, action: "TAG_PROFILE_UPDATED", entityType: "NFCTag", entityId: tag.id } });
  });
  return NextResponse.json({ ok: true });
}
