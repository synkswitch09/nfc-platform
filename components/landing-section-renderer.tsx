import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  PackageCheck,
  Palette,
  Printer,
  QrCode,
  Radio,
} from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { parseLandingContent } from "@/lib/landing-sections";
import { typographyVariables, type TypographyOverride } from "@/lib/typography";
import type { PublicCategory } from "@/lib/category-query";
import type { LandingSectionType, Prisma } from "@prisma/client";

type Item = {
  id: string;
  icon?: string;
  title?: string;
  description?: string;
  supportingText?: string;
  imageUrl?: string;
  imageAlt?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaBackground?: string;
  ctaTextColour?: string;
  ctaBorderColour?: string;
  backgroundColour?: string;
  textColour?: string;
  iconBackgroundColour?: string;
  iconColour?: string;
  imagePosition?: number;
  visible?: boolean;
  order?: number;
};
type Feature = {
  id: string;
  icon?: string;
  label?: string;
  supportingText?: string;
  backgroundColour?: string;
  iconColour?: string;
  visible?: boolean;
  order?: number;
};
type TextBlock = {
  id: string;
  type?: string;
  text?: string;
  visible?: boolean;
  order?: number;
};
type FaqItem = {
  id: string;
  question?: string;
  answer?: string;
  visible?: boolean;
  order?: number;
};
type RenderSection = {
  id: string;
  type: LandingSectionType;
  name: string;
  visible?: boolean;
  content: Prisma.JsonValue;
};
type RenderProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string | null;
  featured: boolean;
  images: Array<{ url: string; altText: string }>;
  variants: Array<{ priceCents: number }>;
};
type RenderCategory = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  cardTitle: string | null;
  cardText: string | null;
  cardImageUrl: string | null;
  cardImageAlt: string | null;
  icon: string | null;
};

type ModularPageProps = {
  name: string;
  sections: RenderSection[];
  products: RenderProduct[];
  categories: RenderCategory[];
  store: { displayName: string; currency: string; nfcEnabled: boolean };
  shopHref?: string;
  theme?: string;
  fallbackHeadline?: string;
  fallbackCopy?: string;
  fallbackIcon?: string | null;
  breadcrumbs?: Array<{ label: string; href?: string }>;
};

export function LandingSectionRenderer({
  category,
  store,
}: {
  category: PublicCategory;
  store: { displayName: string; currency: string; nfcEnabled: boolean };
}) {
  return (
    <ModularPageRenderer
      name={category.name}
      sections={category.landingSections}
      products={category.products}
      categories={category.store.categories}
      store={store}
      shopHref={`/shop?category=${category.slug}`}
      theme={category.visualTheme.toLowerCase()}
      fallbackHeadline={category.heroHeadline || category.name}
      fallbackCopy={category.heroDescription || category.description || ""}
      fallbackIcon={category.icon}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Shop", href: "/shop" },
        { label: category.name },
      ]}
    />
  );
}

