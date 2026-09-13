import type { LandingSectionType } from "@prisma/client";
import { validateLandingSections, type LandingSectionDraft } from "@/lib/landing-sections";

export type LandingSectionTemplateId = "HERO_SPLIT" | "BENEFITS_ICON_ROW" | "CARDS_PASTEL_GRID" | "STEPS_FLOATING_MEDIA" | "FEATURE_SHOWCASE" | "STORY_PROCESS_PANEL" | "FAQ_COMPACT_ROW" | "PROMO_IMAGE_BANNER" | "MEDIA_SPLIT";

export type LandingSectionTemplate = {
  id: LandingSectionTemplateId;
  type: LandingSectionType;
  label: string;
  description: string;
  swatches: string[];
};

const dark = "#17212b";
const mint = "#d8f3e4";
const blue = "#dff3fa";
const peach = "#fde9d8";
const pink = "#f9dfe5";

const templateBase = {
  layoutVariant: "PASTEL_EDITORIAL",
  sectionWidth: "WIDE",
  spacing: "STANDARD",
  headingScale: "STANDARD",
  imageFit: "CONTAIN",
  backgroundColour: "",
  textColour: dark,
  radius: "LARGE",
  columns: 3,
};

export const landingSectionTemplates: LandingSectionTemplate[] = [
  { id: "HERO_SPLIT", type: "HERO", label: "Hero — text + large image", description: "Two-column opening with headline, feature badges and two buttons.", swatches: [mint, blue, peach, pink] },
  { id: "BENEFITS_ICON_ROW", type: "BENEFITS", label: "Benefits — horizontal icon row", description: "Three or four concise benefits with strong icon tiles.", swatches: [blue, mint] },
  { id: "CARDS_PASTEL_GRID", type: "FEATURE_BADGES", label: "Cards — pastel feature grid", description: "Independent cards with icon, title, copy, image and optional link.", swatches: [mint, blue, peach, pink] },
  { id: "STEPS_FLOATING_MEDIA", type: "STEPS", label: "Steps — cards with floating images", description: "Numbered pastel cards with an independent image for each step.", swatches: [blue, mint, pink] },
  { id: "FEATURE_SHOWCASE", type: "FEATURE_LIST", label: "Product feature — copy, image, checklist", description: "Editorial three-column showcase with a central product image.", swatches: [mint, peach] },
  { id: "STORY_PROCESS_PANEL", type: "STORY_PROCESS", label: "Process — story panel with phone image", description: "Full-width pastel panel with three illustrated moments and supporting media.", swatches: [mint, blue] },
  { id: "FAQ_COMPACT_ROW", type: "FAQ", label: "FAQ — compact accordion row", description: "Up to four questions per row with accessible expand and collapse behaviour.", swatches: [pink, peach] },
  { id: "PROMO_IMAGE_BANNER", type: "CTA_BANNER", label: "CTA — panoramic image banner", description: "Closing image banner with controlled overlay, text position and button.", swatches: [peach, blue] },
  { id: "MEDIA_SPLIT", type: "MEDIA_CONTENT", label: "Content — text and image split", description: "Flexible editorial block with image on either side.", swatches: [pink, mint] },
];

