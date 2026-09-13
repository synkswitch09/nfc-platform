export const localeCookieName = "tapkin-locale";

export const systemCatalog = {
  en: { home: "Home", faq: "FAQs", cart: "Cart", shop: "Shop", signIn: "Sign in", myProducts: "My Products", language: "Language", terms: "Terms of Service", privacy: "Privacy Policy", checkout: "Checkout", addToCart: "Add to Cart", shipping: "Shipping", account: "Account", openNavigation: "Open navigation", closeNavigation: "Close navigation", items: "items" },
  es: { home: "Inicio", faq: "Preguntas", cart: "Carrito", shop: "Tienda", signIn: "Ingresar", myProducts: "Mis productos", language: "Idioma", terms: "Términos del servicio", privacy: "Política de privacidad", checkout: "Pagar", addToCart: "Añadir al carrito", shipping: "Envío", account: "Cuenta", openNavigation: "Abrir navegación", closeNavigation: "Cerrar navegación", items: "artículos" },
} as const;

export type SystemCopy = { [Key in keyof typeof systemCatalog.en]: string };

export function normaliseLocale(value: string) {
  return value.trim().replace("_", "-");
}

export function resolveLocale(preferred: string | null | undefined, enabled: string[], fallback: string) {
  const available = enabled.map(normaliseLocale);
  const requested = preferred ? normaliseLocale(preferred) : "";
  return available.find(locale => locale.toLowerCase() === requested.toLowerCase())
    ?? available.find(locale => locale.split("-")[0]?.toLowerCase() === requested.split("-")[0]?.toLowerCase())
    ?? (available.includes(normaliseLocale(fallback)) ? normaliseLocale(fallback) : available[0])
    ?? normaliseLocale(fallback);
}

export function getSystemCopy(locale: string): SystemCopy {
  return locale.toLowerCase().startsWith("es") ? systemCatalog.es : systemCatalog.en;
}

export function localizedPath(path: string, locale: string, defaultLocale: string) {
  if (normaliseLocale(locale) === normaliseLocale(defaultLocale)) return path;
  const url = new URL(path, "https://local.invalid");
  url.searchParams.set("locale", normaliseLocale(locale));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function languageAlternates(path: string, origin: string, locales: string[], defaultLocale: string) {
  return Object.fromEntries(locales.map(locale => [locale, `${origin}${localizedPath(path, locale, defaultLocale)}`]));
}

export function localizeContentPage<
  TSection extends { id: string; content: unknown; translations?: Array<{ locale: string; content: unknown }> },
  TPage extends { name: string; seoTitle: string | null; seoDescription: string | null; translations?: Array<{ locale: string; name: string | null; seoTitle: string | null; seoDescription: string | null }>; sections: TSection[] },
>(page: TPage, locale: string, defaultLocale: string) {
  if (normaliseLocale(locale) === normaliseLocale(defaultLocale)) return page;
  const translation = page.translations?.find(item => normaliseLocale(item.locale) === normaliseLocale(locale));
  return {
    ...page,
    name: translation?.name || page.name,
    seoTitle: translation?.seoTitle || page.seoTitle,
    seoDescription: translation?.seoDescription || page.seoDescription,
    sections: page.sections.map(section => ({
      ...section,
      content: section.translations?.find(item => normaliseLocale(item.locale) === normaliseLocale(locale))?.content ?? section.content,
    })),
  };
}

export function localizeSections<TSection extends { content: unknown; translations?: Array<{ locale: string; content: unknown }> }>(sections: TSection[], locale: string, defaultLocale: string) {
  if (normaliseLocale(locale) === normaliseLocale(defaultLocale)) return sections;
  return sections.map(section => ({ ...section, content: section.translations?.find(item => normaliseLocale(item.locale) === normaliseLocale(locale))?.content ?? section.content }));
}
