import { Router } from "express";
import { db } from "../lib/firebase.js";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { cacheGet, cacheSet, cacheDeleteByPrefix } from "../lib/cache.js";

const REVIEWS_TTL = 60_000; // 60 seconds

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

const router = Router();

router.get("/reviews", async (req, res) => {
  const { product_id, store_id } = req.query as Record<string, string>;

  if (store_id) {
    const cacheKey = `reviews:store:${store_id}`;
    const cached = cacheGet<unknown[]>(cacheKey);
    if (cached) return res.json(cached);

    const productsSnap = await db.collection("products")
      .where("store_id", "==", store_id)
      .get();
    const productIds = productsSnap.docs.map(d => d.id);
    if (productIds.length === 0) {
      cacheSet(cacheKey, [], REVIEWS_TTL);
      return res.json([]);
    }
    const snap = await db.collection("reviews")
      .where("product_id", "in", productIds)
      .get();
    const reviews = snap.docs.map(d => serializeReview(d.data(), d.id));
    reviews.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    cacheSet(cacheKey, reviews, REVIEWS_TTL);
    return res.json(reviews);
  }

  if (!product_id) return res.status(400).json({ error: "product_id or store_id is required" });

  const cacheKey = `reviews:product:${product_id}`;
  const cached = cacheGet<unknown[]>(cacheKey);
  if (cached) return res.json(cached);

  const snap = await db.collection("reviews")
    .where("product_id", "==", product_id)
    .get();
  const reviews = snap.docs.map(d => serializeReview(d.data(), d.id));
  reviews.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  cacheSet(cacheKey, reviews, REVIEWS_TTL);
  return res.json(reviews);
});

router.post("/reviews", async (req, res) => {
  const { product_id, name, rating, comment } = req.body;
  if (!product_id || !name || !rating || !comment) {
    return res.status(400).json({ error: "product_id, name, rating, and comment are required" });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: "rating must be between 1 and 5" });
  }
  const ref = await db.collection("reviews").add({
    product_id, name, rating, comment,
    created_at: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  const result = serializeReview(doc.data()!, doc.id);

  // Invalidate affected caches
  cacheDeleteByPrefix(`reviews:product:${product_id}`);

  // Also invalidate store-level review cache by finding the product's store_id
  db.collection("products").doc(product_id).get()
    .then(p => { if (p.exists) cacheDeleteByPrefix(`reviews:store:${(p.data() as any).store_id}`); })
    .catch(() => {});

  return res.status(201).json(result);
});

export default router;
