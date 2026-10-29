import { StorefrontIcon } from '@/components/storefront-icon';
import { ContentLucideIcon } from '@/components/content-lucide-icon';
export function CategoryIcon({ name, size = 24, imageUrl }: { name?: string | null; size?: number; imageUrl?: string }) {
  return <StorefrontIcon name={name === 'clock' ? 'clock' : undefined} imageUrl={imageUrl} size={size} fallback={<ContentLucideIcon name={name} size={size} />} />;
}
