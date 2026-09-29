import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { currentAppEnvironment } from "@/lib/config";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/lib/storage";
import { createStorageKey, isSafeStorageKey } from "@/lib/storage/keys";
import {
  detectProductImageFormat,
  productImageDimensions,
} from "@/lib/uploads";

import { storefrontReleaseSchema, STOREFRONT_RELEASE_KIND, STOREFRONT_RELEASE_VERSION, MAX_RELEASE_ASSET_BYTES, type StorefrontRelease } from "@/lib/storefront-release-schema";
import { validateReleaseReferences, validateReleaseAssets } from "@/lib/storefront-release-validation";
import { validCanonicalOverride } from "@/lib/seo";
export { storefrontReleaseSchema, STOREFRONT_RELEASE_KIND, STOREFRONT_RELEASE_VERSION } from "@/lib/storefront-release-schema";
export type { StorefrontRelease } from "@/lib/storefront-release-schema";

type Row = Record<string, unknown>;

function without<T extends Row>(row: T, keys: string[]) {
  const result: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (!keys.includes(key)) result[key] = value;
  }
  return result;
}

function cleanSection(section: Row) {
  const translations = (section.translations as Row[] | undefined)?.map((item) =>
    without(item, ["id", "sectionId", "createdAt", "updatedAt"]),
  );
  return { ...without(section, ["id", "storeId", "pageId", "categoryId", "createdAt", "updatedAt", "translations"]), translations: translations ?? [] };
}

function cleanPage(page: Row) {
  const sections = (page.sections as Row[] | undefined)?.map(cleanSection) ?? [];
  const translations = (page.translations as Row[] | undefined)?.map((item) =>
    without(item, ["id", "pageId", "createdAt", "updatedAt"]),
  );
  return {
    ...without(page, ["id", "storeId", "categoryId", "createdAt", "updatedAt", "sections", "translations", "images"]),
    sections,
    translations: translations ?? [],
  };
}

function cleanCategory(category: Row) {
  const page = category.contentPage as Row | null;
  return {
    ...without(category, ["id", "storeId", "createdAt", "updatedAt", "products", "contentPage", "images"]),
    page: page ? cleanPage(page) : null,
  };
}

function cleanProduct(product: Row) {
  const images = (product.images as Row[] | undefined) ?? [];
  const imageById = new Map(images.map((image) => [String(image.id), image]));
  const optionById = new Map<string, { code: string; value: string }>();
  for (const option of (product.options as Row[] | undefined) ?? []) {
    for (const value of (option.values as Row[] | undefined) ?? []) {
      optionById.set(String(value.id), { code: String(option.code), value: String(value.value) });
    }
  }
  const options = ((product.options as Row[] | undefined) ?? []).map((option) => ({
    ...without(option, ["id", "productId", "createdAt", "updatedAt", "values"]),
    values: ((option.values as Row[] | undefined) ?? []).map((value) =>
      without(value, ["id", "optionId", "createdAt", "updatedAt", "images"]),
    ),
  }));
  const variants = ((product.variants as Row[] | undefined) ?? []).map((variant) => ({
    ...without(variant, ["id", "productId", "imageId", "defaultPackagingId", "inventory", "reservedInventory", "createdAt", "updatedAt"]),
    imageStorageKey: imageById.get(String(variant.imageId))?.storageKey ?? null,
  }));
  return {
    ...without(product, ["id", "storeId", "categoryId", "defaultPackagingId", "createdAt", "updatedAt", "category", "variants", "options", "images"]),
    categorySlug: (product.category as Row | null)?.slug ?? null,
    variants,
    options,
    images: images.map((image) => ({
      ...without(image, ["id", "productId", "optionValueId", "createdAt", "updatedAt", "variants", "optionValue"]),
      optionValue: optionById.get(String(image.optionValueId)) ?? null,
    })),
  };
}

function assetKeyFor(storeId: string, storeSlug: string, storageKey: string, bytes: Uint8Array) {
  // Content-addressed and destination-scoped: retries reuse the same immutable object.
  const hash = createHash("sha256").update(`${storeId}\0${storageKey}\0`).update(bytes).digest("hex");
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  const extension = storageKey.split(".").pop() as "png" | "jpg" | "webp";
  return createStorageKey(
    currentAppEnvironment(),
    storeSlug,
    id,
    extension,
  );
}

