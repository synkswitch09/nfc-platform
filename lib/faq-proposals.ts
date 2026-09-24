// Editorial starters for the existing /faq page. These describe general concepts;
// product specifications, service availability and commercial terms require review.
export type FaqProposal = { topic: "NFC" | "3D printing"; question: string; answer: string };

export const faqProposals: FaqProposal[] = [
  { topic: "NFC", question: "What is the difference between NFC and a QR code?", answer: "NFC can open a link when a compatible phone is held close to a tag. A QR code opens a link when scanned with a camera or QR reader." },
  { topic: "NFC", question: "Are NFC, QR codes and GPS the same thing?", answer: "No. NFC and QR codes can provide ways to open a link. GPS is a different technology used for positioning. An NFC chip or QR code alone is not a live location tracker." },
  { topic: "NFC", question: "Does a web profile need an internet connection?", answer: "Yes. A phone needs an internet connection to load a web profile and its current information." },
  { topic: "NFC", question: "Does someone need an app to open a web link from a tag?", answer: "A link can open in a phone's web browser. The phone must be able to read the tag or scan its QR code, if one is provided." },
  { topic: "NFC", question: "Is changing an online profile the same as rewriting an NFC chip?", answer: "No. Updating a hosted profile changes the information available at its web address. Rewriting a chip changes the data stored on the chip itself and depends on the chip's configuration." },
  { topic: "NFC", question: "Does every 3D-printed product include NFC?", answer: "No. A 3D-printed item does not automatically contain an NFC chip, QR code or online profile. Check the individual product description for included features." },
  { topic: "NFC", question: "Is an NFC profile tag a contactless payment card?", answer: "No. A profile tag intended to open information is not your bank card or payment wallet." },
  { topic: "3D printing", question: "What is 3D printing?", answer: "3D printing builds a physical object from a digital model in successive layers. The process, material and finishing choices affect the result." },
  { topic: "3D printing", question: "Will a 3D-printed item have visible layer lines?", answer: "It can. Surface appearance depends on the design, printing process and finishing. Check actual product photos and descriptions for the finish to expect." },
  { topic: "3D printing", question: "What affects the price of a 3D-printed item?", answer: "Size, shape, material, production time, colours, finishing, quantity and design work can affect cost. A custom job needs its requirements reviewed before a reliable price can be given." },
  { topic: "3D printing", question: "Why can similarly sized prints have different prices?", answer: "Size alone does not describe all the work. Different details, materials, colour changes and finishing requirements can lead to different production costs." },
  { topic: "3D printing", question: "What is the difference between a ready-made and a custom design?", answer: "A ready-made design already defines the object's shape. Custom design involves creating or changing that shape. Design and printing are separate parts of a project; check which are included in any quote." },
  { topic: "3D printing", question: "Will the colour look exactly the same as on my screen?", answer: "Screen settings and lighting affect how colours appear. Product photos and colour names are guides; ask before ordering if an exact colour match is important." },
  { topic: "3D printing", question: "Can every 3D-printed item be used outdoors or in a hot car?", answer: "No. Suitability depends on the specific material, design and conditions. Follow the product's stated use and care guidance." },
  { topic: "3D printing", question: "How do I choose the right printing material?", answer: "Consider where the item will be used, expected loads, heat, moisture and the desired finish. Check the material and care information for the specific product." },
];

export function faqQuestionKey(question: string) {
  return question.toLocaleLowerCase("en-AU").replace(/[^a-z0-9]+/g, " ").trim();
}

export function availableFaqProposals(
  proposals: FaqProposal[],
  existingQuestions: string[],
  capabilities: { nfc: boolean; print3d: boolean },
) {
  const seen = new Set(existingQuestions.map(faqQuestionKey));
  return proposals.filter(({ topic, question }) => {
    if (topic === "NFC" && !capabilities.nfc) return false;
    if (topic === "3D printing" && !capabilities.print3d) return false;
    const key = faqQuestionKey(question);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
