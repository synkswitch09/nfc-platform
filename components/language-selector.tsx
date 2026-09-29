"use client";

import { Languages } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function LanguageSelector({ locale, locales, defaultLocale, label }: { locale: string; locales: Array<{ code: string; name: string }>; defaultLocale: string; label: string }) {
  const pathname = usePathname(); const search = useSearchParams(); const router = useRouter();
  function change(nextLocale: string) {
    const params = new URLSearchParams(search.toString());
    if (nextLocale === defaultLocale) params.delete("locale"); else params.set("locale", nextLocale);
    document.cookie = `tapkin-locale=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.push(`${pathname}${params.size ? `?${params}` : ""}`); router.refresh();
  }
  return <label className="language-selector"><Languages size={17} aria-hidden="true" /><span className="sr-only">{label}</span><select aria-label={label} value={locale} onChange={event => change(event.target.value)}>{locales.map(item => <option value={item.code} key={item.code}>{item.name}</option>)}</select></label>;
}
