"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StorefrontIcon } from '@/components/storefront-icon';
type Slide = { id: string; title: string; description: string; supportingText?: string; ctaLabel?: string; ctaHref?: string };
export function KosykinPromotions({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const current = Math.min(index, slides.length - 1);
  const slide = slides[current];
  if (!slide) return null;
  return <div className="kosy-promotion-carousel" aria-roledescription="carousel" aria-label="Store promotions">
    {slides.length > 1 && <button type="button" className="kosy-promo-prev" aria-label="Previous promotion" onClick={() => setIndex((current + slides.length - 1) % slides.length)}><StorefrontIcon name="chevronLeft" fallback={<ChevronLeft />} /></button>}
    <div className="kosy-promotion-slide" aria-live="polite" aria-atomic="true"><h2>{slide.title}</h2><div><p>{slide.description}</p>{slide.supportingText && <small>{slide.supportingText}</small>}{slide.ctaLabel && slide.ctaHref && <Link href={slide.ctaHref}>{slide.ctaLabel}</Link>}</div></div>
    {slides.length > 1 && <><button type="button" className="kosy-promo-next" aria-label="Next promotion" onClick={() => setIndex((current + 1) % slides.length)}><StorefrontIcon name="chevronRight" fallback={<ChevronRight />} /></button><div className="kosy-promo-dots">{slides.map((item, position) => <button key={item.id} type="button" aria-label={`Show promotion ${position + 1}`} aria-pressed={position === current} onClick={() => setIndex(position)} />)}</div></>}
  </div>;
}
