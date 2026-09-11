import { CategoryLandingLayout, CategoryVisualTheme, CustomisationFieldType, DeploymentEnvironment, PrismaClient, ProductType, Role, StoreCapability } from "@prisma/client";
import { hashPassword } from "../lib/crypto";
import { passwordSchema } from "../lib/validation";
import { currentAppEnvironment } from "../lib/config";

const db = new PrismaClient();
const TAPKIN_STORE_ID = "00000000-0000-4000-8000-000000000001";
const HOME_DEMO_STORE_ID = "00000000-0000-4000-8000-000000000002";

async function seedShipping(storeId: string, flatRateCents: number, freeOverCents: number, development: boolean) {
  await db.shippingOrigin.upsert({
    where: { storeId_name: { storeId, name: "Primary dispatch" } },
    update: { active: true, isDefault: true },
    create: { storeId, name: "Primary dispatch", senderName: "Dispatch team", company: "Store operations", line1: "Configure before live fulfilment", suburb: "Adelaide", state: "SA", postcode: "5000", country: "AU", active: true, isDefault: true },
  });
  const parcel = await db.packaging.upsert({
    where: { storeId_code: { storeId, code: "SMALL-PARCEL" } },
    update: { active: true, lengthMm: 220, widthMm: 160, heightMm: 60, emptyWeightGrams: 80 },
    create: { storeId, code: "SMALL-PARCEL", name: "Small recyclable parcel", lengthMm: 220, widthMm: 160, heightMm: 60, emptyWeightGrams: 80, maxWeightGrams: 5000, active: true },
  });
  const zone = await db.shippingZone.upsert({
    where: { storeId_name: { storeId, name: "Australia" } },
    update: { countries: ["AU"], states: [], postcodeRules: [], active: true },
    create: { storeId, name: "Australia", countries: ["AU"], states: [], postcodeRules: [], priority: 0, active: true },
  });
  const provider = await db.shippingProvider.upsert({
    where: { storeId_key: { storeId, key: development ? "mock-auspost" : "manual" } },
    update: { active: true, supportsRates: true, supportsLabels: development },
    create: { storeId, key: development ? "mock-auspost" : "manual", name: development ? "Mock Australia Post" : "Manual fallback", kind: development ? "MOCK" : "MANUAL", active: true, supportsRates: true, supportsLabels: development },
  });
  await db.shippingRate.upsert({
    where: { storeId_zoneId_serviceCode_packagingId: { storeId, zoneId: zone.id, serviceCode: "STANDARD", packagingId: parcel.id } },
    update: { providerId: provider.id, amountCents: flatRateCents, freeOverCents, active: true },
    create: { storeId, zoneId: zone.id, providerId: provider.id, packagingId: parcel.id, serviceCode: "STANDARD", serviceName: "Standard parcel delivery", amountCents: flatRateCents, freeOverCents, estimatedDaysMin: 2, estimatedDaysMax: 6, active: true },
  });
}

type LandingSeed = { name: string; heroEyebrow?: string; heroHeadline?: string; heroDescription?: string; heroImageUrl?: string; heroImageAlt?: string; ctaLabel?: string; benefits?: Array<{ icon: string; title: string; description: string }>; useCases?: Array<{ icon: string; title: string; description: string }>; howItWorks?: Array<{ title: string; description: string; imageUrl?: string }>; contentSections?: Array<{ layout: string; eyebrow?: string; heading: string; copy: string; bulletPoints?: string[]; imageUrl?: string; ctaLabel?: string; ctaHref?: string }>; faq?: Array<{ question: string; answer: string }>; finalCtaEyebrow?: string; finalCtaHeadline?: string; finalCtaDescription?: string; finalCtaLabel?: string };

