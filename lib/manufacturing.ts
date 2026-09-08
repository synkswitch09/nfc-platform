import type { ManufacturingStatus } from "@prisma/client";

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
