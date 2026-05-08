/**
 * Module-level stale-while-revalidate cache for ProductDetailPage.
 *
 * StorefrontPage populates this for free (it already has store + products +
 * reviews from the combined storefront endpoint), so navigating from a
 * storefront to any product detail page is instant — zero extra network calls.
 *
 * On a cache miss, ProductDetailPage falls back to the combined
 * /api/product-detail/:id endpoint (single round-trip).
 */
import type { Store, Product, Review } from "./api";

export interface PdCacheEntry {
  product: Product;
  store: Store;
  /** Pre-populated when navigating from a storefront; undefined on direct URL visits. */
  reviews?: Review[];
  relatedProducts: Product[];
  ts: number;
}

export const PD_CACHE_TTL = 3 * 60_000; // 3 minutes

export const pdCache = new Map<string, PdCacheEntry>();

/**
 * Called by StorefrontPage after it loads its combined storefront data.
 * Pre-fills the cache for every product visible on the page.
 */
export function populatePdCacheFromStorefront(
  store: Store,
  products: Product[],
  reviews: Review[],
): void {
  const ts = Date.now();
  for (const product of products) {
    // Skip if there is already a fresh entry (avoid overwriting a freshly
    // revalidated entry from a previous product-detail load).
    const existing = pdCache.get(product.id);
    if (existing && ts - existing.ts < PD_CACHE_TTL) continue;

    const productReviews = reviews.filter(r => r.product_id === product.id);
    const relatedProducts = products
      .filter(p => p.id !== product.id && p.category === product.category)
      .slice(0, 6);

    pdCache.set(product.id, { product, store, reviews: productReviews, relatedProducts, ts });
  }
}
