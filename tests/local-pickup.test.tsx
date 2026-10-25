import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { checkoutSchema } from '@/lib/validation';
import { pickupConfigSchema, publicPickupConfig, pickupReadyText } from '@/lib/local-pickup';
import { canTransitionOrder, operationalOrderTransitions, orderStatusLabel } from '@/lib/order-status';
import { CustomerPickupStatus } from '@/components/customer-pickup-status';
const pickup = { enabled: true, suburb: 'Adelaide', address: 'SECRET PICKUP ADDRESS', hours: 'By appointment', instructions: 'Bring order number' };
const base = { deliveryMethod: 'PICKUP', customer: { name: 'Alex', email: 'alex@example.com' }, items: [{ variantId: '11111111-1111-4111-8111-111111111111', quantity: 1 }] };
describe('pickup contact, configuration and privacy', () => {
  it('requires name and email only; phone, address and a delivery quote are unnecessary', () => {
    expect(checkoutSchema.safeParse(base).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, customer: { ...base.customer, phone: '' } }).success).toBe(true);
    for (const customer of [{ name: '', email: base.customer.email }, { name: 'Alex', email: '' }]) expect(checkoutSchema.safeParse({ ...base, customer }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, deliveryMethod: 'DELIVERY' }).success).toBe(false);
  });
  it('allows blank disabled settings and identifies missing fields before enabling', () => {
    expect(pickupConfigSchema.safeParse({ enabled: false }).success).toBe(true);
    const parsed = pickupConfigSchema.safeParse({ enabled: true });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues.map(issue => issue.path.join('.'))).toEqual(['suburb', 'address', 'hours']);
  });
  it('only exposes the suburb to public checkout and reveals the address after readiness', () => {
    expect(publicPickupConfig(pickup)).toEqual({ enabled: true, suburb: 'Adelaide' });
    const order = { deliveryMethod: 'PICKUP', status: 'PAID', pickupSnapshot: pickup, orderNumber: 'KOSY-123' };
    expect(renderToStaticMarkup(<CustomerPickupStatus order={order} />)).not.toContain(pickup.address);
    expect(renderToStaticMarkup(<CustomerPickupStatus order={{ ...order, status: 'READY_TO_SHIP' }} />)).toContain(pickup.address);
    expect(pickupReadyText(pickup, 'KOSY-123')).toContain(pickup.address);
    expect(pickupReadyText(pickup, 'KOSY-123')).toContain('KOSY-123');
  });
  it('allows collection only after readiness and never pretends that a pickup order was shipped', () => {
    expect(canTransitionOrder('PROCESSING', 'COMPLETED', 'PICKUP')).toBe(false);
    expect(operationalOrderTransitions('READY_TO_SHIP', 'PICKUP')).toEqual(['COMPLETED']);
    expect(canTransitionOrder('READY_TO_SHIP', 'SHIPPED', 'PICKUP')).toBe(false);
    expect(canTransitionOrder('READY_TO_SHIP', 'COMPLETED')).toBe(false);
    expect(orderStatusLabel('READY_TO_SHIP', 'PICKUP')).toBe('Ready for pickup');
    expect(orderStatusLabel('COMPLETED', 'PICKUP')).toBe('Collected');
  });
});
