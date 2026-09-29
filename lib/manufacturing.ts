import { ProductType, StoreCapability, type ManufacturingJobStatus, type ManufacturingStatus } from "@prisma/client";

export const jobTransitions: Partial<Record<ManufacturingJobStatus, ManufacturingJobStatus[]>> = {
  QUEUED: ["PRINTING", "CANCELLED"],
  PRINTING: ["POST_PROCESSING", "FAILED"],
  POST_PROCESSING: ["QA", "FAILED"],
  QA: ["ASSEMBLY", "PACKING", "FAILED"],
  ASSEMBLY: ["PACKING", "FAILED"],
  PACKING: ["READY", "FAILED"],
  FAILED: ["QUEUED", "CANCELLED"],
};

export function canTransitionJob(from: ManufacturingJobStatus, to: ManufacturingJobStatus) {
  return jobTransitions[from]?.includes(to) ?? false;
}

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
