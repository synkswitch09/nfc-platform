import type { CSSProperties } from "react";
import { parseLandingContent } from "@/lib/landing-sections";
import {
  typographyOverrideSchema,
  typographyVariables,
} from "@/lib/typography";
import { localizeSections } from "@/lib/i18n";
import { db } from "@/lib/db";
import { KosykinHomeSection } from "@/components/kosykin-home-section";

// The published Home support block is the single CMS source for all routes.
export async function KosykinFooterSupport({
  storeId,
  enabled,
  locale,
  defaultLocale,
}: {
  storeId: string;
  enabled: boolean;
  locale: string;
  defaultLocale: string;
}) {
  if (!enabled || !process.env.DATABASE_URL) return null;
  const home = await db.contentPage.findFirst({
    where: { storeId, kind: "HOME", status: "PUBLISHED" },
    select: {
      sections: {
        where: { type: "CTA_BANNER" },
        orderBy: { sortOrder: "asc" },
        select: {
          visible: true,
          content: true,
          translations: {
            where: { locale },
            select: { locale: true, content: true },
          },
        },
      },
    },
  });
  const block = home?.sections.find((section) => {
    const content = section.content;
    return (
      content &&
      typeof content === "object" &&
      !Array.isArray(content) &&
      content.layoutVariant === "KOSYKIN_SUPPORT"
    );
  });
  if (!block?.visible || !block.content) return null;
  const localized = localizeSections([block], locale, defaultLocale)[0];
  const value = parseLandingContent("CTA_BANNER", localized.content);
  if (!value) return null;
  const style = {
    "--support-background":
      (typeof value.backgroundColour === "string" && value.backgroundColour) ||
      undefined,
    "--support-text":
      (typeof value.copyColour === "string" && value.copyColour) || undefined,
    "--section-headline": value.headlineColour || undefined,
    ...typographyVariables(
      "section-headline-type",
      typographyOverrideSchema.parse(value.headlineTypography),
    ),
    ...typographyVariables(
      "section-copy-type",
      typographyOverrideSchema.parse(value.copyTypography),
    ),
    ...typographyVariables(
      "section-button-type",
      typographyOverrideSchema.parse(value.buttonTypography),
    ),
  } as CSSProperties;
  return (
    <section
      className="kosy-footer-support kosy-home-section"
      data-variant="kosykin-support"
      style={style}
      aria-label="Need a hand?"
    >
      <KosykinHomeSection
        type="CTA_BANNER"
        value={value}
        products={[]}
        currency="AUD"
      />
    </section>
  );
}