function rewriteMediaReferences(value: unknown, keys: Map<string, string>): unknown {
  if (typeof value === "string") {
    // One pass avoids cascading substitutions when a source key equals another target.
    return value.replace(/(?:https?:\/\/[^\s/"'<>]+)?\/api\/media\/([a-zA-Z0-9.-]+)/g,
      (match, source: string) => keys.has(source) ? `/api/media/${keys.get(source)}` : match);
  }
  if (Array.isArray(value)) return value.map((item) => rewriteMediaReferences(item, keys));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Row).map(([key, item]) => [key, rewriteMediaReferences(item, keys)]),
    );
  return value;
}

async function exportAssets(images: Array<Row>) {
  const storage = getStorageProvider();
  const seen = new Set<string>();
  const assets: Row[] = [];
  let total = 0;
  for (const image of images) {
    const storageKey = String(image.storageKey ?? "");
    if (!isSafeStorageKey(storageKey) || seen.has(storageKey)) continue;
    seen.add(storageKey);
    const bytes = await storage.get(storageKey);
    if (!bytes) throw new Error(`RELEASE_MEDIA_MISSING:${storageKey}`);
    total += bytes.byteLength;
    if (total > MAX_RELEASE_ASSET_BYTES) throw new Error("RELEASE_MEDIA_TOO_LARGE");
    const format = detectProductImageFormat(bytes);
    const dimensions = format ? productImageDimensions(bytes, format.mime) : null;
    if (!format || !dimensions) throw new Error(`RELEASE_MEDIA_INVALID:${storageKey}`);
    assets.push({
      storageKey,
      mimeType: format.mime,
      byteSize: bytes.byteLength,
      width: dimensions.width,
      height: dimensions.height,
      bytesBase64: Buffer.from(bytes).toString("base64"),
    });
  }
  return assets;
}

export async function createStorefrontRelease(storeId: string): Promise<StorefrontRelease> {
  const [store, categories, pages, products, storeImages] = await Promise.all([
    db.store.findUniqueOrThrow({ where: { id: storeId } }),
    db.productCategory.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { images: true, contentPage: { include: { images: true, translations: true, sections: { include: { translations: true }, orderBy: { sortOrder: "asc" } } } } },
    }),
    db.contentPage.findMany({
      where: { storeId, categoryId: null },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: { images: true, translations: true, sections: { include: { translations: true }, orderBy: { sortOrder: "asc" } } },
    }),
    db.product.findMany({
      where: { storeId },
      orderBy: { name: "asc" },
      include: { category: { select: { slug: true } }, variants: { orderBy: { sku: "asc" } }, options: { include: { values: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } }, images: { orderBy: { sortOrder: "asc" } } },
    }),
    db.categoryImage.findMany({ where: { storeId, categoryId: null, pageId: null } }),
  ]);
  const categoryImages = categories.flatMap((category) =>
    category.images.map((image) => ({
      ...without(image as unknown as Row, ["id", "storeId", "categoryId", "pageId", "createdAt", "updatedAt"]),
      categorySlug: category.slug,
      pageSlug: null,
    })),
  );
  const pageImages = [...pages, ...categories.flatMap(category => category.contentPage ? [category.contentPage] : [])].flatMap((page) =>
    page.images.map((image) => ({
      ...without(image as unknown as Row, ["id", "storeId", "categoryId", "pageId", "createdAt", "updatedAt"]),
      categorySlug: null,
      pageSlug: page.slug,
    })),
  );
  const globalImages = storeImages.map((image) => ({
    ...without(image as unknown as Row, ["id", "storeId", "categoryId", "pageId", "createdAt", "updatedAt"]),
    categorySlug: null,
    pageSlug: null,
  }));
  const allImages = [
    ...categoryImages,
    ...pageImages,
    ...globalImages,
    ...products.flatMap((product) => product.images as unknown as Row[]),
  ];
  const release = {
    kind: STOREFRONT_RELEASE_KIND,
    version: STOREFRONT_RELEASE_VERSION,
    generatedAt: new Date().toISOString(),
    source: { storeSlug: store.slug },
    store: without(store as unknown as Row, ["id", "slug", "name", "status", "paymentProfileKey", "createdAt", "updatedAt"]),
    categories: categories.map((item) => cleanCategory(item as unknown as Row)),
    pages: pages.map((item) => cleanPage(item as unknown as Row)),
    products: products.map((item) => cleanProduct(item as unknown as Row)),
    categoryImages: [...categoryImages, ...pageImages, ...globalImages],
    assets: await exportAssets(allImages),
  };
  const parsed = storefrontReleaseSchema.parse(release);
  validateReleaseReferences(parsed);
  validateReleaseAssets(parsed);
  return parsed;
}