async function seedLandingSections(storeId: string, categoryId: string, item: LandingSeed, shopHref: string) {
  if (await db.landingPageSection.count({ where: { storeId, categoryId } })) return;
  const sections = [
    { type: "HERO" as const, name: "Hero", content: { layout: "IMAGE_RIGHT", eyebrow: item.heroEyebrow ?? "Made for real life", headline: item.heroHeadline ?? item.name, copy: item.heroDescription ?? "", imageUrl: item.heroImageUrl ?? "", imageAlt: item.heroImageAlt ?? "", ctaLabel: item.ctaLabel ?? `Shop ${item.name}`, ctaHref: shopHref, bullets: [] } },
    { type: "FEATURE_BADGES" as const, name: "Quick benefits", content: { eyebrow: "Why it matters", headline: "Designed around the moments that matter.", copy: "", imageUrl: "", imageAlt: "", ctaLabel: "", ctaHref: "", items: (item.benefits ?? []).slice(0, 4).map(value => ({ ...value, imageUrl: "", imageAlt: "", ctaLabel: "", ctaHref: "" })) } },
    { type: "BENEFITS" as const, name: "Use cases", content: { eyebrow: "Made for real life", headline: `Where ${item.name} fits in.`, copy: "", imageUrl: "", imageAlt: "", ctaLabel: "", ctaHref: "", items: (item.useCases ?? []).map(value => ({ ...value, imageUrl: "", imageAlt: "", ctaLabel: "", ctaHref: "" })) } },
    { type: "STEPS" as const, name: "How it works", content: { eyebrow: "Simple. Fast. Useful.", headline: "How it works", copy: "", imageUrl: "", imageAlt: "", ctaLabel: "", ctaHref: "", items: (item.howItWorks ?? []).map(value => ({ icon: "sparkles", title: value.title, description: value.description, imageUrl: value.imageUrl ?? "", imageAlt: "", ctaLabel: "", ctaHref: "" })) } },
    ...(item.contentSections ?? []).map((value, index) => ({ type: "MEDIA_CONTENT" as const, name: `Story ${index + 1}`, content: { layout: value.layout, eyebrow: value.eyebrow ?? "", headline: value.heading, copy: value.copy, imageUrl: value.imageUrl ?? "", imageAlt: "", ctaLabel: value.ctaLabel ?? "", ctaHref: value.ctaHref ?? "", bullets: value.bulletPoints ?? [] } })),
    { type: "PRODUCT_GRID" as const, name: "Products", content: { eyebrow: "Made to be yours", headline: `Explore the ${item.name} collection.`, copy: "", imageUrl: "", imageAlt: "", ctaLabel: "", ctaHref: "", limit: 6, featuredOnly: false } },
    { type: "FAQ" as const, name: "FAQ", content: { eyebrow: "Helpful answers", headline: "Frequently asked questions", copy: "", imageUrl: "", imageAlt: "", ctaLabel: "", ctaHref: "", items: (item.faq ?? []).map(value => ({ question: value.question, answer: value.answer })) } },
    { type: "CTA_BANNER" as const, name: "Final call to action", content: { layout: "CENTRED", eyebrow: item.finalCtaEyebrow ?? "Made for real life", headline: item.finalCtaHeadline ?? `Discover the ${item.name} collection.`, copy: item.finalCtaDescription ?? "", imageUrl: "", imageAlt: "", ctaLabel: item.finalCtaLabel ?? `Shop ${item.name}`, ctaHref: shopHref, bullets: [] } },
  ];
  await db.landingPageSection.createMany({ data: sections.map((section, sortOrder) => ({ storeId, categoryId, type: section.type, name: section.name, visible: true, sortOrder, content: section.content })) });
}
const categories = [
  {
    slug: "pet", legacySlugs: ["pet-tags"], name: "Pet", icon: "dog", visualTheme: CategoryVisualTheme.CORAL, landingLayout: CategoryLandingLayout.EDITORIAL,
    shortDescription: "Smart tags that help lost pets reconnect with their people.", heroEyebrow: "More than a pet tag", heroHeadline: "Peace of mind that travels with them.", heroDescription: "Durable, personalised NFC and QR pet tags that help a finder reach you quickly while you control every detail they see.", heroImageAlt: "Tapkin pet tags designed for everyday adventures", cardTitle: "Pet", cardText: "Fast contact, useful medical notes and profiles you can update anytime.", cardImageAlt: "Personalised Tapkin pet tag",
    ctaLabel: "Shop Pet Tags", finalCtaEyebrow: "Made for every adventure", finalCtaHeadline: "Help their next journey lead home.", finalCtaDescription: "Choose a durable tag, add their name and keep their digital profile ready for the moments that matter.", finalCtaLabel: "Shop Pet Tags",
    benefits: [{ icon: "heart", title: "Faster reunions", description: "NFC and QR help a finder reach the right contact in seconds.", order: 0, visible: true }, { icon: "shield", title: "Safer sharing", description: "Show behaviour, allergies and medical notes without putting them on the chip.", order: 1, visible: true }, { icon: "paw", title: "Made for daily wear", description: "Lightweight 3D-printed forms designed for dogs and cats.", order: 2, visible: true }],
    useCases: [{ icon: "trees", title: "Off-lead adventures", description: "Give a finder an immediate route to the owner if curiosity wins.", order: 0, visible: true }, { icon: "plane", title: "Travel and boarding", description: "Keep contact and care notes current before a trip or kennel stay.", order: 1, visible: true }, { icon: "home", title: "Everyday backup", description: "Add a quiet layer of protection for gates, doors and unexpected escapes.", order: 2, visible: true }],
    howItWorks: [{ title: "Choose their style", description: "Pick a shape, colour and the name to print on the front.", order: 0, visible: true }, { title: "Activate at home", description: "Use the separate secure code supplied with the finished tag.", order: 1, visible: true }, { title: "Keep the profile current", description: "Update contacts, medical notes or lost status without replacing the tag.", order: 2, visible: true }],
    contentSections: [{ layout: "IMAGE_RIGHT", eyebrow: "Designed for real life", heading: "Strong enough to roam. Simple enough to help.", copy: "A clear scan experience gives a finder the useful information first while keeping account control with the owner.", bulletPoints: ["NFC and QR access", "Water-resistant materials", "Owner-controlled contact details", "Lost-mode messaging"], order: 0, visible: true }],
    faq: [{ question: "Does a finder need the Tapkin app?", answer: "No. A compatible phone can tap the NFC product or scan its QR code in the normal camera app.", order: 0, enabled: true }, { question: "Can I change my contact details later?", answer: "Yes. The permanent tag URL stays the same while you update the protected profile in your account.", order: 1, enabled: true }],
  },
  {
    slug: "child", legacySlugs: ["child-safety-tags"], name: "Child", icon: "shield-check", visualTheme: CategoryVisualTheme.SKY, landingLayout: CategoryLandingLayout.ASSURANCE,
    shortDescription: "Guardian-controlled emergency information for backpacks, keys and everyday gear.", heroEyebrow: "Prepared without oversharing", heroHeadline: "Helpful information, carefully protected.", heroDescription: "Privacy-conscious NFC and QR products that connect a trusted adult with guardian contacts and carefully selected emergency details.", heroImageAlt: "A Tapkin safety tag attached to a child's backpack", cardTitle: "Child", cardText: "Guardian-controlled profiles designed for excursions, travel and busy family life.", cardImageAlt: "Tapkin child safety backpack tag",
    ctaLabel: "Shop Child Tags", finalCtaEyebrow: "Guardian controlled", finalCtaHeadline: "Prepare for busy days with less exposure.", finalCtaDescription: "Create a minimal safety profile that prioritises trusted contacts and essential guidance.", finalCtaLabel: "Shop Child Tags",
    benefits: [{ icon: "shield", title: "Guardian controlled", description: "Only the account owner decides what a finder can see.", order: 0, visible: true }, { icon: "phone", title: "Quick contact", description: "Prominent call actions help a trusted adult contact a guardian.", order: 1, visible: true }, { icon: "lock", title: "Minimal by design", description: "Share critical guidance without publishing unnecessary identity details.", order: 2, visible: true }],
    useCases: [{ icon: "bus", title: "School excursions", description: "Offer an authorised contact route on unfamiliar or crowded days.", order: 0, visible: true }, { icon: "calendar", title: "Events and activities", description: "Attach a minimal profile to a bag for camps, sport and community events.", order: 1, visible: true }, { icon: "plane", title: "Family travel", description: "Keep guardian contact guidance current without printing a home address.", order: 2, visible: true }],
    howItWorks: [{ title: "Choose the item", description: "Select a backpack tag, keyring or emergency bag identifier.", order: 0, visible: true }, { title: "Create the safety profile", description: "Add guardian contacts and only the information that is genuinely useful.", order: 1, visible: true }, { title: "Review as life changes", description: "Update contact and essential guidance from the guardian account.", order: 2, visible: true }],
    contentSections: [{ layout: "TEXT_ONLY", eyebrow: "Privacy first", heading: "Useful in an emergency. Quiet the rest of the time.", copy: "Tapkin child profiles are intentionally focused. The product carries a random URL, not a child's personal data, and the guardian can disable access at any time.", bulletPoints: ["No home address required", "No GPS tracking claims", "Prioritised guardian contacts", "Owner-controlled visibility"], order: 0, visible: true }],
    faq: [{ question: "Does the NFC tag track my child?", answer: "No. Tapkin products do not contain GPS. A visitor can choose to share their own location when contacting the guardian.", order: 0, enabled: true }, { question: "What information should I publish?", answer: "Use the minimum needed to help: trusted guardian contact methods and essential guidance. Avoid a full name, home address, school details or routine.", order: 1, enabled: true }],
  },
  {
    slug: "business", legacySlugs: ["business-nfc-tags"], name: "Business", icon: "briefcase-business", visualTheme: CategoryVisualTheme.MIDNIGHT, landingLayout: CategoryLandingLayout.EXECUTIVE,
    shortDescription: "Reusable digital contact products for professionals, teams and customer touchpoints.", heroEyebrow: "Networking made tangible", heroHeadline: "Make every introduction actionable.", heroDescription: "Smart keyrings, desk products and review stands that connect customers and contacts with the next useful action.", heroImageAlt: "Tapkin business NFC products in a professional workspace", cardTitle: "Business", cardText: "Share contact details, save a vCard or guide customers to a trusted destination.", cardImageAlt: "Tapkin professional NFC contact product",
    ctaLabel: "Shop Business NFC", finalCtaEyebrow: "Ready for the next introduction", finalCtaHeadline: "Put your best next step within a tap.", finalCtaDescription: "Create a professional touchpoint for meetings, teams, counters and customer journeys.", finalCtaLabel: "Shop Business NFC",
    benefits: [{ icon: "contact", title: "Contact-ready", description: "Let a new connection save a complete vCard from the profile.", order: 0, visible: true }, { icon: "building", title: "Built for teams", description: "Products can represent a person, role, location or business touchpoint.", order: 1, visible: true }, { icon: "repeat", title: "Reusable", description: "Update details after a role or campaign changes without replacing the product.", order: 2, visible: true }],
    useCases: [{ icon: "users", title: "Meetings and events", description: "Move from introduction to saved contact without searching or typing.", order: 0, visible: true }, { icon: "store", title: "Customer counters", description: "Guide a customer to reviews, bookings or the right service page.", order: 1, visible: true }, { icon: "badge", title: "Teams and venues", description: "Give roles, desks or locations a durable digital touchpoint.", order: 2, visible: true }],
    howItWorks: [{ title: "Choose the touchpoint", description: "Select a personal keyring, desk stand or customer review product.", order: 0, visible: true }, { title: "Configure the action", description: "Share a contact profile, website, social links or validated review page.", order: 1, visible: true }, { title: "Use it repeatedly", description: "Bring the same product to meetings, counters and events.", order: 2, visible: true }],
    contentSections: [{ layout: "IMAGE_RIGHT", eyebrow: "Professional by default", heading: "Make the next action obvious.", copy: "Tapkin business products remove the friction between meeting someone and saving the right details.", bulletPoints: ["Downloadable vCard", "Company and role details", "Direct phone and email actions", "Update without reprinting"], order: 0, visible: true }],
    faq: [{ question: "Can I update my job title later?", answer: "Yes. Business profile details can be updated from the owner dashboard while the physical product keeps the same URL.", order: 0, enabled: true }],
  },
  {
    slug: "social-media", legacySlugs: ["social-nfc-tags"], name: "Social Media", icon: "share-2", visualTheme: CategoryVisualTheme.VIOLET, landingLayout: CategoryLandingLayout.MOMENTUM,
    shortDescription: "One tap to a creator profile, social destination or flexible link collection.", heroEyebrow: "Tap. Connect. Follow.", heroHeadline: "Turn real-world attention into your next connection.", heroDescription: "Personalised NFC keyrings and badges for creators, events and anyone who wants a faster way to share the right profile.", heroImageAlt: "Tapkin social NFC tag connecting to creator profiles", cardTitle: "Social Media", cardText: "A memorable physical product linked to the profiles and destinations you control.", cardImageAlt: "Tapkin social media NFC keyring",
    ctaLabel: "Shop Social NFC", finalCtaEyebrow: "Make the moment count", finalCtaHeadline: "Your audience is one tap away.", finalCtaDescription: "Choose a personalised format and point it to the profile, campaign or link collection that matters now.", finalCtaLabel: "Shop Social NFC",
    benefits: [{ icon: "zap", title: "Instant sharing", description: "Open one destination directly or present a polished multi-link profile.", order: 0, visible: true }, { icon: "refresh-cw", title: "Change destinations", description: "Switch platforms later without reprinting or reprogramming the product.", order: 1, visible: true }, { icon: "sparkles", title: "Made personal", description: "Choose colour and printed text for a recognisable everyday object.", order: 2, visible: true }],
    useCases: [{ icon: "mic-2", title: "Creator events", description: "Turn a live conversation into a follow while interest is fresh.", order: 0, visible: true }, { icon: "shopping-bag", title: "Markets and pop-ups", description: "Connect packaging, stalls or displays to the right social destination.", order: 1, visible: true }, { icon: "camera", title: "Content collaborations", description: "Share a current portfolio or campaign without spelling out a username.", order: 2, visible: true }],
    howItWorks: [{ title: "Choose your format", description: "Pick a keyring, creator tag or wearable-style badge.", order: 0, visible: true }, { title: "Activate your profile", description: "Select direct redirect or a multi-link landing after delivery.", order: 1, visible: true }, { title: "Tap to connect", description: "Use it at events, counters, markets or everyday conversations.", order: 2, visible: true }],
    contentSections: [{ layout: "IMAGE_LEFT", eyebrow: "Built for change", heading: "Your next platform does not need a new keyring.", copy: "The printed product opens a permanent Tapkin address. Update the destination whenever your content strategy changes.", bulletPoints: ["Direct social redirect", "Multi-link profile", "Safe external URL validation", "Owner-controlled updates"], order: 0, visible: true }],
    faq: [{ question: "Can the tag open Instagram directly?", answer: "Yes. Direct redirect mode can open a validated Instagram or other HTTPS destination configured by the owner.", order: 0, enabled: true }],
  },
  {
    slug: "luggage", legacySlugs: ["luggage-tags"], name: "Luggage", icon: "luggage", visualTheme: CategoryVisualTheme.AMBER, landingLayout: CategoryLandingLayout.JOURNEY,
    shortDescription: "Privacy-conscious recovery profiles for luggage, backpacks and valuable equipment.", heroEyebrow: "Made to find its way back", heroHeadline: "Recovery details without your life on display.", heroDescription: "NFC and QR identification products that give a finder a simple way to contact you while revealing only what you choose.", heroImageAlt: "Tapkin smart luggage tag on travel gear", cardTitle: "Luggage", cardText: "Smart identification for suitcases, backpacks, travel bags and equipment.", cardImageAlt: "Tapkin NFC luggage identification tag",
    ctaLabel: "Shop Luggage Tags", finalCtaEyebrow: "Before the next departure", finalCtaHeadline: "Give every bag a better route home.", finalCtaDescription: "Add a durable identifier and control the minimum recovery details a finder can use.", finalCtaLabel: "Shop Luggage Tags",
    benefits: [{ icon: "map", title: "Travel ready", description: "A permanent digital profile works across changing trips and destinations.", order: 0, visible: true }, { icon: "eye-off", title: "Less exposed", description: "Avoid printing a full residential address on the outside of a bag.", order: 1, visible: true }, { icon: "message-circle", title: "Clear recovery message", description: "Tell a finder how to contact you and what to do next.", order: 2, visible: true }],
    useCases: [{ icon: "plane", title: "Checked luggage", description: "Offer a current contact route even when printed airline labels are damaged.", order: 0, visible: true }, { icon: "backpack", title: "Backpacks and carry-ons", description: "Identify the bags that move through airports, stations and daily commutes.", order: 1, visible: true }, { icon: "package", title: "Equipment cases", description: "Add an owner-controlled recovery profile to valuable working gear.", order: 2, visible: true }],
    howItWorks: [{ title: "Personalise the identifier", description: "Choose colour, printed name and a form suited to the item.", order: 0, visible: true }, { title: "Add recovery contacts", description: "Configure the minimum phone or email details a finder needs.", order: 1, visible: true }, { title: "Mark it lost when needed", description: "Lost mode makes the recovery message prominent while keeping owner control.", order: 2, visible: true }],
    contentSections: [{ layout: "TEXT_ONLY", eyebrow: "Ready for the next trip", heading: "One identifier for bags, gear and changing plans.", copy: "A Tapkin URL stays with the physical item. You can update the profile before every trip without buying another identifier.", bulletPoints: ["Permanent NFC and QR URL", "Lost-mode notice", "Owner-controlled contact information", "No residential address required"], order: 0, visible: true }],
    faq: [{ question: "Do I need to publish my home address?", answer: "No. The luggage profile is designed around a recovery message and the contact methods you choose.", order: 0, enabled: true }],
  },
];

