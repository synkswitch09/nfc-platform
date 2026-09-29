import { z } from "zod";
import { typographySchema } from "@/lib/typography";

export const baseVisualThemeKeys = [
  "CORAL",
  "SKY",
  "MIDNIGHT",
  "VIOLET",
  "AMBER",
] as const;

export type BaseVisualTheme = (typeof baseVisualThemeKeys)[number];

export const baseVisualThemeDetails: Record<
  BaseVisualTheme,
  { label: string; description: string }
> = {
  CORAL: { label: "Pastel peach", description: "Peach, black and white" },
  SKY: { label: "Pastel blue", description: "Blue, black and white" },
  MIDNIGHT: { label: "Pastel green", description: "Mint, black and white" },
  VIOLET: { label: "Pastel lilac", description: "Lilac, black and white" },
  AMBER: { label: "Pastel butter", description: "Butter yellow, black and white" },
};

export const defaultBaseVisualTheme: BaseVisualTheme = "CORAL";

export const storeThemePaletteSchema = z.object({
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  soft: z.string().regex(/^#[0-9a-f]{6}$/i),
  deep: z.string().regex(/^#[0-9a-f]{6}$/i),
  contrast: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export const defaultStoreThemePalettes: Record<
  BaseVisualTheme,
  z.infer<typeof storeThemePaletteSchema>
> = {
  CORAL: {
    accent: "#f2b9a7",
    soft: "#ffffff",
    deep: "#161616",
    contrast: "#ffffff",
  },
  SKY: {
    accent: "#b8dfed",
    soft: "#ffffff",
    deep: "#161616",
    contrast: "#ffffff",
  },
  MIDNIGHT: {
    accent: "#abdcca",
    soft: "#ffffff",
    deep: "#161616",
    contrast: "#ffffff",
  },
  VIOLET: {
    accent: "#d8c8f0",
    soft: "#ffffff",
    deep: "#161616",
    contrast: "#ffffff",
  },
  AMBER: {
    accent: "#f2d99b",
    soft: "#ffffff",
    deep: "#161616",
    contrast: "#ffffff",
  },
};

const defaultTypography = {
  body: { family: "INTER" as const, weight: "REGULAR" as const, italic: false, sizePx: 16 },
  heading: { family: "INTER" as const, weight: "BOLD" as const, italic: false, sizePx: 40 },
  eyebrow: { family: "INTER" as const, weight: "MEDIUM" as const, italic: false, sizePx: 12 },
  button: { family: "INTER" as const, weight: "MEDIUM" as const, italic: false, sizePx: 15 },
  card: { family: "INTER" as const, weight: "REGULAR" as const, italic: false, sizePx: 16 },
};

export const storefrontThemeSchema = z.object({
  baseTheme: z.enum(baseVisualThemeKeys).default(defaultBaseVisualTheme),
  accent: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#ee6c4d"),
  accentSecondary: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#2f7f77"),
  background: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#f7f3eb"),
  foreground: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#14213d"),
  radius: z
    .string()
    .regex(/^\d+(?:\.\d+)?(?:px|rem)$/)
    .default("1.25rem"),
  fontStyle: z.enum(["editorial", "modern", "technical"]).default("editorial"),
  typography: z.object({
    body: typographySchema.default(defaultTypography.body),
    heading: typographySchema.default(defaultTypography.heading),
    eyebrow: typographySchema.default(defaultTypography.eyebrow),
    button: typographySchema.default(defaultTypography.button),
    card: typographySchema.default(defaultTypography.card),
  }).default(defaultTypography),
  pageThemes: z
    .object({
      CORAL: storeThemePaletteSchema.default(defaultStoreThemePalettes.CORAL),
      SKY: storeThemePaletteSchema.default(defaultStoreThemePalettes.SKY),
      MIDNIGHT: storeThemePaletteSchema.default(
        defaultStoreThemePalettes.MIDNIGHT,
      ),
      VIOLET: storeThemePaletteSchema.default(defaultStoreThemePalettes.VIOLET),
      AMBER: storeThemePaletteSchema.default(defaultStoreThemePalettes.AMBER),
    })
    .default(defaultStoreThemePalettes),
});

export type StorefrontTheme = z.infer<typeof storefrontThemeSchema>;
