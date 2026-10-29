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
  cart: 'lucide:shopping-bag', favourites: 'lucide:heart', favourite: 'lucide:heart', favouriteSaved: 'lucide:heart',
  menu: 'lucide:menu', close: 'lucide:x', filter: 'lucide:sliders-horizontal', arrowRight: 'lucide:arrow-right',
  chevronLeft: 'lucide:chevron-left', chevronRight: 'lucide:chevron-right', chevronDown: 'lucide:chevron-down', faq: 'lucide:plus',
  secureCheckout: 'lucide:shield-check', shipping: 'lucide:truck', madeToOrder: 'lucide:package-check',
  whyAppearance: 'lucide:sparkles', whyProduction: 'lucide:scan-box', whyMaterials: 'lucide:hand-coins', whyDetail: 'lucide:package-check',
  instagram: '/images/kosykin/icons/instagram.png', facebook: '/images/kosykin/icons/facebook.png', instagramFooter: '/images/kosykin/icons/instagram-footer.png', facebookFooter: '/images/kosykin/icons/facebook-footer.png', clock: 'lucide:clock',
};
export function storefrontIconSource(slot: StorefrontIconSlot, overrides: Record<string, string>, kosykin: boolean, imageUrl?: string) {
  return imageUrl || overrides[slot] || (kosykin ? kosykinIconDefaults[slot] : '') || '';
}