type SeedOption = { code: string; name: string; type: CustomisationFieldType; required?: boolean; maxLength?: number; values?: string[] };
const commonColours = ["Black", "White", "Ocean", "Coral"];
const product = (slug: string, name: string, description: string, type: ProductType, sku: string, priceCents: number, category: string, options: SeedOption[], featured = false) => ({ slug, name, description, type, sku, priceCents, category, options, featured });
const catalog = [
  product("round-nfc-pet-tag", "Round NFC Pet Tag", "A lightweight round PETG tag with a fast, owner-controlled pet safety profile.", "PET", "PET-ROUND", 2495, "pet", [{ code: "pet-name", name: "Pet name", type: "SHORT_TEXT", required: true, maxLength: 24 }, { code: "colour", name: "Colour", type: "COLOUR", required: true, values: commonColours }], true),
  product("bone-nfc-pet-tag", "Bone NFC Pet Tag", "A distinctive bone-shaped tag for dogs, linked to medical notes and owner contacts.", "PET", "PET-BONE", 2695, "pet", [{ code: "pet-name", name: "Pet name", type: "SHORT_TEXT", required: true, maxLength: 24 }, { code: "colour", name: "Colour", type: "COLOUR", required: true, values: commonColours }]),
  product("heart-nfc-pet-tag", "Heart NFC Pet Tag", "A personalised heart tag for cats and dogs with NFC and a scannable QR fallback.", "PET", "PET-HEART", 2695, "pet", [{ code: "pet-name", name: "Pet name", type: "SHORT_TEXT", required: true, maxLength: 24 }, { code: "colour", name: "Colour", type: "COLOUR", required: true, values: commonColours }]),
  product("backpack-safety-tag", "Backpack Safety Tag", "A guardian-controlled NFC and QR safety profile for school bags and excursions.", "CHILD", "CHILD-BACKPACK", 2795, "child", [{ code: "printed-name", name: "Printed name", type: "SHORT_TEXT", required: true, maxLength: 20 }, { code: "colour", name: "Colour", type: "COLOUR", required: true, values: commonColours }], true),
  product("emergency-child-keyring", "Emergency Child Keyring", "A compact emergency keyring for guardian contacts and carefully selected medical guidance.", "CHILD", "CHILD-KEY", 2595, "child", [{ code: "printed-text", name: "Printed text", type: "SHORT_TEXT", maxLength: 20 }, { code: "colour", name: "Colour", type: "COLOUR", required: true, values: commonColours }]),
  product("social-nfc-keyring", "Social NFC Keyring", "A personalised keyring that opens one social destination or a flexible multi-link profile.", "SOCIAL", "SOCIAL-KEY", 1995, "social-media", [{ code: "printed-text", name: "Printed text", type: "SHORT_TEXT", maxLength: 24 }, { code: "colour", name: "Colour", type: "COLOUR", required: true, values: ["Black", "White", "Ocean", "Lime"] }], true),
  product("creator-nfc-tag", "Creator NFC Tag", "A creator-focused NFC product for events, markets and fast audience connections.", "SOCIAL", "SOCIAL-CREATOR", 2395, "social-media", [{ code: "creator-name", name: "Creator name", type: "SHORT_TEXT", required: true, maxLength: 28 }, { code: "colour", name: "Colour", type: "COLOUR", required: true, values: ["Black", "White", "Ocean", "Lime"] }]),
  product("nfc-business-keyring", "NFC Business Keyring", "A reusable digital contact product with phone, email, social links and downloadable vCard.", "BUSINESS", "BIZ-KEY", 2995, "business", [{ code: "display-name", name: "Name or company", type: "SHORT_TEXT", required: true, maxLength: 36 }, { code: "colour", name: "Colour", type: "COLOUR", required: true, values: ["Black", "White", "Navy"] }], true),
  product("google-review-stand", "Google Review Stand", "A counter-ready NFC and QR stand that opens a validated customer review destination.", "REVIEW", "BIZ-REVIEW", 4495, "business", [{ code: "business-name", name: "Business name", type: "SHORT_TEXT", required: true, maxLength: 40 }, { code: "colour", name: "Colour", type: "COLOUR", required: true, values: ["Black", "White", "Navy"] }]),
  product("smart-luggage-tag", "Smart Luggage Tag", "A durable travel tag with a minimal-contact recovery profile and lost-mode messaging.", "LUGGAGE", "LUG-TRAVEL", 2295, "luggage", [{ code: "printed-name", name: "Printed name", type: "SHORT_TEXT", required: true, maxLength: 28 }, { code: "colour", name: "Colour", type: "COLOUR", required: true, values: commonColours }], true),
  product("backpack-identification-tag", "Backpack Identification Tag", "A versatile NFC identifier for backpacks, cases and valuable everyday equipment.", "LUGGAGE", "LUG-BACKPACK", 2195, "luggage", [{ code: "printed-text", name: "Printed text", type: "SHORT_TEXT", required: true, maxLength: 28 }, { code: "colour", name: "Colour", type: "COLOUR", required: true, values: commonColours }]),
];