export async function previewStorefrontRelease(releaseInput: unknown, storeId: string) {
  const release = storefrontReleaseSchema.parse(releaseInput);
  validateReleaseReferences(release);
  validateReleaseAssets(release);
  const [categorySlugs, pageSlugs, productSlugs] = await Promise.all([
    db.productCategory.findMany({ where: { storeId }, select: { slug: true } }),
    db.contentPage.findMany({ where: { storeId, categoryId: null }, select: { slug: true } }),
    db.product.findMany({ where: { storeId }, select: { slug: true } }),
  ]);
  const count = (items: Array<{ slug: string }>, existing: Array<{ slug: string }>) => {
    const current = new Set(existing.map((item) => item.slug));
    return items.reduce((summary, item) => {
      if (current.has(item.slug)) summary.update += 1;
      else summary.create += 1;
      return summary;
    }, { create: 0, update: 0 });
  };
  return {
    sourceStore: release.source.storeSlug,
    categories: count(release.categories, categorySlugs),
    pages: count(release.pages, pageSlugs),
    products: count(release.products, productSlugs),
    media: { files: release.assets.length, bytes: release.assets.reduce((sum, asset) => sum + asset.byteSize, 0) },
    validation: { references: "checked", embeddedImages: "checked" },
    excluded: ["inventory", "reserved inventory", "currency", "shipping settings", "packaging assignments", "store capabilities", "domains", "customers", "orders", "payments", "carts", "NFC tags", "manufacturing batches", "sessions", "credentials"],
  };
}

async function copyReleaseAssets(release: StorefrontRelease, storeId: string, storeSlug: string, validated: Map<string, Buffer>) {
  const storage = getStorageProvider();
  const keys = new Map<string, string>();
  for (const asset of release.assets) {
    const bytes = validated.get(asset.storageKey)!;
    const targetKey = assetKeyFor(storeId, storeSlug, asset.storageKey, bytes);
    keys.set(asset.storageKey, targetKey);
    const existing = await storage.get(targetKey);
    if (existing) {
      if (!bytes.equals(Buffer.from(existing))) throw new Error("RELEASE_MEDIA_COLLISION");
      continue;
    }
    try {
      await storage.put(targetKey, bytes, { contentType: asset.mimeType, cacheControl: "public, max-age=31536000, immutable", metadata: { purpose: "storefront-release" } });
    } catch (error) {
      // Another import may have written the exact same immutable object concurrently.
      const uploaded = await storage.get(targetKey);
      if (!uploaded || !bytes.equals(Buffer.from(uploaded))) throw error;
    }
  }
  return { keys };
}

function releaseData(value: unknown, keys: Map<string, string>) {
  return rewriteMediaReferences(value, keys) as Row;
}

async function syncPage(tx: Prisma.TransactionClient, storeId: string, pageInput: Row, categoryId?: string) {
  const page = { ...pageInput };
  const sections = Array.isArray(page.sections) ? page.sections as Row[] : [];
  const translations = Array.isArray(page.translations) ? page.translations as Row[] : [];
  delete page.sections;
  delete page.translations;
  const data = { ...page, storeId, categoryId: categoryId ?? null, defaultLocale: String(page.defaultLocale ?? "en-AU") } as Prisma.ContentPageUncheckedCreateInput;
  const existing = categoryId
    ? await tx.contentPage.findUnique({ where: { categoryId } })
    : await tx.contentPage.findUnique({ where: { storeId_slug: { storeId, slug: String(page.slug) } } });
  if (!categoryId && await tx.contentPage.count({ where: { storeId, legacySlugs: { has: String(page.slug) }, ...(existing ? { id: { not: existing.id } } : {}) } })) throw new Error("RELEASE_PAGE_SLUG_CONFLICT");
  if (existing && existing.categoryId !== (categoryId ?? null)) throw new Error("RELEASE_PAGE_OWNER_CONFLICT");
  const saved = existing
    ? await tx.contentPage.update({ where: { id: existing.id }, data })
    : await tx.contentPage.create({ data });
  await tx.landingPageSection.deleteMany({ where: { pageId: saved.id } });
  for (const [sortOrder, section] of sections.entries()) {
    const { translations: sectionTranslations, ...sectionData } = section;
    const savedSection = await tx.landingPageSection.create({
      data: { ...sectionData, storeId, pageId: saved.id, categoryId: categoryId ?? null, sortOrder } as Prisma.LandingPageSectionUncheckedCreateInput,
    });
    if (Array.isArray(sectionTranslations) && sectionTranslations.length) {
      await tx.landingPageSectionTranslation.createMany({
        data: sectionTranslations.map((item: Row) => ({
          locale: String(item.locale), content: item.content as Prisma.InputJsonValue, sectionId: savedSection.id,
        })),
      });
    }
  }
  await tx.contentPageTranslation.deleteMany({ where: { pageId: saved.id } });
  if (translations.length) await tx.contentPageTranslation.createMany({ data: translations.map((item) => ({ ...item, pageId: saved.id })) as Prisma.ContentPageTranslationCreateManyInput[] });
  return saved;
}

