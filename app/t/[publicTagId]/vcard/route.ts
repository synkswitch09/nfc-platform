import { db } from "@/lib/db";

function escapeVCard(value: string) { return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll(/\r?\n/g, "\\n"); }

export async function GET(_request: Request, { params }: { params: Promise<{ publicTagId: string }> }) {
  const { publicTagId } = await params;
  if (!/^[A-Z2-9]{8,24}$/i.test(publicTagId)) return new Response("Not found", { status: 404 });
  const tag = await db.nFCTag.findFirst({ where: { publicTagId: publicTagId.toUpperCase(), status: { in: ["ACTIVE", "LOST"] }, productType: "BUSINESS", profile: { isPublic: true } }, include: { profile: { include: { business: true } } } });
  const profile = tag?.profile; const business = profile?.business;
  if (!profile || !business) return new Response("Not found", { status: 404 });
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${escapeVCard(profile.displayName ?? "Contact")}`, business.company && `ORG:${escapeVCard(business.company)}`, business.jobTitle && `TITLE:${escapeVCard(business.jobTitle)}`, business.phone && `TEL;TYPE=CELL:${escapeVCard(business.phone)}`, business.email && `EMAIL:${escapeVCard(business.email)}`, business.website && `URL:${escapeVCard(business.website)}`, "END:VCARD"].filter(Boolean);
  return new Response(`${lines.join("\r\n")}\r\n`, { headers: { "content-type": "text/vcard; charset=utf-8", "content-disposition": `attachment; filename="${publicTagId.toUpperCase()}.vcf"`, "cache-control": "private, no-store" } });
}
