export const storefrontIconSlots = {
  cart: 'Cart', favourites: 'Favourites navigation', favourite: 'Save favourite', favouriteSaved: 'Saved favourite',
  menu: 'Mobile menu', close: 'Close', filter: 'Filter and sort', arrowRight: 'Action arrow',
  chevronLeft: 'Previous', chevronRight: 'Next', chevronDown: 'Expand', faq: 'FAQ expand',
  secureCheckout: 'Secure checkout', shipping: 'Shipping', madeToOrder: 'Made to order',
  whyAppearance: 'Why Kosy Kin: appearance', whyProduction: 'Why Kosy Kin: production', whyMaterials: 'Why Kosy Kin: materials', whyDetail: 'Why Kosy Kin: detail',
  instagram: 'Instagram', facebook: 'Facebook', instagramFooter: 'Instagram (light icon: hero and footer)', facebookFooter: 'Facebook (light icon: hero and footer)', clock: 'Time',
} as const;
export type StorefrontIconSlot = keyof typeof storefrontIconSlots;
export const kosykinIconDefaults: Partial<Record<StorefrontIconSlot, string>> = {
  cart: '/images/kosykin/icons/cart.png',
  arrowRight: '/images/kosykin/icons/arrow-right.png',
  chevronLeft: '/images/kosykin/icons/chevron-left.png', chevronRight: '/images/kosykin/icons/chevron-right.png', chevronDown: '/images/kosykin/icons/chevron-down.png',
  whyAppearance: '/images/kosykin/icons/why-appearance.png', whyProduction: '/images/kosykin/icons/why-made-to-order.png', whyMaterials: '/images/kosykin/icons/why-materials.png', whyDetail: '/images/kosykin/icons/why-detail.png',
  instagram: '/images/kosykin/icons/instagram.png', facebook: '/images/kosykin/icons/facebook.png', clock: '/images/kosykin/icons/clock.png',
  instagramFooter: '/images/kosykin/icons/instagram-footer.png', facebookFooter: '/images/kosykin/icons/facebook-footer.png',
};
export function storefrontIconSource(slot: StorefrontIconSlot, overrides: Record<string, string>, kosykin: boolean, imageUrl?: string) {
  return imageUrl || overrides[slot] || (kosykin ? kosykinIconDefaults[slot] : '') || '';
}
