import { blankLandingSection, type LandingSectionDraft } from "@/lib/landing-sections";

const image = (name: string) => `/images/tapkin/pets/${name}.webp`;

/** Editable starter content; every block remains a regular CMS landing section. */
export function petsLandingTemplate(categorySlug = "pet"): LandingSectionDraft[] {
  const shopHref = `/shop?category=${categorySlug}`;
  const pageHref = `/${categorySlug}`;
  const section = (
    type: LandingSectionDraft["type"],
    name: string,
    content: Record<string, unknown>,
  ): LandingSectionDraft => {
    const blank = blankLandingSection(type);
    return {
      ...blank,
      name,
      content: {
        ...blank.content,
        layoutVariant: "PASTEL_EDITORIAL",
        ...content,
      },
    };
  };
  const item = (title: string, description: string, extra = {}) => ({
    id: crypto.randomUUID(),
    title,
    description,
    visible: true,
    ...extra,
  });
  return [
    section("HERO", "Pets · Hero", {
      hideBreadcrumbs: true,
      eyebrow: "MORE THAN A PET TAG",
      headline: "A little more peace of mind, wherever they wander.",
      copy: "A personalised smart pet tag with NFC that helps a finder contact you quickly.",
      imageUrl: image("hero-dog"),
      imageAlt: "White dog wearing a Tapkin pet tag",
      imageFit: "CONTAIN",
      ctaLabel: "Shop pet tags",
      ctaHref: shopHref,
      secondaryCtaLabel: "See how it works",
      secondaryCtaHref: `${pageHref}#how-it-works`,
      features: [
        { id: crypto.randomUUID(), icon: "radio", label: "NFC Technology", supportingText: "Just tap", visible: true },
        { id: crypto.randomUUID(), icon: "phone", label: "No finder app needed", supportingText: "Opens in a browser", visible: true },
        { id: crypto.randomUUID(), icon: "square-pen", label: "Editable anytime", supportingText: "Keep details current", visible: true },
        { id: crypto.randomUUID(), icon: "paw", label: "Everyday wear", supportingText: "Made for pets", visible: true },
      ],
    }),
    section("BENEFITS", "Pets · Benefits", {
      eyebrow: "WHY TAPKIN PETS",
      headline: "When it matters most, finding the right information should be simple.",
      columns: 3,
      items: [
        item("Easy to understand", "A quick tap brings their details into view, so someone can help without guesswork.", { icon: "qr-code" }),
        item("Made to belong", "A personalised tag that feels like a natural part of their everyday collar.", { icon: "paw" }),
        item("Information you can update", "Change contact details whenever life changes, without replacing the tag.", { icon: "refresh-cw" }),
      ],
    }),
    section("STEPS", "Pets · How to get started", {
      anchorId: "how-it-works",
      eyebrow: "HOW TO GET STARTED",
      headline: "Three simple steps.",
      columns: 3,
      imageFit: "CONTAIN",
      ctaLabel: "Already have a tag? Activate it →",
      ctaHref: "/activate",
      items: [
        item("Choose your tag", "Pick the design that feels right for your pet.", { imageUrl: image("step-choose"), imageAlt: "Personalised pet tag designs" }),
        item("Your Tapkin arrives", "We'll send your tag ready for its new adventure.", { imageUrl: image("step-delivery"), imageAlt: "Tapkin pet tag packaging" }),
        item("Activate & you're all set", "Add their details and attach the tag to their collar.", { imageUrl: image("step-activate"), imageAlt: "Phone activating a Tapkin pet tag" }),
      ],
    }),
    section("FEATURE_LIST", "Pets · Tag features", {
      eyebrow: "OUR TAGS",
      headline: "Personalised.\nLightweight.\nConnected.",
      imageUrl: image("pet-tags"),
      imageAlt: "Two personalised Tapkin pet tags",
      imageFit: "CONTAIN",
      ctaLabel: "Explore all designs",
      ctaHref: shopHref,
      items: [
        item("Personalised with their name", ""),
        item("Contact details you can edit", ""),
        item("Lost status when you need it", ""),
        item("Your privacy stays in your hands", ""),
        item("Lightweight for everyday wear", ""),
      ],
    }),
    section("STORY_PROCESS", "Pets · If they lose their way", {
      eyebrow: "IF THEY EVER LOSE THEIR WAY",
      headline: "Tapkin Pets helps whoever finds your pet know what to do and how to reach you.",
      backgroundColour: "#e5f6eb",
      columns: 3,
      imageUrl: image("profile-phone"),
      imageAlt: "A Tapkin pet profile on a phone",
      imageFit: "CONTAIN",
      items: [
        item("Someone stops to help", "They can tap the tag with their phone.", { imageUrl: image("finder-help"), imageAlt: "Someone helping a lost cat" }),
        item("What matters most", "They see the information you've chosen to share.", { imageUrl: image("finder-details"), imageAlt: "Pet profile and cat" }),
        item("One step closer to home", "They can contact you to help bring your pet home.", { imageUrl: image("finder-reunion"), imageAlt: "Person reunited with a cat" }),
      ],
    }),
    section("FAQ", "Pets · Questions", {
      eyebrow: "FREQUENTLY ASKED QUESTIONS",
      headline: "Good to know.",
      columns: 4,
      items: [
        { id: crypto.randomUUID(), question: "Does the tag have GPS?", answer: "No. Tapkin uses NFC: someone nearby taps the tag to open the pet profile. The tag does not track your pet's location.", visible: true },
        { id: crypto.randomUUID(), question: "Does the finder need an app?", answer: "No app is needed. A finder can open the profile in a compatible phone's browser by tapping the tag.", visible: true },
        { id: crypto.randomUUID(), question: "Can I update my pet's details?", answer: "Yes. You can edit the information on your pet's profile whenever you need to.", visible: true },
        { id: crypto.randomUUID(), question: "Is it for cats and dogs?", answer: "Yes. Attach the tag securely to a suitable collar or harness for your cat or dog.", visible: true },
      ],
    }),
    section("CTA_BANNER", "Pets · Shop", {
      headline: "Ready for the day you need it.",
      imageUrl: image("cta-cat"),
      imageAlt: "Cat wearing a Tapkin pet tag",
      ctaLabel: "Shop now",
      ctaHref: shopHref,
      overlay: "NONE",
      contentPosition: "LEFT",
      imagePosition: "RIGHT",
    }),
  ];
}
