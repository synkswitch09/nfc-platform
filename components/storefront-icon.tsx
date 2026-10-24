'use client';
import { createContext, useContext, type ReactNode } from 'react';
import Image from 'next/image';
import { storefrontIconSource, type StorefrontIconSlot } from '@/lib/storefront-icons';
const Icons = createContext<{ overrides: Record<string, string>; kosykin: boolean }>({ overrides: {}, kosykin: false });
export function StorefrontIconsProvider({ overrides, kosykin, children }: { overrides: Record<string, string>; kosykin: boolean; children: ReactNode }) {
  return <Icons.Provider value={{ overrides, kosykin }}>{children}</Icons.Provider>;
}
export function StorefrontIcon({ name, imageUrl, size = 24, fallback }: { name?: StorefrontIconSlot; imageUrl?: string; size?: number; fallback: ReactNode }) {
  const { overrides, kosykin } = useContext(Icons);
  const src = name ? storefrontIconSource(name, overrides, kosykin, imageUrl) : imageUrl;
  if (!src) return <>{fallback}</>;
  return <span className="storefront-icon" aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0, width: size, height: size, verticalAlign: 'middle' }}><Image src={src} alt="" width={size} height={size} unoptimized style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></span>;
}
