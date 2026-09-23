import { z } from "zod";
import { MAX_RELEASE_REQUEST_BYTES } from "@/lib/storefront-release-schema";
import { ReleaseValidationError } from "@/lib/storefront-release-validation";

export class ReleaseRequestError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export async function readReleaseRequest(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_RELEASE_REQUEST_BYTES)
    throw new ReleaseRequestError("Release files must be 40 MB or smaller.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ReleaseRequestError("Choose a JSON storefront release file.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RELEASE_REQUEST_BYTES) {
        await reader.cancel();
        throw new ReleaseRequestError("Release files must be 40 MB or smaller.", 413);
      }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new ReleaseRequestError("Choose a valid JSON storefront release file."); }
  } finally { reader.releaseLock(); }
}

export function releaseErrorResponse(error: unknown) {
  if (error instanceof ReleaseRequestError) return { message: error.message, status: error.status };
  if (error instanceof ReleaseValidationError) return { message: error.message, status: 400 };
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return { message: `Release field ${issue?.path.join(".") || "file"}: ${issue?.message || "Invalid value"}`, status: 400 };
  }
  const code = error instanceof Error ? error.message : "";
  if (code === "RELEASE_SKU_BELONGS_TO_ANOTHER_STORE") return { message: "A SKU belongs to another store. Check the SKU assignments before importing.", status: 409 };
  if (code === "RELEASE_SKU_BELONGS_TO_ANOTHER_PRODUCT") return { message: "A SKU belongs to a different product. Check product slugs and SKU assignments before importing.", status: 409 };
  if (code === "RELEASE_PAGE_OWNER_CONFLICT") return { message: "A page slug already belongs to a category in the destination. Check page slugs before importing.", status: 409 };
  if (code.includes("RELEASE_MEDIA")) return { message: "Release media could not be verified or copied. No database changes were committed; retry with a complete release.", status: 409 };
  return { message: "The release could not be applied or checked. Check the destination's current state before retrying.", status: 409 };
}