export function ModularPageRenderer({
  name,
  sections,
  products,
  categories,
  store,
  shopHref = "/shop",
  theme = "coral",
  fallbackHeadline = name,
  fallbackCopy = "",
  fallbackIcon = "sparkles",
  breadcrumbs,
}: ModularPageProps) {
  const money = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: store.currency,
  });
  return (
    <div className="category-landing modular-landing" data-theme={theme}>
      {breadcrumbs && (
        <nav
          className="breadcrumbs category-breadcrumbs"
          aria-label="Breadcrumb"
        >
          {breadcrumbs.map((item, index) => (
            <span key={breadcrumbKey(item, index)}>
              {index > 0 && <i aria-hidden="true">/</i>}
              {item.href ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                item.label
              )}
            </span>
          ))}
        </nav>
      )}
      {sections
        .filter((section) => section.visible !== false)
        .map((section, sectionIndex) => {
          const value = parseLandingContent(section.type, section.content);
          if (!value) return null;
          const common = readCommon(value, section.name);
          const presentation = sectionPresentation(value);
          if (section.type === "HERO") {
            const features = ordered<Feature>(value.features);
            const textBlocks = ordered<TextBlock>(value.textBlocks);
            return (
              <section
                key={renderSectionKey(section, sectionIndex)}
                className="category-landing-hero modular-hero"
                {...presentation}
              >
                <div className="category-hero-copy">
                  <SectionCopy
                    {...common}
                    fallbackHeadline={fallbackHeadline}
                    fallbackCopy={fallbackCopy}
                    textBlocks={textBlocks}
                  />
                  {features.length ? (
                    <div className="modular-hero-features">
                      {features.map((feature, index) => (
                        <div key={collectionKey("hero-feature", feature, index)}>
                          <span
                            style={{
                              backgroundColor: colour(feature.backgroundColour),
                              color: colour(feature.iconColour),
                            }}
                          >
                            <CategoryIcon name={feature.icon} size={20} />
                          </span>
                          <small>{feature.label}</small>
                          {feature.supportingText && (
                            <em>{feature.supportingText}</em>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <DefaultFeatures nfcEnabled={store.nfcEnabled} />
                  )}
                  <SectionActions value={value} fallbackHref={shopHref} />
                </div>
                <SectionImage
                  url={common.imageUrl}
                  alt={common.imageAlt || `${name} products`}
                  priority
                  imageStyle={mediaStyle(value)}
                  placeholder={
                    <PagePlaceholder
                      icon={fallbackIcon}
                      name={name}
                      storeName={store.displayName}
                    />
                  }
                />
              </section>
            );
          }
          if (section.type === "FEATURE_LIST") {
            const items = ordered<Item>(value.items);
            return (
              <section
                key={renderSectionKey(section, sectionIndex)}
                className="modular-feature-showcase"
                {...presentation}
              >
                <div>
                  <Heading
                    eyebrow={common.eyebrow}
                    headline={common.headline}
                    copy={common.copy}
                  />
                  <SectionActions value={value} fallbackHref={shopHref} />
                </div>
                <SectionImage
                  url={common.imageUrl}
                  alt={common.imageAlt}
                  imageStyle={mediaStyle(value)}
                  placeholder={
                    <PagePlaceholder
                      icon={fallbackIcon}
                      name={name}
                      storeName={store.displayName}
                    />
                  }
                />
                <ul>
                  {items.map((item, index) => (
                    <li
                      style={{ color: colour(item.textColour) }}
                      key={collectionKey("feature-item", item, index)}
                    >
                      <span
                        style={{
                          backgroundColor: colour(item.iconBackgroundColour),
                          color: colour(item.iconColour),
                        }}
                      >
                        <Check size={17} />
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        {item.description && <p>{item.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          }
          if (section.type === "STORY_PROCESS") {
            const items = ordered<Item>(value.items);
            return (
              <section
                key={renderSectionKey(section, sectionIndex)}
                className="modular-story-process"
                {...presentation}
              >
                <div className="story-process-copy">
                  <Heading
                    eyebrow={common.eyebrow}
                    headline={common.headline}
                    copy={common.copy}
                  />
                  <div className="story-process-items">
                    {items.map((item, index) => (
                      <article
                        style={{ color: colour(item.textColour) }}
                        key={collectionKey("story-item", item, index)}
                      >
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.imageAlt || ""}
                            width={260}
                            height={180}
                            style={mediaStyle(value)}
                            unoptimized
                          />
                        ) : (
                          <span
                            className="icon"
                            style={{
                              backgroundColor: colour(
                                item.iconBackgroundColour,
                              ),
                              color: colour(item.iconColour),
                            }}
                          >
                            <CategoryIcon name={item.icon} />
                          </span>
                        )}
                        <div>
                          <h3>{item.title}</h3>
                          {item.description && <p>{item.description}</p>}
                        </div>
                      </article>
                    ))}
                  </div>
                  <SectionActions value={value} fallbackHref={shopHref} />
                </div>
                <SectionImage
                  url={common.imageUrl}
                  alt={common.imageAlt}
                  imageStyle={mediaStyle(value)}
                  placeholder={
                    <PagePlaceholder
                      icon={fallbackIcon}
                      name={name}
                      storeName={store.displayName}
                    />
                  }
                />
              </section>
            );
          }
          if (
            [
              "BENEFITS",
              "FEATURE_BADGES",
              "TRUST_STRIP",
              "STATS",
              "STEPS",
            ].includes(section.type)
          ) {
            const items = ordered<Item>(value.items);
            const className =
              section.type === "STEPS"
                ? "modular-steps"
                : `modular-${section.type.toLowerCase().replaceAll("_", "-")}`;
            return (
              <section
                key={renderSectionKey(section, sectionIndex)}
                className={`category-benefits ${className}`}
                {...presentation}
              >
                <Heading
                  eyebrow={common.eyebrow}
                  headline={common.headline}
                  copy={common.copy}
                />
                <div
                  className={
                    section.type === "STEPS" ? "step-grid" : "benefit-grid"
                  }
                >
                  {items.map((item, index) => (
                    <article
                      style={itemStyle(item)}
                      key={collectionKey("benefit-item", item, index)}
                    >
                      {item.imageUrl && (
                        <div
                          className="modular-item-image"
                          style={{
                            translate: `0 ${number(item.imagePosition)}px`,
                          }}
                        >
                          <Image
                            src={item.imageUrl}
                            alt={item.imageAlt || ""}
                            width={560}
                            height={380}
                            style={mediaStyle(value)}
                            unoptimized
                          />
                        </div>
                      )}
                      <span
                        className={
                          section.type === "STEPS" ? "step-number" : "icon"
                        }
                        style={{
                          backgroundColor: colour(item.iconBackgroundColour),
                          color: colour(item.iconColour),
                        }}
                      >
                        {section.type === "STEPS" ? (
                          index + 1
                        ) : (
                          <CategoryIcon name={item.icon} />
                        )}
                      </span>
                      <div>
                        <h3>{item.title}</h3>
                        {item.description && <p>{item.description}</p>}
                        {item.supportingText && (
                          <small>{item.supportingText}</small>
                        )}
                        {item.ctaLabel && item.ctaHref && (
                          <Link
                            className="item-cta"
                            style={itemButtonStyle(item)}
                            href={item.ctaHref}
                          >
                            {item.ctaLabel}
                          </Link>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <SectionActions value={value} fallbackHref={shopHref} />
              </section>
            );
          }
          if (["PRODUCT_SHOWCASE", "PRODUCT_GRID"].includes(section.type)) {
            const visibleProducts = products
              .filter((product) => !value.featuredOnly || product.featured)
              .slice(0, number(value.limit, 6));
            return (
              <section
                key={renderSectionKey(section, sectionIndex)}
                className="category-products"
                {...presentation}
              >
                <Heading
                  eyebrow={common.eyebrow}
                  headline={common.headline}
                  copy={common.copy}
                />
                <div className="shop-grid">
                  {visibleProducts.map((product, index) => (
                    <article
                      className="card product-card"
                      key={collectionKey("product", product, index)}
                    >
                      {product.images[0] ? (
                        <Image
                          className="category-product-image"
                          src={product.images[0].url}
                          alt={product.images[0].altText}
                          width={500}
                          height={500}
                          unoptimized
                        />
                      ) : (
                        <div className="category-product-placeholder">
                          <CategoryIcon name={fallbackIcon} />
                          <span>Made to order</span>
                        </div>
                      )}
                      <h3>{product.name}</h3>
                      <p>{product.shortDescription ?? product.description}</p>
                      {product.variants[0] && (
                        <strong className="price">
                          From{" "}
                          {money.format(product.variants[0].priceCents / 100)}
                        </strong>
                      )}
                      <Link
                        className="button"
                        href={`/products/${product.slug}`}
                      >
                        View product
                      </Link>
                    </article>
                  ))}
                </div>
                <Link className="category-shop-link" href={shopHref}>
                  View the full collection
                </Link>
              </section>
            );
          }
          if (section.type === "CATEGORY_GRID")
            return (
              <section
                key={renderSectionKey(section, sectionIndex)}
                className="category-benefits modular-category-grid"
                {...presentation}
              >
                <Heading
                  eyebrow={common.eyebrow}
                  headline={common.headline}
                  copy={common.copy}
                />
                <div className="category-card-grid">
                  {categories.slice(0, number(value.limit, 6)).map((item, index) => (
                    <Link
                      className="category-card"
                      href={`/${item.slug}`}
                      key={collectionKey("category", item, index)}
                    >
                      {item.cardImageUrl ? (
                        <Image
                          src={item.cardImageUrl}
                          alt={item.cardImageAlt || item.name}
                          width={520}
                          height={340}
                          unoptimized
                        />
                      ) : (
                        <span className="icon">
                          <CategoryIcon name={item.icon} />
                        </span>
                      )}
                      <h3>{item.cardTitle || item.name}</h3>
                      <p>{item.cardText || item.shortDescription}</p>
                      <strong>Explore</strong>
                    </Link>
                  ))}
                </div>
              </section>
            );
          if (section.type === "FAQ") {
            const items = ordered<FaqItem>(value.items);
            return (
              <section
                key={renderSectionKey(section, sectionIndex)}
                className="faq-section category-faq"
                {...presentation}
              >
                <Heading
                  eyebrow={common.eyebrow}
                  headline={common.headline}
                  copy={common.copy}
                />
                <div className="modular-faq-grid">
                  {items.map((item, index) => (
                    <details key={collectionKey("faq-item", item, index)}>
                      <summary>
                        <span>{item.question}</span>
                      </summary>
                      <p>{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            );
          }
          if (section.type === "CTA_BANNER")
            return (
              <section
                key={renderSectionKey(section, sectionIndex)}
                className="category-final-cta modular-promo"
                {...presentation}
                data-overlay={text(value.overlay, "NONE").toLowerCase()}
                data-content-position={text(
                  value.contentPosition,
                  "LEFT",
                ).toLowerCase()}
              >
                {common.imageUrl && (
                  <picture>
                    <source
                      media="(max-width: 600px)"
                      srcSet={text(value.mobileImageUrl) || common.imageUrl}
                    />
                    <Image
                      src={common.imageUrl}
                      alt={common.imageAlt}
                      fill
                      sizes="(max-width: 800px) 100vw, 1180px"
                      style={mediaStyle(value)}
                      unoptimized
                    />
                  </picture>
                )}
                <div>
                  <Heading
                    eyebrow={common.eyebrow}
                    headline={common.headline}
                    copy={common.copy}
                  />
                  <SectionActions value={value} fallbackHref={shopHref} />
                </div>
              </section>
            );
          const bullets = array<string>(value.bullets);
          const layout = text(value.layout, "IMAGE_RIGHT")
            .toLowerCase()
            .replaceAll("_", "-");
          return (
            <section
              key={renderSectionKey(section, sectionIndex)}
              className={`category-story ${layout}`}
              {...presentation}
            >
              <div>
                <Heading
                  eyebrow={common.eyebrow}
                  headline={common.headline}
                  copy={common.copy}
                />
                {bullets.length > 0 && (
                  <ul>
                    {bullets.map((item, index) => (
                      <li key={`${item}-${index}`}>
                        <Check size={18} />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                <SectionActions value={value} fallbackHref={shopHref} />
              </div>
              {common.imageUrl && !layout.includes("text-only") && (
                <Image
                  src={common.imageUrl}
                  alt={common.imageAlt}
                  width={760}
                  height={600}
                  style={mediaStyle(value)}
                  unoptimized
                />
              )}
            </section>
          );
        })}
    </div>
  );
}

function DefaultFeatures({ nfcEnabled }: { nfcEnabled: boolean }) {
  return (
    <div className="category-hero-trust">
      {nfcEnabled ? (
        <>
          <span>
            <Radio size={16} /> NFC
          </span>
          <span>
            <QrCode size={16} /> QR
          </span>
          <span>
            <Check size={16} /> No app needed
          </span>
        </>
      ) : (
        <>
          <span>
            <Printer size={16} /> 3D printed
          </span>
          <span>
            <Palette size={16} /> Configurable
          </span>
          <span>
            <PackageCheck size={16} /> Small batch
          </span>
        </>
      )}
    </div>
  );
}
function SectionCopy({
  eyebrow,
  headline,
  copy,
  fallbackHeadline,
  fallbackCopy,
  textBlocks,
}: {
  eyebrow: string;
  headline: string;
  copy: string;
  fallbackHeadline: string;
  fallbackCopy: string;
  textBlocks: TextBlock[];
}) {
  if (!textBlocks.length)
    return (
      <>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{headline || fallbackHeadline}</h1>
        {(copy || fallbackCopy) && (
          <p className="lead">{copy || fallbackCopy}</p>
        )}
      </>
    );
  const headingIndex = textBlocks.findIndex(
    (block) => block.type === "HEADING" && Boolean(block.text),
  );
  return (
    <>
      {headingIndex < 0 && <h1>{headline || fallbackHeadline}</h1>}
      {textBlocks.map((block, index) => {
        if (!block.text) return null;
        if (block.type === "EYEBROW")
          return (
            <span className="eyebrow" key={collectionKey("text-block", block, index)}>
              {block.text}
            </span>
          );
        if (block.type === "HEADING" && index === headingIndex)
          return <h1 key={collectionKey("text-block", block, index)}>{block.text}</h1>;
        if (block.type === "HEADING" || block.type === "SUBHEADING")
          return <h2 key={collectionKey("text-block", block, index)}>{block.text}</h2>;
        return block.type === "SUPPORTING_TEXT" ? (
          <small className="hero-supporting" key={collectionKey("text-block", block, index)}>
            {block.text}
          </small>
        ) : (
          <p className="lead" key={collectionKey("text-block", block, index)}>
            {block.text}
          </p>
        );
      })}
    </>
  );
}
function SectionActions({
  value,
  fallbackHref,
}: {
  value: Record<string, unknown>;
  fallbackHref: string;
}) {
  const primary = text(value.ctaLabel);
  const secondary = text(value.secondaryCtaLabel);
  if (
    (!primary || value.ctaVisible === false) &&
    (!secondary || value.secondaryCtaVisible === false)
  )
    return null;
  return (
    <div className="actions">
      {primary && value.ctaVisible !== false && (
        <Link
          className="button category-primary"
          style={buttonStyle(value, "cta")}
          href={text(value.ctaHref) || fallbackHref}
        >
          {primary}
        </Link>
      )}
      {secondary && value.secondaryCtaVisible !== false && (
        <Link
          className="button secondary"
          style={buttonStyle(value, "secondaryCta")}
          href={text(value.secondaryCtaHref) || fallbackHref}
        >
          {secondary}
        </Link>
      )}
    </div>
  );
}
function Heading({
  eyebrow,
  headline,
  copy,
}: {
  eyebrow: string;
  headline: string;
  copy: string;
}) {
  return (
    <div className="section-head">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      {headline && <h2>{headline}</h2>}
      {copy && <p>{copy}</p>}
    </div>
  );
}
function SectionImage({
  url,
  alt,
  priority,
  imageStyle,
  placeholder,
}: {
  url: string;
  alt: string;
  priority?: boolean;
  imageStyle?: CSSProperties;
  placeholder: ReactNode;
}) {
  return url ? (
    <Image
      src={url}
      alt={alt}
      width={900}
      height={720}
      priority={priority}
      style={imageStyle}
      unoptimized
    />
  ) : (
    placeholder
  );
}
function PagePlaceholder({
  icon,
  name,
  storeName,
}: {
  icon?: string | null;
  name: string;
  storeName: string;
}) {
  return (
    <div
      className="category-hero-placeholder"
      role="img"
      aria-label={`${name} visual placeholder`}
    >
      <div className="smart-object">
        <CategoryIcon name={icon} size={62} />
        <strong>{name}</strong>
        <small>{storeName}</small>
      </div>
    </div>
  );
}

function breadcrumbKey(item: { label: string; href?: string }, index: number) {
  return `breadcrumb:${item.href || item.label}:${index}`;
}

function renderSectionKey(section: RenderSection, index: number) {
  const id = String(section.id ?? "").trim();
  if (id) return `section:${id}:${index}`;
  return `legacy-section:${stableHash(`${section.type}:${section.name}:${JSON.stringify(section.content)}`)}:${index}`;
}

function collectionKey(
  namespace: string,
  item: { id?: string },
  index: number,
) {
  const id = text(item.id).trim();
  return `${namespace}:${id || "missing"}:${index}`;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function readCommon(value: Record<string, unknown>, fallbackHeadline: string) {
  return {
    eyebrow: text(value.eyebrow),
    headline: text(value.headline, fallbackHeadline),
    copy: text(value.copy),
    imageUrl: text(value.imageUrl),
    imageAlt: text(value.imageAlt),
  };
}
function sectionPresentation(value: Record<string, unknown>) {
  return {
    id: text(value.anchorId) || undefined,
    style: surfaceStyle(value),
    "data-colour-theme": text(value.colourTheme, "INHERIT").toLowerCase(),
    "data-variant": text(value.layoutVariant, "DEFAULT")
      .toLowerCase()
      .replaceAll("_", "-"),
    "data-width": text(value.sectionWidth, "STANDARD").toLowerCase(),
    "data-spacing": text(value.spacing, "STANDARD").toLowerCase(),
    "data-heading": text(value.headingScale, "STANDARD").toLowerCase(),
  };
}
function surfaceStyle(value: Record<string, unknown>): CSSProperties {
  return {
    backgroundColor: colour(value.backgroundColour),
    borderRadius: radius(value.radius),
    "--section-columns": number(value.columns, 3),
    "--section-eyebrow": colour(value.eyebrowColour),
    "--section-headline": colour(value.headlineColour),
    "--section-copy": colour(value.copyColour),
    "--section-card-bg": colour(value.cardBackgroundColour),
    "--section-card-text": colour(value.cardTextColour),
    "--section-card-border": colour(value.cardBorderColour),
    ...typographyVariables("section-eyebrow-type", value.eyebrowTypography as TypographyOverride),
    ...typographyVariables("section-headline-type", value.headlineTypography as TypographyOverride),
    ...typographyVariables("section-copy-type", value.copyTypography as TypographyOverride),
    ...typographyVariables("section-button-type", value.buttonTypography as TypographyOverride),
    ...typographyVariables("section-card-type", value.cardTypography as TypographyOverride),
  } as CSSProperties;
}
function mediaStyle(value: Record<string, unknown>): CSSProperties {
  return {
    objectFit: text(value.imageFit, "COVER").toLowerCase() as
      "cover" | "contain",
    objectPosition: text(value.imagePosition, "CENTRE")
      .toLowerCase()
      .replace("centre", "center"),
  };
}
function buttonStyle(
  value: Record<string, unknown>,
  prefix: "cta" | "secondaryCta",
): CSSProperties {
  return {
    backgroundColor: colour(value[`${prefix}Background`]),
    color: colour(value[`${prefix}TextColour`]),
    borderColor: colour(value[`${prefix}BorderColour`]),
  };
}
function itemStyle(item: Item): CSSProperties {
  return {
    backgroundColor: colour(item.backgroundColour),
    color: colour(item.textColour),
  };
}
function itemButtonStyle(item: Item): CSSProperties {
  return {
    backgroundColor: colour(item.ctaBackground),
    color: colour(item.ctaTextColour),
    borderColor: colour(item.ctaBorderColour),
  };
}
function colour(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : undefined;
}
function radius(value: unknown) {
  return (
    (
      { SMALL: 12, MEDIUM: 20, LARGE: 32, EXTRA_LARGE: 48 } as Record<
        string,
        number
      >
    )[text(value)] ?? undefined
  );
}
function ordered<T extends { visible?: boolean; order?: number }>(
  value: unknown,
) {
  return array<T>(value)
    .filter((item) => item.visible !== false)
    .sort((left, right) => number(left.order) - number(right.order));
}
function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function number(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}
function array<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}
