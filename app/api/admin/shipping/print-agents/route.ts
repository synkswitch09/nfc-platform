import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManageStore, getAdminApiContext } from "@/lib/admin";
import { registerPrintAgent } from "@/lib/fulfilment-service";
import { assertSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ name: z.string().trim().min(2).max(80), printerName: z.string().trim().max(120).optional() });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const context = await getAdminApiContext();
  if (!canManageStore(context)) return jsonError("Administrator access is required", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid print agent");
  try {
    const result = await registerPrintAgent(context!.store.id, parsed.data.name, parsed.data.printerName, context!.user.id);
    return NextResponse.json({ agent: result.agent, token: result.token }, { status: 201 });
  } catch {
    return jsonError("A print agent with this name already exists", 409);
  }
}
