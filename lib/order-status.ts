import type { OrderStatus } from "@prisma/client";

export const orderTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING: ["CANCELLED"],
  PAYMENT_PENDING: ["CANCELLED"],
  PAID: ["PROCESSING"],
  PROCESSING: ["READY_TO_SHIP"],
  READY_TO_SHIP: ["SHIPPED", "PROCESSING"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
};

export function operationalOrderTransitions(from: OrderStatus, deliveryMethod = "DELIVERY"): OrderStatus[] {
  if (deliveryMethod === "PICKUP") {
    if (from === "READY_TO_SHIP") return ["COMPLETED"];
    if (["SHIPPED", "DELIVERED"].includes(from)) return [];
  }
  return orderTransitions[from] ?? [];
}
export function canTransitionOrder(from: OrderStatus, to: OrderStatus, deliveryMethod = "DELIVERY") {
  return operationalOrderTransitions(from, deliveryMethod).includes(to);
}
export function orderStatusLabel(status: string, deliveryMethod = "DELIVERY") {
  if (deliveryMethod === "PICKUP" && status === "READY_TO_SHIP") return "Ready for pickup";
  if (deliveryMethod === "PICKUP" && status === "COMPLETED") return "Collected";
  return status.replaceAll("_", " ");
}
