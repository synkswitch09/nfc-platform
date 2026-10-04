import { currentAppEnvironment } from "@/lib/config";

export type ParcelDimensions = { weightGrams: number; lengthMm: number; widthMm: number; heightMm: number };

export class ShippitError extends Error {
  constructor(message: string, readonly status = 502) { super(message); }
}

function configuration() {
  const environment = currentAppEnvironment();
  if (environment === "development") throw new ShippitError("Shippit is available in staging or production only", 409);
  const secret = environment === "production" ? process.env.SHIPPIT_PRODUCTION_API_SECRET : process.env.SHIPPIT_STAGING_API_SECRET;
  if (!secret) throw new ShippitError(`Shippit ${environment} API secret is not configured`, 503);
  return { secret, base: environment === "production" ? "https://app.shippit.com/api/3" : "https://app.staging.shippit.com/api/3" };
}

export async function shippitRequest(path: string, init?: RequestInit) {
  const { secret, base } = configuration();
  const response = await fetch(`${base}${path}`, { ...init, headers: { authorization: `Bearer ${secret}`, accept: "application/json", "content-type": "application/json", "user-agent": "TapkinKosykin/1.0", "x-shippit-platform": "Custom Next.js", ...init?.headers }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 422 && path.endsWith("/label")) throw new ShippitError("Shippit is still preparing the label. Refresh it in a moment.", 409);
    throw new ShippitError(`Shippit returned ${response.status}: ${String(body?.error_description ?? body?.error ?? "request failed").slice(0, 180)}`, response.status === 403 ? 503 : 502);
  }
  return body;
}

export function shippitOrderPayload(order: { orderNumber: string; shippingName: string | null; shippingLine1: string | null; shippingLine2: string | null; shippingSuburb: string | null; shippingState: string | null; shippingPostcode: string | null; shippingPhone: string | null; guestEmail: string | null; user?: { email: string } | null }, parcel: ParcelDimensions, reference: string, service: "standard" | "express") {
  const name = (order.shippingName ?? "").trim();
  const [firstName, ...last] = name.split(/\s+/);
  const email = order.user?.email ?? order.guestEmail;
  if (!firstName || !email || !order.shippingLine1 || !order.shippingSuburb || !order.shippingState || !order.shippingPostcode) throw new ShippitError("Shipping address, recipient name and email are required", 409);
  return { order: {
    courier_type: service,
    retailer_invoice: reference,
    delivery_address: [order.shippingLine1, order.shippingLine2].filter(Boolean).join(", "),
    delivery_suburb: order.shippingSuburb,
    delivery_state: order.shippingState,
    delivery_postcode: order.shippingPostcode,
    receiver_name: name,
    ...(order.shippingPhone ? { receiver_contact_number: order.shippingPhone } : {}),
    parcel_attributes: [{ qty: 1, weight: parcel.weightGrams / 1000, length: parcel.lengthMm / 1000, width: parcel.widthMm / 1000, depth: parcel.heightMm / 1000 }],
    user_attributes: { email, first_name: firstName, last_name: last.join(" ") },
  } };
}

export function parseShippitTracking(body: any): string {
  const tracking = body?.response?.tracking_number;
  if (typeof tracking !== "string" || !/^[A-Za-z0-9-]{5,100}$/.test(tracking)) throw new ShippitError("Shippit did not return a valid tracking number");
  return tracking;
}

export function parseShippitLabel(body: any) {
  const url = body?.response?.qualified_url ?? body?.response?.order?.documents?.shipping_label?.url;
  if (typeof url !== "string") throw new ShippitError("Shippit did not return a label URL");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !/^(?:[a-z0-9-]+\.)?s3[.-](?:ap-southeast-2\.)?amazonaws\.com$/.test(parsed.hostname)) throw new ShippitError("Unexpected label host from Shippit");
  return { url, carrier: String(body?.response?.order?.courier_name ?? "Shippit"), trackingUrl: body?.response?.order?.tracking_url as string | undefined };
}

export async function downloadShippitLabel(url: string) {
  // Recheck the host before fetching a third-party pre-signed URL.
  parseShippitLabel({ response: { qualified_url: url } });
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("pdf")) throw new ShippitError("The PDF label is not available yet");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 10_000_000 || bytes.subarray(0, 5).toString() !== "%PDF-") throw new ShippitError("Shippit returned an invalid PDF label");
  return bytes;
}
