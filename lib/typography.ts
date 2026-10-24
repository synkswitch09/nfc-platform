import type { CSSProperties } from "react";
import { z } from "zod";

export const fontFamilies = ["INTER", "SYSTEM", "SERIF", "MONO", "BEBAS_NEUE", "CAVEAT"] as const;
export const fontWeights = ["THIN", "LIGHT", "REGULAR", "MEDIUM", "BOLD", "BLACK"] as const;

export const typographySchema = z.object({
  family: z.enum(fontFamilies).default("INTER"),
  weight: z.enum(fontWeights).default("REGULAR"),
  italic: z.boolean().default(false),
  sizePx: z.number().int().min(8).max(96).default(16),
  lineHeight: z.number().min(.8).max(3).optional(),
  letterSpacingEm: z.number().min(-.2).max(.5).optional(),
});
export const typographyOverrideSchema = z.object({
  family: z.enum(["INHERIT", ...fontFamilies]).default("INHERIT"),
  weight: z.enum(["INHERIT", ...fontWeights]).default("INHERIT"),
  italic: z.enum(["INHERIT", "NORMAL", "ITALIC"]).default("INHERIT"),
  sizePx: z.number().int().min(8).max(96).nullable().default(null),
  lineHeight: z.number().min(.8).max(3).optional(),
  letterSpacingEm: z.number().min(-.2).max(.5).optional(),
}).default({ family: "INHERIT", weight: "INHERIT", italic: "INHERIT", sizePx: null });

export type Typography = z.infer<typeof typographySchema>;
export type TypographyOverride = z.infer<typeof typographyOverrideSchema>;

const families: Record<(typeof fontFamilies)[number], string> = {
  INTER: "var(--font-inter), Inter, Arial, Helvetica, sans-serif",
  SYSTEM: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  SERIF: "Georgia, 'Times New Roman', serif",
  MONO: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  BEBAS_NEUE: "var(--font-bebas), Impact, sans-serif",
  CAVEAT: "var(--font-caveat), cursive",
};
const weights: Record<(typeof fontWeights)[number], number> = {
  THIN: 100,
  LIGHT: 300,
  REGULAR: 400,
  MEDIUM: 500,
  BOLD: 700,
  BLACK: 900,
};

export function typographyStyle(value: Typography | TypographyOverride): CSSProperties {
  const style: CSSProperties = {};
  if (value.family !== "INHERIT") style.fontFamily = families[value.family];
  if (value.weight !== "INHERIT") style.fontWeight = weights[value.weight];
  if (value.italic !== "INHERIT") style.fontStyle = value.italic === true || value.italic === "ITALIC" ? "italic" : "normal";
  if (value.sizePx !== null) style.fontSize = `${value.sizePx}px`;
  if (value.lineHeight !== undefined) style.lineHeight = value.lineHeight;
  if (value.letterSpacingEm !== undefined) style.letterSpacing = `${value.letterSpacingEm}em`;
  return style;
}

export function typographyVariables(prefix: string, value: Typography | TypographyOverride): CSSProperties {
  const style = typographyStyle(value) as Record<string, string | number>;
  return {
    [`--${prefix}-family`]: style.fontFamily,
    [`--${prefix}-weight`]: style.fontWeight,
    [`--${prefix}-style`]: style.fontStyle,
    [`--${prefix}-size`]: style.fontSize,
    [`--${prefix}-line-height`]: style.lineHeight,
    [`--${prefix}-letter-spacing`]: style.letterSpacing,
  } as CSSProperties;
}
