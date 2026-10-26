import { describe, expect, it } from 'vitest';
import { availableGiftChoices, randomGiftChoice } from '@/lib/gift-variants';
const variant = (overrides = {}) => ({ id: 'v', sku: 'TRAY-BLUE', name: 'Blue', colour: 'Blue', material: 'PLA', trackInventory: false, inventory: 0, reservedInventory: 0, backorderPolicy: 'DENY', productionMinutes: 20, optionSelection: {}, ...overrides });
const colours = [{ label: 'Blue', value: 'bb', swatchHex: '#a4dbe8' }, { label: 'Pink', value: 'mp', swatchHex: '#f7ced7' }];
describe('automatic gift colour assignment', () => {
  it('uses active mapped colours even when made-to-order variants have zero inventory', () => {
    const choices = availableGiftChoices({ variants: [variant({ colour: null, optionSelection: { colour: 'bb' } }), variant({ id: 'pink', sku: 'TRAY-PINK', colour: null, optionSelection: { colour: 'mp' } })], options: [{ code: 'colour', values: colours }] });
    expect(choices.map(choice => choice.colour)).toEqual(['Blue', 'Pink']);
    expect(choices[0]).toMatchObject({ colourHex: '#a4dbe8', requiresPrinting: true });
    for (let i = 0; i < 30; i++) expect(choices).toContain(randomGiftChoice(choices));
  });
  it('never picks removed colours or fully reserved stock without a printable fallback', () => {
    const choices = availableGiftChoices({ variants: [variant({ optionSelection: { colour: 'removed' } }), variant({ trackInventory: true, inventory: 1, reservedInventory: 1 })], options: [{ code: 'colour', values: colours }] });
    expect(choices).toEqual([]);
    expect(randomGiftChoice(choices)).toBeUndefined();
  });
  it('uses available stock without scheduling a duplicate print and deduplicates colour choices', () => {
    const choices = availableGiftChoices({ variants: [variant({ trackInventory: true, inventory: 2, reservedInventory: 1 }), variant({ id: 'same-colour', trackInventory: true, inventory: 2, reservedInventory: 1 })], options: [{ code: 'colour', values: colours }] });
    expect(choices).toHaveLength(1);
    expect(choices[0].requiresPrinting).toBe(false);
  });
});
