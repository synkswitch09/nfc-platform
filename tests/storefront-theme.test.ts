import { describe, expect, it } from "vitest";
import { storeThemeStyle } from "@/lib/storefront";
import {
  defaultStoreThemePalettes,
  storefrontThemeSchema,
} from "@/lib/storefront-theme";

describe("storefront theme presets", () => {
  it("defaults a Store to the pastel peach, black and white preset", () => {
    const theme = storefrontThemeSchema.parse({});

    expect(theme.baseTheme).toBe("CORAL");
    expect(defaultStoreThemePalettes.CORAL).toMatchObject({
      accent: "#f2b9a7",
      soft: "#ffffff",
      deep: "#161616",
      contrast: "#ffffff",
    });
  });

  it("uses fixed palette tokens even when legacy theme colours are present", () => {
    const theme = storefrontThemeSchema.parse({
      baseTheme: "SKY",
      accent: "#ff0000",
      accentSecondary: "#00ff00",
      background: "#0000ff",
      foreground: "#ffff00",
      pageThemes: {
        CORAL: { accent: "#ff0000", soft: "#ff0000", deep: "#ff0000", contrast: "#ff0000" },
        SKY: { accent: "#ff0000", soft: "#ff0000", deep: "#ff0000", contrast: "#ff0000" },
        MIDNIGHT: { accent: "#ff0000", soft: "#ff0000", deep: "#ff0000", contrast: "#ff0000" },
        VIOLET: { accent: "#ff0000", soft: "#ff0000", deep: "#ff0000", contrast: "#ff0000" },
        AMBER: { accent: "#ff0000", soft: "#ff0000", deep: "#ff0000", contrast: "#ff0000" },
      },
    });

    const style = storeThemeStyle(theme) as Record<string, string>;
    expect(style["--store-accent"]).toBe(defaultStoreThemePalettes.SKY.accent);
    expect(style["--store-background"]).toBe("#ffffff");
    expect(style["--theme-violet-deep"]).toBe("#161616");
  });
});
