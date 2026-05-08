import { Router } from "express";
import { db } from "../lib/firebase.js";
import { Timestamp } from "firebase-admin/firestore";
import { cacheGet, cacheSet, cacheDeleteByPrefix } from "../lib/cache.js";

const router = Router();

const STOREFRONT_TTL = 30_000; // 30 seconds

function sanitizeStore(id: string, data: FirebaseFirestore.DocumentData) {
  const { razorpay_key_secret: _secret, owner_id: _owner, ...safe } = data;
  return { id, ...safe };
}

function serializeTs(ts: any): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  return ts ?? 0;
}

function serializeReview(data: FirebaseFirestore.DocumentData, id: string) {
  const created = data.created_at;
  return {
    ...data,
    id,
    created_at: created instanceof Timestamp
      ? created.toDate().toISOString()
      : (created ?? new Date().toISOString()),
  };
}

/**
 * GET /storefront/:slug
 * Returns { store, products, reviews } in a single round trip.
 * On a cache hit the entire response is served from memory in < 1 ms.
 * On a cold miss all Firestore work is done server-side so only one
 * network request is needed from the client.
 *
 * Also warms up the individual caches used by other routes so they
 * benefit immediately from the same data.
 */
router.get("/storefront/:slug", async (req, res) => {
  const { slug } = req.params;
  const cacheKey = `storefront:${slug}`;

  // — Cache hit: return immediately —
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return res.json(cached);

  // — Fetch store by slug —
  // (Check the individual store cache first to avoid a Firestore query.)
  let store: any = cacheGet(`store:slug:${slug}`);
  if (!store) {
    const storeSnap = await db.collection("stores")
      .where("slug", "==", slug)
      .limit(1)
      .get();
    if (storeSnap.empty) return res.status(404).json({ error: "Store not found" });
    const doc = storeSnap.docs[0];
    store = sanitizeStore(doc.id, doc.data());
    // Warm individual caches
    cacheSet(`store:slug:${slug}`, store, 60_000);
    cacheSet(`store:id:${store.id}`, store, 60_000);
  }
  const storeId: string = store.id;

  // — Fetch products (check individual cache first) —
  let products: any[] = cacheGet(`products:list:${storeId}`) ?? [];
  let productIds: string[] = products.map((p: any) => p.id);

  if (products.length === 0) {
    const productsSnap = await db.collection("products")
      .where("store_id", "==", storeId)
      .get();
    products = productsSnap.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, ...data, created_at: serializeTs(data.created_at) };
    });
    products.sort((a, b) => b.created_at - a.created_at);
    productIds = productsSnap.docs.map(d => d.id);
    cacheSet(`products:list:${storeId}`, products, 30_000);
  }

  // — Fetch reviews (check individual cache first) —
  let reviews: any[] = cacheGet(`reviews:store:${storeId}`) ?? [];

  if (reviews.length === 0 && productIds.length > 0) {
    // Firestore "in" supports up to 30 items per query — chunk if needed
    const chunks: string[][] = [];
    for (let i = 0; i < productIds.length; i += 30)
      chunks.push(productIds.slice(i, i + 30));

    const snaps = await Promise.all(
      chunks.map(chunk =>
        db.collection("reviews").where("product_id", "in", chunk).get()
      )
    );
    reviews = snaps.flatMap(snap =>
      snap.docs.map(d => serializeReview(d.data(), d.id))
    );
    reviews.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    cacheSet(`reviews:store:${storeId}`, reviews, 60_000);
  }

  const result = { store, products, reviews };
  cacheSet(cacheKey, result, STOREFRONT_TTL);

  return res.json(result);
});

/** Call this when store / product / review data changes to bust the page cache. */
export function invalidateStorefront(slug: string) {
  cacheDeleteByPrefix(`storefront:${slug}`);
}

export default router;