async function seedHomeDemo() {
  const store = await db.store.upsert({
    where: { slug: "home-demo" },
    update: { status: "ACTIVE", capabilities: [StoreCapability.COMMERCE, StoreCapability.CUSTOM_PERSONALISATION, StoreCapability.PRINT_3D, StoreCapability.INVENTORY] },
    create: {
      id: HOME_DEMO_STORE_ID,
      slug: "home-demo",
      name: "Home Demo",
      displayName: "Home Demo",
      status: "ACTIVE",
      supportEmail: "home-demo@example.com",
      seoTitle: "Home Demo · Useful 3D Printed Objects",
      seoDescription: "A development-only storefront demonstrating thoughtful 3D printed products for desks, organisation and everyday spaces.",
      theme: { accent: "#f2b880", accentSecondary: "#496b5d", background: "#f8f4ed", foreground: "#26332d", radius: "0.9rem", fontStyle: "modern" },
      homepage: { variant: "home-demo", heroEyebrow: "Useful objects, calmly considered", heroHeadline: "A more settled place for everyday things.", heroDescription: "Small-batch 3D printed products for desks, cables and the objects that deserve a proper place.", primaryCtaLabel: "Explore Home Demo", primaryCtaHref: "/shop" },
      organization: { type: "Organization", name: "Home Demo" },
      shippingConfig: { flatRateCents: 1100, freeOverCents: 7500 },
      capabilities: [StoreCapability.COMMERCE, StoreCapability.CUSTOM_PERSONALISATION, StoreCapability.PRINT_3D, StoreCapability.INVENTORY],
    },
  });
  await db.storeDomain.upsert({ where: { environment_hostname: { environment: DeploymentEnvironment.DEVELOPMENT, hostname: "home.localhost" } }, update: { storeId: store.id, protocol: "http", port: 3000, isPrimary: true }, create: { storeId: store.id, environment: DeploymentEnvironment.DEVELOPMENT, hostname: "home.localhost", protocol: "http", port: 3000, isPrimary: true } });
  await seedShipping(store.id, 1100, 7500, true);

  const categorySeeds = [
    { slug: "desk-organization", name: "Desk & Organization", icon: "layout-grid", visualTheme: CategoryVisualTheme.MIDNIGHT, landingLayout: CategoryLandingLayout.EDITORIAL, shortDescription: "Purpose-built forms that give everyday desk objects a calm, practical place.", heroEyebrow: "A clearer place to work", heroHeadline: "Organise the small things that interrupt your day.", heroDescription: "Functional stands and organisers printed in small batches for cables, devices and focused workspaces.", cardTitle: "Desk & Organization", cardText: "Phone stands, cable control and considered storage for a calmer surface.", benefits: [{ icon: "layout-grid", title: "Purposeful footprint", description: "Useful capacity without taking over the desk.", order: 0, visible: true }, { icon: "palette", title: "Made to fit", description: "Choose practical colours and sizes for the space.", order: 1, visible: true }], howItWorks: [{ title: "Choose the problem", description: "Start with the device, cable or surface that needs a better place.", order: 0, visible: true }, { title: "Select the finish", description: "Pick a colour and configuration suited to the setup.", order: 1, visible: true }, { title: "Made in small batches", description: "The item is printed, finished and checked before packing.", order: 2, visible: true }] },
    { slug: "everyday-comfort", name: "Everyday Comfort", icon: "lamp-desk", visualTheme: CategoryVisualTheme.AMBER, landingLayout: CategoryLandingLayout.JOURNEY, shortDescription: "Simple objects that make familiar routines feel a little easier.", heroEyebrow: "Comfort in the useful details", heroHeadline: "Small improvements for the spaces you use most.", heroDescription: "Thoughtful 3D printed accessories shaped around everyday storage, display and easy access.", cardTitle: "Everyday Comfort", cardText: "Practical forms with a warmer, quieter presence at home.", benefits: [{ icon: "sparkles", title: "Quietly useful", description: "Clear functions without visual clutter.", order: 0, visible: true }, { icon: "repeat", title: "Made for repetition", description: "Durable objects for routines that happen every day.", order: 1, visible: true }], howItWorks: [{ title: "Find the useful detail", description: "Choose an object designed around a familiar daily task.", order: 0, visible: true }, { title: "Make it yours", description: "Select an available colour and fit.", order: 1, visible: true }, { title: "Put it to work", description: "Unpack, place and use it without setup complexity.", order: 2, visible: true }] },
  ];
  const categoryIds = new Map<string, string>();
  for (const [sortOrder, item] of categorySeeds.entries()) {
    const category = await db.productCategory.upsert({
      where: { storeId_slug: { storeId: store.id, slug: item.slug } },
      update: { ...item, status: "PUBLISHED", sortOrder, showOnHomepage: true, showInNavigation: true, showInShop: true, showLanding: true, indexable: false, ctaHref: `/shop?category=${item.slug}`, finalCtaHref: `/shop?category=${item.slug}` },
      create: { ...item, storeId: store.id, status: "PUBLISHED", sortOrder, indexable: false, ctaHref: `/shop?category=${item.slug}`, finalCtaHref: `/shop?category=${item.slug}`, seoTitle: `${item.name} · Home Demo`, seoDescription: item.shortDescription },
    });
    await seedLandingSections(store.id, category.id, item, `/shop?category=${item.slug}`);
    categoryIds.set(item.slug, category.id);
  }
  const demoProducts = [
    product("minimal-phone-stand", "Minimal Phone Stand", "An angled desktop stand with a compact footprint and a clear charging path.", ProductType.ACCESSORY, "HOME-DEMO-PHONE", 2995, "desk-organization", [{ code: "colour", name: "Colour", type: "COLOUR", required: true, values: ["Sand", "Forest", "Charcoal"] }], true),
    product("cable-organizer", "Cable Organizer", "A low-profile cable guide that keeps charging leads ready without dominating the desk.", ProductType.ACCESSORY, "HOME-DEMO-CABLE", 1495, "desk-organization", [{ code: "colour", name: "Colour", type: "COLOUR", required: true, values: ["Sand", "Forest", "Charcoal"] }]),
    product("headphone-holder", "Headphone Holder", "A stable home for headphones designed to keep the everyday setup clear and accessible.", ProductType.ACCESSORY, "HOME-DEMO-HEADPHONE", 3495, "everyday-comfort", [{ code: "colour", name: "Colour", type: "COLOUR", required: true, values: ["Sand", "Forest", "Charcoal"] }], true),
  ];
  for (const item of demoProducts) {
    const categoryId = categoryIds.get(item.category)!;
    const productRecord = await db.product.upsert({ where: { storeId_slug: { storeId: store.id, slug: item.slug } }, update: { name: item.name, description: item.description, shortDescription: item.description, categoryId, status: "ACTIVE", shopVisible: true, featured: item.featured, brand: store.displayName }, create: { storeId: store.id, slug: item.slug, name: item.name, description: item.description, shortDescription: item.description, type: item.type, categoryId, status: "ACTIVE", shopVisible: true, featured: item.featured, brand: store.displayName } });
    await db.productVariant.upsert({ where: { sku: item.sku }, update: { productId: productRecord.id, name: "Standard", priceCents: item.priceCents, active: true }, create: { productId: productRecord.id, sku: item.sku, name: "Standard", priceCents: item.priceCents, inventory: 40 } });
    for (const [sortOrder, optionSeed] of item.options.entries()) {
      const option = await db.productOption.upsert({ where: { productId_code: { productId: productRecord.id, code: optionSeed.code } }, update: { name: optionSeed.name, type: optionSeed.type, required: optionSeed.required ?? false, sortOrder, active: true }, create: { productId: productRecord.id, code: optionSeed.code, name: optionSeed.name, type: optionSeed.type, required: optionSeed.required ?? false, sortOrder } });
      for (const [valueOrder, value] of (optionSeed.values ?? []).entries()) await db.productOptionValue.upsert({ where: { optionId_value: { optionId: option.id, value: value.toLowerCase() } }, update: { label: value, sortOrder: valueOrder, active: true }, create: { optionId: option.id, label: value, value: value.toLowerCase(), sortOrder: valueOrder } });
    }
  }
  return store;
}

