import type { ProductType } from "@prisma/client";

export const managedProfileTypes = ["PET", "CHILD", "EMERGENCY", "SOCIAL", "BUSINESS", "LUGGAGE", "REVIEW", "CUSTOM"] as const;
export type ManagedProfileType = (typeof managedProfileTypes)[number];

export function isManagedProfileType(value: ProductType): value is ManagedProfileType {
  return (managedProfileTypes as readonly ProductType[]).includes(value);
}