export async function importStorefrontRelease({ releaseInput, storeId, storeSlug, actorId, targetOrigin }: { releaseInput: unknown; storeId: string; storeSlug: string; actorId: string; targetOrigin?: string }) {
  const release = storefrontReleaseSchema.parse(releaseInput);
  validateReleaseReferences(release);
  const validated = validateReleaseAssets(release);
  // Assets are immutable and safe to retry. Never delete them on rollback: a concurrent
  // successful import may already reference them. Unreferenced files require audited GC.
  const media = await copyReleaseAssets(release, storeId, storeSlug, validated);
  const result = await db.$transaction(async (tx) => {
    const storeData = releaseData(release.store, media.keys);
    await tx.store.update({ where: { id: storeId }, data: storeData as Prisma.StoreUpdateInput });
    const categoryIds = new Map<string, string>();
    for (const itemInput of release.categories) {
      const item = releaseData(itemInput, media.keys);
      if (item.canonicalUrl && (!targetOrigin || !validCanonicalOverride(String(item.canonicalUrl), targetOrigin))) item.canonicalUrl = null;
      const page = item.page as Row | null;
      delete item.page;
      if (page?.canonicalUrl && (!targetOrigin || !validCanonicalOverride(String(page.canonicalUrl), targetOrigin))) page.canonicalUrl = null;
      const category = await tx.productCategory.upsert({ where: { storeId_slug: { storeId, slug: String(item.slug) } }, update: item as Prisma.ProductCategoryUpdateInput, create: { ...item, storeId } as Prisma.ProductCategoryUncheckedCreateInput });
      categoryIds.set(category.slug, category.id);
      if (page) await syncPage(tx, storeId, page, category.id);
    }
    for (const pageInput of release.pages) {
      const page = releaseData(pageInput, media.keys);
      if (page.canonicalUrl && (!targetOrigin || !validCanonicalOverride(String(page.canonicalUrl), targetOrigin))) page.canonicalUrl = null;
      await syncPage(tx, storeId, page);
    }
    const productCount = { create: 0, update: 0 };
    for (const productInput of release.products) {
      const product = releaseData(productInput, media.keys);
      if (product.canonicalUrl && (!targetOrigin || !validCanonicalOverride(String(product.canonicalUrl), targetOrigin))) product.canonicalUrl = null;
      const categorySlug = product.categorySlug as string | null;
      const variants = (product.variants as Row[] | undefined) ?? [];
      const options = (product.options as Row[] | undefined) ?? [];
      const images = (product.images as Row[] | undefined) ?? [];
      delete product.categorySlug; delete product.variants; delete product.options; delete product.images;
      const existing = await tx.product.findUnique({ where: { storeId_slug: { storeId, slug: String(product.slug) } }, select: { id: true } });
      if (await tx.product.count({ where: { storeId, legacySlugs: { has: String(product.slug) }, ...(existing ? { id: { not: existing.id } } : {}) } })) throw new Error("RELEASE_PRODUCT_SLUG_CONFLICT");
      const data = { ...product, storeId, categoryId: categorySlug ? categoryIds.get(categorySlug) ?? null : null } as Prisma.ProductUncheckedCreateInput;
      const saved = existing ? await tx.product.update({ where: { id: existing.id }, data }) : await tx.product.create({ data });
      productCount[existing ? "update" : "create"] += 1;
      const optionValues = new Map<string, string>();
      for (const optionInput of options) {
        const option = releaseData(optionInput, media.keys); const values = (option.values as Row[] | undefined) ?? []; delete option.values;
        const savedOption = await tx.productOption.upsert({ where: { productId_code: { productId: saved.id, code: String(option.code) } }, update: option as Prisma.ProductOptionUpdateInput, create: { ...option, productId: saved.id } as Prisma.ProductOptionUncheckedCreateInput });
        for (const valueInput of values) {
          const value = releaseData(valueInput, media.keys);
          const savedValue = await tx.productOptionValue.upsert({ where: { optionId_value: { optionId: savedOption.id, value: String(value.value) } }, update: value as Prisma.ProductOptionValueUpdateInput, create: { ...value, optionId: savedOption.id } as Prisma.ProductOptionValueUncheckedCreateInput });
          optionValues.set(`${savedOption.code}:${savedValue.value}`, savedValue.id);
        }
      }
      const imageIds = new Map<string, string>();
      for (const imageInput of images) {
        const image = releaseData(imageInput, media.keys); const sourceKey = String(image.storageKey); const targetKey = media.keys.get(sourceKey);
        if (!targetKey) throw new Error("RELEASE_MEDIA_REFERENCE_MISSING");
        const optionValue = image.optionValue as Row | null; delete image.optionValue; delete image.storageKey; delete image.url;
        const existingImage = await tx.productImage.findUnique({ where: { storageKey: targetKey }, select: { productId: true } });
        if (existingImage && existingImage.productId !== saved.id) throw new Error("RELEASE_MEDIA_OWNER_CONFLICT");
        const savedImage = await tx.productImage.upsert({ where: { storageKey: targetKey }, update: { ...image, productId: saved.id, optionValueId: optionValue ? optionValues.get(`${optionValue.code}:${optionValue.value}`) ?? null : null, url: `/api/media/${targetKey}` } as Prisma.ProductImageUpdateInput, create: { ...image, productId: saved.id, storageKey: targetKey, optionValueId: optionValue ? optionValues.get(`${optionValue.code}:${optionValue.value}`) ?? null : null, url: `/api/media/${targetKey}` } as Prisma.ProductImageUncheckedCreateInput });
        imageIds.set(sourceKey, savedImage.id);
      }
      for (const variantInput of variants) {
        const variant = releaseData(variantInput, media.keys);
        // Ignore operational quantities even in older or manually edited release files.
        delete variant.inventory; delete variant.reservedInventory;
        const imageStorageKey = variant.imageStorageKey as string | null; delete variant.imageStorageKey;
        const existingVariant = await tx.productVariant.findUnique({ where: { sku: String(variant.sku) }, select: { id: true, productId: true, product: { select: { storeId: true } } } });
        if (existingVariant && existingVariant.product.storeId !== storeId) throw new Error("RELEASE_SKU_BELONGS_TO_ANOTHER_STORE");
        if (existingVariant && existingVariant.productId !== saved.id) throw new Error("RELEASE_SKU_BELONGS_TO_ANOTHER_PRODUCT");
        const data = { ...variant, productId: saved.id, imageId: imageStorageKey ? imageIds.get(imageStorageKey) ?? null : null } as Prisma.ProductVariantUncheckedCreateInput;
        if (existingVariant) await tx.productVariant.update({ where: { id: existingVariant.id }, data }); else await tx.productVariant.create({ data: { ...data, inventory: 0, reservedInventory: 0 } });
      }
    }
    for (const imageInput of release.categoryImages) {
      const image = releaseData(imageInput, media.keys); const sourceKey = String(image.storageKey); const targetKey = media.keys.get(sourceKey);
      if (!targetKey) throw new Error("RELEASE_MEDIA_REFERENCE_MISSING");
      const categorySlug = image.categorySlug as string | null; const pageSlug = image.pageSlug as string | null;
      delete image.categorySlug; delete image.pageSlug; delete image.storageKey; delete image.url;
      const page = pageSlug ? await tx.contentPage.findUnique({ where: { storeId_slug: { storeId, slug: pageSlug } }, select: { id: true } }) : null;
      if (pageSlug && !page) throw new Error("RELEASE_PAGE_REFERENCE_MISSING");
      const existingImage = await tx.categoryImage.findUnique({ where: { storageKey: targetKey }, select: { storeId: true } });
      if (existingImage && existingImage.storeId !== storeId) throw new Error("RELEASE_MEDIA_OWNER_CONFLICT");
      await tx.categoryImage.upsert({ where: { storageKey: targetKey }, update: { ...image, storeId, categoryId: categorySlug ? categoryIds.get(categorySlug) ?? null : null, pageId: page?.id ?? null, url: `/api/media/${targetKey}` } as Prisma.CategoryImageUpdateInput, create: { ...image, storeId, categoryId: categorySlug ? categoryIds.get(categorySlug) ?? null : null, pageId: page?.id ?? null, storageKey: targetKey, url: `/api/media/${targetKey}` } as Prisma.CategoryImageUncheckedCreateInput });
    }
    await tx.auditLog.create({ data: { actorId, storeId, action: "STOREFRONT_RELEASE_IMPORTED", entityType: "Store", entityId: storeId, metadata: { sourceStore: release.source.storeSlug, version: release.version, categories: release.categories.length, pages: release.pages.length, products: productCount, assets: release.assets.length } as Prisma.InputJsonValue } });
    return productCount;
  }, { timeout: 60_000 });
  return { ...result, assets: release.assets.length };
}