async function main() {
  const environment = currentAppEnvironment();
  if (environment === "production") throw new Error("Production seeding is disabled. Bootstrap real administrators through the controlled production procedure.");
  if (environment === "staging" && process.env.ALLOW_STAGING_SEED !== "true") throw new Error("Set ALLOW_STAGING_SEED=true explicitly to load controlled staging data");
  if (environment !== "development" && (process.env.DEV_ADMIN_EMAIL || process.env.DEV_ADMIN_PASSWORD)) throw new Error("Development administrator credentials are allowed only in DEVELOPMENT");
  if (environment !== "staging" && (process.env.STAGING_ADMIN_EMAIL || process.env.STAGING_ADMIN_PASSWORD)) throw new Error("Staging administrator credentials are allowed only in STAGING");
  const store = await db.store.upsert({
    where: { slug: "tapkin" },
    update: { displayName: "Tapkin", status: "ACTIVE", capabilities: [StoreCapability.COMMERCE, StoreCapability.NFC, StoreCapability.DIGITAL_PROFILE, StoreCapability.PET_PROFILE, StoreCapability.CHILD_SAFETY, StoreCapability.SOCIAL_PROFILE, StoreCapability.BUSINESS_PROFILE, StoreCapability.CUSTOM_PERSONALISATION, StoreCapability.PRINT_3D, StoreCapability.INVENTORY] },
    create: { id: TAPKIN_STORE_ID, slug: "tapkin", name: "Tapkin", displayName: "Tapkin", status: "ACTIVE", supportEmail: "hello@example.com", seoTitle: "Tapkin Smart Products", seoDescription: "Personalised smart products combining 3D printing, NFC, QR and secure digital profiles.", theme: { accent: "#ee6c4d", accentSecondary: "#2f7f77", background: "#f7f3eb", foreground: "#14213d", radius: "1.25rem", fontStyle: "editorial" }, homepage: { variant: "tapkin", heroEyebrow: "Smart products, thoughtfully connected", heroHeadline: "Useful objects with a digital superpower", heroDescription: "Personalised products made in Australia with 3D printing, NFC and QR.", primaryCtaLabel: "Shop smart products", primaryCtaHref: "/shop" }, organization: { type: "Organization", name: "Tapkin" }, shippingConfig: { flatRateCents: 900, freeOverCents: 6000 }, capabilities: [StoreCapability.COMMERCE, StoreCapability.NFC, StoreCapability.DIGITAL_PROFILE, StoreCapability.PET_PROFILE, StoreCapability.CHILD_SAFETY, StoreCapability.SOCIAL_PROFILE, StoreCapability.BUSINESS_PROFILE, StoreCapability.CUSTOM_PERSONALISATION, StoreCapability.PRINT_3D, StoreCapability.INVENTORY] },
  });
  const deployment = environment.toUpperCase() as DeploymentEnvironment;
  const hostname = environment === "staging" ? "staging.tapkin.com.au" : "localhost";
  await db.storeDomain.upsert({ where: { environment_hostname: { environment: deployment, hostname } }, update: { storeId: store.id, isPrimary: true, protocol: environment === "development" ? "http" : "https", port: environment === "development" ? 3000 : null }, create: { storeId: store.id, environment: deployment, hostname, isPrimary: true, protocol: environment === "development" ? "http" : "https", port: environment === "development" ? 3000 : null } });
  await seedShipping(store.id, 900, 6000, environment === "development");
  const categoryIds = new Map<string, string>();
  for (const [sortOrder, item] of categories.entries()) {
    const ctaHref = `/shop?category=${item.slug}`;
    const category = await db.productCategory.upsert({ where: { storeId_slug: { storeId: store.id, slug: item.slug } }, update: { ...item, ctaHref, finalCtaHref: ctaHref, sortOrder, status: "PUBLISHED", showOnHomepage: true, showInNavigation: true, showInShop: true, showLanding: true, indexable: true, seoTitle: `${item.name} NFC Products Australia`, seoDescription: item.shortDescription }, create: { ...item, storeId: store.id, ctaHref, finalCtaHref: ctaHref, sortOrder, status: "PUBLISHED", seoTitle: `${item.name} NFC Products Australia`, seoDescription: item.shortDescription } });
    await seedLandingSections(store.id, category.id, item, ctaHref);
    categoryIds.set(item.slug, category.id);
  }
  for (const item of catalog) {
    const categoryId = categoryIds.get(item.category);
    if (!categoryId) throw new Error(`Seed category ${item.category} is missing`);
    const productRecord = await db.product.upsert({ where: { storeId_slug: { storeId: store.id, slug: item.slug } }, update: { name: item.name, description: item.description, shortDescription: item.description, type: item.type, categoryId, status: "ACTIVE", shopVisible: true, featured: item.featured, brand: "Tapkin" }, create: { storeId: store.id, slug: item.slug, name: item.name, description: item.description, shortDescription: item.description, type: item.type, categoryId, status: "ACTIVE", shopVisible: true, featured: item.featured, brand: "Tapkin" } });
    await db.productVariant.upsert({ where: { sku: item.sku }, update: { productId: productRecord.id, name: "Standard", priceCents: item.priceCents, active: true }, create: { productId: productRecord.id, sku: item.sku, name: "Standard", priceCents: item.priceCents, inventory: 100 } });
    for (const [sortOrder, optionSeed] of item.options.entries()) {
      const option = await db.productOption.upsert({ where: { productId_code: { productId: productRecord.id, code: optionSeed.code } }, update: { name: optionSeed.name, type: optionSeed.type, required: optionSeed.required ?? false, maxLength: optionSeed.maxLength, sortOrder, active: true }, create: { productId: productRecord.id, code: optionSeed.code, name: optionSeed.name, type: optionSeed.type, required: optionSeed.required ?? false, maxLength: optionSeed.maxLength, sortOrder } });
      for (const [valueOrder, value] of (optionSeed.values ?? []).entries()) await db.productOptionValue.upsert({ where: { optionId_value: { optionId: option.id, value: value.toLowerCase() } }, update: { label: value, sortOrder: valueOrder, active: true }, create: { optionId: option.id, label: value, value: value.toLowerCase(), sortOrder: valueOrder } });
    }
  }
  const homeDemoStore = environment === "development" ? await seedHomeDemo() : null;
  await db.storeSettings.upsert({ where: { id: "default" }, update: { storeName: "Tapkin", siteTitle: "Tapkin Smart Products", siteDescription: "Personalised smart products combining 3D printing, NFC, QR and secure digital profiles." }, create: { id: "default", storeName: "Tapkin", siteTitle: "Tapkin Smart Products", siteDescription: "Personalised smart products combining 3D printing, NFC, QR and secure digital profiles." } });
  const emailName = environment === "staging" ? "STAGING_ADMIN_EMAIL" : "DEV_ADMIN_EMAIL";
  const passwordName = environment === "staging" ? "STAGING_ADMIN_PASSWORD" : "DEV_ADMIN_PASSWORD";
  const email = process.env[emailName]?.trim().toLowerCase(); const password = process.env[passwordName];
  if (Boolean(email) !== Boolean(password)) throw new Error(`Set both ${emailName} and ${passwordName}, or leave both empty`);
  if (email && password) {
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) throw new Error(parsedPassword.error.issues[0]?.message ?? "Invalid administrator password");
    const passwordHash = await hashPassword(parsedPassword.data);
    const admin = await db.user.upsert({ where: { email }, update: { role: Role.ADMIN, passwordHash, emailVerifiedAt: new Date() }, create: { email, name: environment === "staging" ? "Staging Admin" : "Development Admin", role: Role.ADMIN, passwordHash, emailVerifiedAt: new Date() } });
    for (const target of [store, homeDemoStore].filter((item): item is NonNullable<typeof item> => Boolean(item))) await db.storeMembership.upsert({ where: { storeId_userId: { storeId: target.id, userId: admin.id } }, update: { role: "ADMIN" }, create: { storeId: target.id, userId: admin.id, role: "ADMIN" } });
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Database seed failed"); process.exitCode = 1; }).finally(() => db.$disconnect());
