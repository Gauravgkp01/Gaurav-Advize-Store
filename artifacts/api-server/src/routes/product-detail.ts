import { Router } from "express";
import { db } from "../lib/firebase.js";
import { Timestamp } from "firebase-admin/firestore";
import { cacheGet, cacheSet } from "../lib/cache.js";

const router = Router();
const TTL = 60_000; // 60 s

function sanitizeStore(id: string, data: FirebaseFirestore.DocumentData) {
  const { razorpay_key_secret: _s, owner_id: _o, ...safe } = data;
  return { id, ...safe };
}

function serializeTs(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  return (ts as number) ?? 0;
}

function serializeReview(d: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = d.data();
  const created = data.created_at;
  return {
    ...data,
    id: d.id,
    created_at:
      created instanceof Timestamp
        ? created.toDate().toISOString()
        : (created ?? new Date().toISOString()),
  };
}

/**
 * GET /product-detail/:id
 *
 * Returns { product (with variants), store, reviews, relatedProducts }
 * in a single client round-trip.  All Firestore work is done server-side
 * in parallel after the first mandatory product fetch.
 *
 * Cache: 60 s TTL (shares sub-caches with other routes).
 */
router.get("/product-detail/:id", async (req, res) => {
  const { id } = req.params;
  const cacheKey = `product-detail:${id}`;

  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return res.json(cached);

  // ── Step 1: Fetch product (mandatory – we need storeId + category) ──
  const productDoc = await db.collection("products").doc(id).get();
  if (!productDoc.exists) return res.status(404).json({ error: "Product not found" });

  const productData = productDoc.data()!;
  const storeId: string = productData["store_id"];
  const category: string = productData["category"] ?? "";

  // ── Step 2: Parallel fetch – variants, store, catalog ──
  // Reviews are intentionally excluded here — the client lazy-loads them
  // only when the user opens the reviews section, saving one Firestore
  // read on every cold-start product page view.
  const cachedCatalog = cacheGet<any[]>(`products:list:${storeId}`);

  const [variantsSnap, storeDoc, catalogSnap] = await Promise.all([
    productDoc.ref.collection("variants").get(),
    // Store: check sub-cache first
    (async () => {
      const cachedStore = cacheGet<any>(`store:id:${storeId}`);
      return cachedStore ?? db.collection("stores").doc(storeId).get();
    })(),
    // Catalog: use server cache if warm to avoid an extra Firestore query
    cachedCatalog
      ? Promise.resolve(null)
      : db.collection("products").where("store_id", "==", storeId).get(),
  ]);

  // ── Build product ──
  const variants = variantsSnap.docs.map(v => ({ id: v.id, ...v.data() }));
  const product = {
    id,
    ...productData,
    created_at: serializeTs(productData["created_at"]),
    variants,
  };

  // ── Build store ──
  let store: any;
  if (typeof storeDoc === "object" && "exists" in storeDoc) {
    // Fresh Firestore DocumentSnapshot
    const snap = storeDoc as FirebaseFirestore.DocumentSnapshot;
    if (!snap.exists) return res.status(404).json({ error: "Store not found" });
    store = sanitizeStore(snap.id, snap.data()!);
    cacheSet(`store:id:${storeId}`, store, 60_000);
  } else {
    // Already a plain object from the sub-cache
    store = storeDoc;
  }

  // ── Build related products ──
  let allProducts: any[];
  if (cachedCatalog) {
    allProducts = cachedCatalog;
  } else {
    const snap = catalogSnap as FirebaseFirestore.QuerySnapshot;
    allProducts = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      created_at: serializeTs((d.data() as any)["created_at"]),
    }));
    allProducts.sort((a, b) => b.created_at - a.created_at);
    cacheSet(`products:list:${storeId}`, allProducts, 30_000);
  }

  const relatedProducts = allProducts
    .filter((p: any) => p.id !== id && p.category === category)
    .slice(0, 6);

  const result = { product, store, relatedProducts };
  cacheSet(cacheKey, result, TTL);
  return res.json(result);
});

export default router;
