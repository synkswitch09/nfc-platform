import { ProductType, StoreCapability, type ManufacturingStatus } from "@prisma/client";

export const manufacturingTransitions: Partial<Record<ManufacturingStatus, ManufacturingStatus[]>> = {
  GENERATED: ["PROGRAMMED"],
  PROGRAMMED: ["VERIFIED"],
  VERIFIED: ["ASSEMBLED"],
  ASSEMBLED: ["READY"],
  READY: ["ASSIGNED"],
  ASSIGNED: ["SOLD"],
};

export function canTransitionManufacturing(from: ManufacturingStatus, to: ManufacturingStatus) {
  return manufacturingTransitions[from]?.includes(to) ?? false;
}

export function manufacturingRequirements(capabilities: StoreCapability[], productType: ProductType) {
  if (!capabilities.includes(StoreCapability.PRINT_3D)) return null;
  return {
    requiresNfc: capabilities.includes(StoreCapability.NFC) && productType !== ProductType.ACCESSORY,
  };
}
