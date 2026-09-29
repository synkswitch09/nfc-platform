import type { ManufacturingJobStatus, ProductType } from "@prisma/client";

type PreparationItem = {
  id: string;
  productName: string;
  quantity: number;
  packedQuantity: number;
  productType: ProductType;
  shippingSnapshot: unknown;
  manufacturingJobs: { status: ManufacturingJobStatus; quantity: number; requiresNfc: boolean }[];
  tags: { storeId: string; manufacturingStatus: string; status: string }[];
};

function production(item: PreparationItem) {
  if (!item.shippingSnapshot || typeof item.shippingSnapshot !== "object" || Array.isArray(item.shippingSnapshot)) return null;
  const value = (item.shippingSnapshot as Record<string, unknown>).production;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  return typeof result.requiresManufacturing === "boolean" && typeof result.requiresNfc === "boolean"
    ? { requiresManufacturing: result.requiresManufacturing, requiresNfc: result.requiresNfc } : null;
}

export function preparationIssues(items: PreparationItem[], storeId: string) {
  if (!items.length) return ["Order has no items"];
  return items.flatMap(item => {
    const issues: string[] = [];
    const label = item.productName;
    const saved = production(item);
    if (!saved) issues.push(`${label}: production requirements missing from the original order; review required`);
    if (item.packedQuantity !== item.quantity) issues.push(`${label}: packed ${item.packedQuantity} of ${item.quantity}`);
    if (saved?.requiresManufacturing && item.manufacturingJobs.filter(job => job.status === "READY").reduce((sum, job) => sum + job.quantity, 0) < item.quantity) issues.push(`${label}: manufacturing is not complete`);
    if (saved?.requiresNfc && item.tags.filter(tag => tag.storeId === storeId && ["READY", "ASSIGNED"].includes(tag.manufacturingStatus) && tag.status === "UNCLAIMED").length < item.quantity) issues.push(`${label}: verified NFC units are missing`);
    return issues;
  });
}
