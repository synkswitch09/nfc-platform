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

export function canTransitionOrder(from: OrderStatus, to: OrderStatus) {
  return orderTransitions[from]?.includes(to) ?? false;
}
