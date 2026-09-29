import { detectProductImageFormat, productImageDimensions } from "@/lib/uploads";
import { MAX_RELEASE_ASSET_BYTES, type StorefrontRelease } from "@/lib/storefront-release-schema";

export class ReleaseValidationError extends Error {
  constructor(public readonly path: string, message: string) { super(`${path}: ${message}`); }
}

function requireReference(condition: unknown, path: string, message: string): asserts condition {
  if (!condition) throw new ReleaseValidationError(path, message);
}

function unique(values: string[], path: string) {
  const seen = new Set<string>();
  for (const value of values) {
    requireReference(!seen.has(value), path, `Duplicate value: ${value}`);
    seen.add(value);
  }
  return seen;
}

export function validateReleaseAssets(release: StorefrontRelease) {
  unique(release.assets.map(asset => asset.storageKey), "assets.storageKey");
  requireReference(release.assets.reduce((total, asset) => total + asset.byteSize, 0) <= MAX_RELEASE_ASSET_BYTES,
    "assets", "Total embedded images must be 25 MB or smaller");
  return new Map(release.assets.map((asset, index) => {
    const path = `assets[${index}]`;
    const bytes = Buffer.from(asset.bytesBase64, "base64");
    requireReference(bytes.toString("base64") === asset.bytesBase64, `${path}.bytesBase64`, "Invalid base64 encoding");
    const format = detectProductImageFormat(bytes);
    const dimensions = format ? productImageDimensions(bytes, format.mime) : null;
    requireReference(format && dimensions && format.mime === asset.mimeType && asset.storageKey.endsWith(`.${format.extension}`), path, "Image type does not match its file extension or metadata");
    requireReference(bytes.byteLength === asset.byteSize && dimensions.width === asset.width && dimensions.height === asset.height,
      path, "Image size or dimensions do not match the embedded file");
    requireReference(dimensions.width * dimensions.height <= 40_000_000, path, "Image exceeds 40 megapixels");
    return [asset.storageKey, bytes] as const;
  }));
}

export function validateReleaseReferences(release: StorefrontRelease) {
  const categories = unique(release.categories.map(item => item.slug), "categories.slug");
  unique(release.products.map(item => item.slug), "products.slug");
  const pages = [...release.pages, ...release.categories.flatMap(category => category.page ? [category.page] : [])];
  const pageSlugs = unique(pages.map(page => page.slug), "pages.slug");
  unique(release.products.flatMap(product => product.variants.map(variant => variant.sku)), "variants.sku");
  for (const category of release.categories) {
    requireReference(!category.page || category.page.kind === "CATEGORY", `categories.${category.slug}.page.kind`, "An attached category page must have kind CATEGORY");
  }
  for (const page of release.pages) {
    requireReference(page.kind !== "CATEGORY", `pages.${page.slug}.kind`, "Category pages must belong to a category");
    requireReference(!categories.has(page.slug), `pages.${page.slug}.slug`, "Page and category routes cannot share a slug");
  }
  requireReference(pages.filter(page => page.kind === "HOME").length <= 1, "pages", "Only one Home page is allowed");
  for (const page of pages) {
    unique(page.translations.map(item => item.locale), `pages.${page.slug}.translations.locale`);
    for (const [index, section] of page.sections.entries()) {
      unique(section.translations.map(item => item.locale), `pages.${page.slug}.sections[${index}].translations.locale`);
    }
  }
  const assets = new Map(release.assets.map(asset => [asset.storageKey, asset]));
  const registered = new Set<string>();
  function checkImage(image: { storageKey: string; mimeType: string; byteSize: number; width?: number | null; height?: number | null }, path: string) {
    const asset = assets.get(image.storageKey);
    requireReference(asset, path, "Referenced image is missing from assets");
    requireReference(!registered.has(image.storageKey), path, "An image key cannot belong to multiple media records");
    registered.add(image.storageKey);
    requireReference(image.mimeType === asset.mimeType && image.byteSize === asset.byteSize &&
      (image.width == null || image.width === asset.width) && (image.height == null || image.height === asset.height), path, "Media record metadata differs from the embedded image");
  }
  for (const product of release.products) {
    const path = `products.${product.slug}`;
    requireReference(!product.categorySlug || categories.has(product.categorySlug), `${path}.categorySlug`, "Category is missing from this release");
    unique(product.options.map(option => option.code), `${path}.options.code`);
    const options = new Map(product.options.map(option => [option.code, unique(option.values.map(value => value.value), `${path}.options.${option.code}.values`)]));
    const images = new Set(product.images.map(image => image.storageKey));
    for (const image of product.images) {
      checkImage(image, `${path}.images.${image.storageKey}`);
      requireReference(!image.optionValue || options.get(image.optionValue.code)?.has(image.optionValue.value), `${path}.images.optionValue`, "Option value does not belong to this product");
    }
    for (const variant of product.variants) {
      requireReference(!variant.imageStorageKey || images.has(variant.imageStorageKey), `${path}.variants.${variant.sku}.imageStorageKey`, "Image does not belong to this product");
    }
  }
  for (const image of release.categoryImages) {
    checkImage(image, `categoryImages.${image.storageKey}`);
    requireReference(!(image.categorySlug && image.pageSlug), "categoryImages", "Choose a category or page owner, not both");
    requireReference(!image.categorySlug || categories.has(image.categorySlug), "categoryImages.categorySlug", "Category is missing from this release");
    requireReference(!image.pageSlug || pageSlugs.has(image.pageSlug), "categoryImages.pageSlug", "Page is missing from this release");
  }
  for (const key of assets.keys()) requireReference(registered.has(key), "assets", `Image has no media record: ${key}`);

  // Inspect CMS JSON as well as direct image fields; do not silently retain source-environment URLs.
  function walk(value: unknown, path: string, depth = 0) {
    requireReference(depth < 100, path, "Content is nested too deeply");
    if (typeof value === "string") {
      for (const match of value.matchAll(/\/api\/media\/([a-zA-Z0-9.%_-]+)/g)) {
        requireReference(registered.has(match[1]), path, `Embedded media reference is missing: ${match[1]}`);
      }
    } else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1));
    else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) walk(item, `${path}.${key}`, depth + 1);
  }
  walk({ store: release.store, categories: release.categories, pages: release.pages, products: release.products }, "release");
}
