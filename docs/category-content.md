# Category content operations

Tapkin categories are database records managed at **Admin → Content → Categories**. Pet, Child, Business, Social Media and Luggage are seeded as normal records; they have no privileged or name-based logic and can be edited, hidden, archived or reactivated in exactly the same way as a future category.

## Public journey

Each published category has a clean root URL (`/pet`, `/child`, `/business`, `/social-media` or `/luggage`). Home cards and navigation open that commercial landing. Every primary and final CTA enters the single Shop with the category filter active, for example `/shop?category=pet`.

Changing a category slug from Admin stores the previous slug as a historical alias and issues a permanent redirect to the new URL. Application-reserved slugs such as `admin`, `shop`, `products` and `t` cannot be assigned to a category.

## Editing a landing

The editor provides structured, validated fields rather than arbitrary HTML:

- **General:** name, slug, icon, status, display order, visual theme and landing composition.
- **Homepage card:** title, copy, image URL and alt text.
- **Landing hero:** eyebrow, headline, description, primary/secondary CTA, images and alt text.
- **Benefits, use cases and how it works:** ordered, individually visible items.
- **Content sections:** ordered image/text or text-only blocks with bullet points and an optional CTA.
- **FAQ:** ordered questions that can be disabled individually and are used for legitimate FAQ structured data.
- **Final CTA:** closing message and filtered Shop destination.
- **Visibility:** independent Home, navigation, Shop-filter and landing switches.
- **SEO:** title, description, OpenGraph image, canonical URL and indexability.

The visual theme controls colour identity. The landing composition controls section order and presentation. These fields let categories feel distinct while keeping a coherent Tapkin component system and avoiding code branches based on category names.

## Lifecycle and safety

`DRAFT`, `HIDDEN` and `ARCHIVED` categories are unavailable as public landing pages and excluded from commercial discovery. Category records are never permanently deleted from Admin. Hiding or archiving a category does not update products, orders, profiles or issued NFC tags.

Shop and checkout apply commercial category/product policy. `/t/{publicTagId}` applies the independent tag lifecycle policy. An existing active tag therefore continues to resolve and remains manageable even if its category or product is hidden, archived or out of stock.

## Products and media

Products are assigned or moved through **Admin → Catalog → Products → Product details → Category**. Any number of products can share one category.

The seed deliberately uses licensed-safe visual placeholders rather than third-party photography. Before launch, upload product media through Admin and provide owned category photography from an approved HTTPS media host, then set meaningful alt text. A unified category-media upload picker remains a visual-operations enhancement. Recommended assets are:

- one landscape hero image per category (approximately 1600 × 1200 px);
- one landscape Home card image per category (approximately 1200 × 800 px);
- square product images for every sellable design;
- optional supporting images for structured content sections.

Use WebP, PNG or JPEG within the Admin upload limits. Child-category imagery and copy should avoid names, uniforms, school identifiers, addresses, routines or other identifying details.
