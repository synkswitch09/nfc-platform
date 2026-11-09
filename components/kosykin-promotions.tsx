"use client";
import type { PromotionAction } from "@/lib/promotion-action";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StorefrontIcon } from "@/components/storefront-icon";
type Slide = PromotionAction & {
  id: string;
  title: string;
  description: string;
  supportingText?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string;
  imageAlt?: string;
  backgroundColour?: string;
  textColour?: string;
  titleFont?: "INTER" | "BEBAS_NEUE" | "CAVEAT";
  copyFont?: "INTER" | "BEBAS_NEUE" | "CAVEAT";
};
const fonts = {
  INTER: "var(--font-inter), sans-serif",
  BEBAS_NEUE: "var(--font-bebas), Impact, sans-serif",
  CAVEAT: "var(--font-caveat), cursive",
};
export function KosykinPromotions({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const current = Math.min(index, slides.length - 1);
  const slide = slides[current];
  if (!slide) return null;
  const showButton = slide.ctaVisible !== false && Boolean(slide.ctaLabel && slide.ctaHref);
  const actionStyle = {
    "--promo-cta-background": slide.ctaBackground || "#ffffff",
    "--promo-cta-text": slide.ctaTextColour || "#243247",
    "--promo-cta-border": slide.ctaBorderColour || "transparent",
    "--promo-cta-x": `${slide.ctaPositionX ?? 72.5}%`,
    "--promo-cta-y": `${slide.ctaPositionY ?? 70}%`,
  } as CSSProperties;
  const action = showButton ? <Link className="kosy-promotion-cta" style={actionStyle} href={slide.ctaHref!}>{slide.ctaLabel}</Link> : null;
  const artwork = slide.imageUrl ? <Image src={slide.imageUrl} alt={slide.imageAlt || `${slide.title}. ${slide.description} ${slide.supportingText || ""}`} width={1340} height={330} unoptimized /> : null;
  return (
    <div
      className={`kosy-promotion-carousel${slide.imageUrl ? " has-artwork" : ""}`}
      aria-roledescription="carousel"
      aria-label="Store promotions"
      style={
        {
          "--promo-background": slide.backgroundColour,
          "--promo-text": slide.textColour,
          "--promo-title-font": fonts[slide.titleFont || "BEBAS_NEUE"],
          "--promo-copy-font": fonts[slide.copyFont || "CAVEAT"],
        } as CSSProperties
      }
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.tagName === "INPUT"
        )
          return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setIndex((current + slides.length - 1) % slides.length);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setIndex((current + 1) % slides.length);
        }
      }}
    >
      {slides.length > 1 && (
        <button
          type="button"
          className="kosy-promo-prev"
          aria-label="Previous promotion"
          onClick={() =>
            setIndex((current + slides.length - 1) % slides.length)
          }
        >
          <StorefrontIcon name="chevronLeft" fallback={<ChevronLeft />} />
        </button>
      )}
      <div
        className={`kosy-promotion-slide${slide.imageUrl ? " has-artwork" : ""}`}
        style={
          {
            "--promo-background": slide.backgroundColour,
            "--promo-text": slide.textColour,
            "--promo-title-font": fonts[slide.titleFont || "BEBAS_NEUE"],
            "--promo-copy-font": fonts[slide.copyFont || "CAVEAT"],
          } as CSSProperties
        }
        aria-live="polite"
        aria-atomic="true"
        aria-label={`Promotion ${current + 1} of ${slides.length}`}
      >
        {slide.imageUrl ? (
          <>
            {slide.ctaVisible !== false && slide.ctaHref && !slide.ctaLabel ? <Link className="kosy-promotion-artwork-link" href={slide.ctaHref}>{artwork}</Link> : artwork}
            {action}
          </>
        ) : (
          <>
            <h2>{slide.title}</h2>
            <div>
              <p>{slide.description}</p>
              {slide.supportingText && <small>{slide.supportingText}</small>}
              {action}
            </div>
          </>
        )}
      </div>
      {slides.length > 1 && (
        <>
          <button
            type="button"
            className="kosy-promo-next"
            aria-label="Next promotion"
            onClick={() => setIndex((current + 1) % slides.length)}
          >
            <StorefrontIcon name="chevronRight" fallback={<ChevronRight />} />
          </button>
          <div className="kosy-promo-dots">
            {slides.map((item, position) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show promotion ${position + 1}`}
                aria-pressed={position === current}
                onClick={() => setIndex(position)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
