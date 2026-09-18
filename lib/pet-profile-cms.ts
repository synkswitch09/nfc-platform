import { z } from "zod";

const colour = z.string().trim().regex(/^#[0-9a-f]{6}$/i);

export const petProfileConfigSchema = z.object({
  brandLabel: z.string().trim().min(1).max(40).default("Tapkin Pet ID"),
  profileLabel: z.string().trim().min(1).max(40).default("Pet profile"),
  greeting: z.string().trim().min(1).max(80).default("Nice to meet you"),
  lostGreeting: z.string().trim().min(1).max(100).default("Please help me get home"),
  lostStatusLabel: z.string().trim().min(1).max(40).default("I’m lost"),
  lostMessage: z.string().trim().min(1).max(220).default("I’ve been reported lost. Please call or message my person below."),
  contactEyebrow: z.string().trim().min(1).max(60).default("Need help?"),
  contactHeading: z.string().trim().min(1).max(80).default("Contact my person"),
  primaryContactLabel: z.string().trim().min(1).max(60).default("Primary contact"),
  careHeading: z.string().trim().min(1).max(100).default("Important care information"),
  aboutLabel: z.string().trim().min(1).max(60).default("About"),
  approachHeading: z.string().trim().min(1).max(100).default("How to approach me"),
  veterinarianHeading: z.string().trim().min(1).max(100).default("Veterinarian"),
  gpsDisclaimer: z.string().trim().min(1).max(260).default("This tag does not contain GPS. Location is shared only when a visitor chooses to share it."),
  heroStartColour: colour.default("#112520"),
  heroEndColour: colour.default("#176F5F"),
  pageBackgroundColour: colour.default("#E1F3EE"),
  cardBackgroundColour: colour.default("#FFFFFF"),
  contactBackgroundColour: colour.default("#EAF6F2"),
  accentColour: colour.default("#DCF4A6"),
  lostBackgroundColour: colour.default("#FFD3BF"),
  nameSizePx: z.number().int().min(24).max(72).default(48),
  bodySizePx: z.number().int().min(12).max(24).default(16),
});

export type PetProfileConfig = z.infer<typeof petProfileConfigSchema>;
export function parsePetProfileConfig(value: unknown): PetProfileConfig { return petProfileConfigSchema.parse(value); }
