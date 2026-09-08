import type { ProductType } from "@prisma/client";

export const managedProfileTypes = ["PET", "CHILD", "SOCIAL", "BUSINESS", "LUGGAGE"] as const;
export type ManagedProfileType = (typeof managedProfileTypes)[number];

export function isManagedProfileType(value: ProductType): value is ManagedProfileType {
  return (managedProfileTypes as readonly ProductType[]).includes(value);
}
