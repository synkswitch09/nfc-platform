import type { CategoryStatus, ProductStatus, TagStatus } from "@prisma/client";

export type CategorySurface = "homepage" | "navigation" | "shop" | "landing";

export function isCategoryVisible(status: CategoryStatus, enabled: boolean) {
  return status === "PUBLISHED" && enabled;
}

export function isProductAvailableForNewSale(status: ProductStatus, shopVisible: boolean) {
  return status === "ACTIVE" && shopVisible;
}

export function publicTagState(status: TagStatus, isPublic: boolean) {
  if (["MANUFACTURED", "UNCLAIMED"].includes(status)) return "ACTIVATION" as const;
  if (["DISABLED", "REPLACED"].includes(status) || !isPublic) return "UNAVAILABLE" as const;
  return "PROFILE" as const;
}

export function canHardDeleteProduct(history: { orderItems: number; tags: number; batches: number; inventoryMovements: number }) {
  return history.orderItems === 0 && history.tags === 0 && history.batches === 0 && history.inventoryMovements === 0;
}