const templateContent: Record<LandingSectionTemplateId, LandingSectionDraft> = {
  HERO_SPLIT: {
    type: "HERO", name: "Hero — text + large image", visible: true, content: {
      ...templateBase, spacing: "COMPACT", headingScale: "LARGE", eyebrow: "Short eyebrow", headline: "A clear headline for your page.", copy: "Add a short description that explains the value of this page.", layout: "IMAGE_RIGHT", imageFit: "COVER", imagePosition: "CENTRE", imageAlt: "", ctaLabel: "Primary action", ctaHref: "/shop", ctaBackground: dark, ctaTextColour: "#ffffff", ctaBorderColour: dark, secondaryCtaLabel: "Secondary action", secondaryCtaHref: "/", secondaryCtaBackground: "#ffffff", secondaryCtaTextColour: dark, secondaryCtaBorderColour: dark,
      features: [
        { icon: "radio", label: "Feature one", supportingText: "Short detail", backgroundColour: blue, iconColour: dark, visible: true, order: 0 },
        { icon: "compass", label: "Feature two", supportingText: "Short detail", backgroundColour: mint, iconColour: dark, visible: true, order: 1 },
        { icon: "square-pen", label: "Feature three", supportingText: "Short detail", backgroundColour: peach, iconColour: dark, visible: true, order: 2 },
        { icon: "heart", label: "Feature four", supportingText: "Short detail", backgroundColour: pink, iconColour: dark, visible: true, order: 3 },
      ],
    },
  },
  BENEFITS_ICON_ROW: {
    type: "BENEFITS", name: "Benefits — horizontal icon row", visible: true, content: {
      ...templateBase, eyebrow: "Why choose us", headline: "A simple reason to believe.", columns: 3,
      items: [
        { icon: "badge-help", title: "Easy to understand", description: "Explain the first benefit in one short sentence.", iconBackgroundColour: dark, iconColour: "#ffffff", visible: true, order: 0 },
        { icon: "medal", title: "Made to belong", description: "Explain the second benefit in one short sentence.", iconBackgroundColour: dark, iconColour: "#ffffff", visible: true, order: 1 },
        { icon: "image-pen", title: "Easy to update", description: "Explain the third benefit in one short sentence.", iconBackgroundColour: dark, iconColour: "#ffffff", visible: true, order: 2 },
      ],
    },
  },
  CARDS_PASTEL_GRID: {
    type: "FEATURE_BADGES", name: "Cards — pastel feature grid", visible: true, content: {
      ...templateBase, eyebrow: "Key features", headline: "Build a colourful card collection.", columns: 4,
      items: [
        { icon: "sparkles", title: "Mint card", description: "Add a short description, image or destination.", imageAlt: "", backgroundColour: mint, iconBackgroundColour: "#ffffff", iconColour: dark, visible: true, order: 0 },
        { icon: "shield-check", title: "Blue card", description: "Each card can use its own content and colours.", imageAlt: "", backgroundColour: blue, iconBackgroundColour: "#ffffff", iconColour: dark, visible: true, order: 1 },
        { icon: "heart", title: "Peach card", description: "Cards can be hidden, reordered or duplicated.", imageAlt: "", backgroundColour: peach, iconBackgroundColour: "#ffffff", iconColour: dark, visible: true, order: 2 },
        { icon: "palette", title: "Pink card", description: "Adjust the grid from one to four columns.", imageAlt: "", backgroundColour: pink, iconBackgroundColour: "#ffffff", iconColour: dark, visible: true, order: 3 },
      ],
    },
  },
  STEPS_FLOATING_MEDIA: {
    type: "STEPS", name: "Steps — cards with floating images", visible: true, content: {
      ...templateBase, anchorId: "how-it-works", eyebrow: "How it works", headline: "Three simple steps.", columns: 3, ctaLabel: "Optional section action →", ctaHref: "/", ctaBackground: "", ctaTextColour: dark, ctaBorderColour: "", secondaryCtaVisible: false,
      items: [
        { icon: "tag", title: "Choose", description: "Describe the first step.", imageAlt: "", backgroundColour: blue, iconBackgroundColour: mint, iconColour: dark, imagePosition: 0, visible: true, order: 0 },
        { icon: "package", title: "Receive", description: "Describe the second step.", imageAlt: "", backgroundColour: blue, iconBackgroundColour: mint, iconColour: dark, imagePosition: 0, visible: true, order: 1 },
        { icon: "qr-code", title: "Activate", description: "Describe the third step.", imageAlt: "", backgroundColour: blue, iconBackgroundColour: mint, iconColour: dark, imagePosition: 0, visible: true, order: 2 },
      ],
    },
  },
  FEATURE_SHOWCASE: {
    type: "FEATURE_LIST", name: "Product feature — copy, image, checklist", visible: true, content: {
      ...templateBase, spacing: "RELAXED", eyebrow: "Featured product", headline: "Personalised. Lightweight. Connected.", copy: "Use this space for a short product introduction.", imageAlt: "", ctaLabel: "Explore designs", ctaHref: "/shop", ctaBackground: dark, ctaTextColour: "#ffffff", ctaBorderColour: dark, secondaryCtaVisible: false,
      items: ["Personalised detail", "Editable information", "Status controls", "Owner privacy", "Lightweight design"].map((title, order) => ({ icon: "check", title, description: "", iconBackgroundColour: mint, iconColour: dark, visible: true, order })),
    },
  },
  STORY_PROCESS_PANEL: {
    type: "STORY_PROCESS", name: "Process — story panel with phone image", visible: true, content: {
      ...templateBase, sectionWidth: "FULL", backgroundColour: mint, eyebrow: "How it helps", headline: "Show what happens at the moment it matters.", imageAlt: "", columns: 3, ctaVisible: false, secondaryCtaVisible: false,
      items: [
        { icon: "hand-helping", title: "1. Someone takes action", description: "Describe the first moment.", imageAlt: "", visible: true, order: 0 },
        { icon: "contact", title: "2. They see what matters", description: "Describe the useful information.", imageAlt: "", visible: true, order: 1 },
        { icon: "heart-handshake", title: "3. The story resolves", description: "Describe the final outcome.", imageAlt: "", visible: true, order: 2 },
      ],
    },
  },
  FAQ_COMPACT_ROW: {
    type: "FAQ", name: "FAQ — compact accordion row", visible: true, content: {
      ...templateBase, anchorId: "faqs", spacing: "COMPACT", eyebrow: "Frequently asked questions", headline: "", columns: 4,
      items: [1, 2, 3, 4].map((value, order) => ({ question: `Question ${value}?`, answer: `Add the answer to question ${value}.`, visible: true, order })),
    },
  },
  PROMO_IMAGE_BANNER: {
    type: "CTA_BANNER", name: "CTA — panoramic image banner", visible: true, content: {
      ...templateBase, spacing: "COMPACT", eyebrow: "Short eyebrow", headline: "End with a clear next step.", imageAlt: "", imageFit: "COVER", imagePosition: "LEFT", overlay: "LIGHT", contentPosition: "RIGHT", ctaLabel: "Call to action", ctaHref: "/shop", ctaBackground: "#242424", ctaTextColour: "#ffffff", ctaBorderColour: "#242424", secondaryCtaVisible: false,
    },
  },
  MEDIA_SPLIT: {
    type: "MEDIA_CONTENT", name: "Content — text and image split", visible: true, content: {
      ...templateBase, backgroundColour: pink, eyebrow: "Editorial content", headline: "Pair a focused story with strong media.", copy: "Add supporting copy, choose which side holds the image, and adjust the colours and spacing.", layout: "IMAGE_RIGHT", imageAlt: "", imagePosition: "CENTRE", ctaLabel: "", ctaHref: "", ctaVisible: false, secondaryCtaVisible: false,
    },
  },
};

export function createLandingSectionFromTemplate(id: LandingSectionTemplateId) {
  const template = templateContent[id];
  return validateLandingSections([{ ...template, content: structuredClone(template.content) }])[0]!;
}
