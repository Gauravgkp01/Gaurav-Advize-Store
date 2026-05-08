import { Router } from "express";
import { db } from "../lib/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { cacheGet, cacheSet, cacheDeleteByPrefix } from "../lib/cache.js";

const router = Router();

const PRODUCTS_TTL = 30_000; // 30 seconds

function docToProduct(doc: FirebaseFirestore.DocumentSnapshot) {
  return { id: doc.id, ...doc.data() };
}

// Fetch a single product with its variants (used internally + by GET /products/:id)
async function getProductWithVariants(doc: FirebaseFirestore.DocumentSnapshot) {
  const variantsSnap = await doc.ref.collection("variants").get();
  const variants = variantsSnap.docs.map(v => ({ id: v.id, ...v.data() }));
  return { id: doc.id, ...doc.data(), variants };
}

router.get("/products", async (req, res) => {
  const { store_id } = req.query as Record<string, string>;
  const cacheKey = `products:list:${store_id ?? "__all__"}`;

  const cached = cacheGet<unknown[]>(cacheKey);
  if (cached) return res.json(cached);

  let query: FirebaseFirestore.Query = db.collection("products");
  if (store_id) query = query.where("store_id", "==", store_id);
  const snap = await query.get();

  // Return products WITHOUT variants for the list — variants are only needed
  // on the individual product detail page, fetching them here causes N+1 Firestore calls.
  const products = snap.docs.map(docToProduct) as any[];

  products.sort((a, b) => {
    const aTime = a.created_at?.toMillis?.() ?? 0;
    const bTime = b.created_at?.toMillis?.() ?? 0;
    return bTime - aTime;
  });

  cacheSet(cacheKey, products, PRODUCTS_TTL);
  return res.json(products);
});

router.get("/products/:id", async (req, res) => {
  const cacheKey = `products:detail:${req.params.id}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const doc = await db.collection("products").doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: "Product not found" });
  const result = await getProductWithVariants(doc);

  cacheSet(cacheKey, result, PRODUCTS_TTL);
  return res.json(result);
});

router.post("/products", async (req, res) => {
  const { store_id, name, price, description, image_url, image_urls, category, units, sale_price, variants } = req.body;
  if (!store_id || !name || !price) {
    return res.status(400).json({ error: "store_id, name, and price are required" });
  }
  const primaryUrl = (image_urls && image_urls.length > 0) ? image_urls[0] : (image_url ?? "");
  const productData: Record<string, unknown> = {
    store_id, name, price, description: description ?? "",
    image_url: primaryUrl,
    image_urls: image_urls ?? (primaryUrl ? [primaryUrl] : []),
    category: category ?? "",
    units: units ?? 0,
    created_at: FieldValue.serverTimestamp(),
  };
  if (sale_price != null && Number(sale_price) > 0) productData.sale_price = Number(sale_price);
  const ref = await db.collection("products").add(productData);

  if (variants && Array.isArray(variants) && variants.length > 0) {
    const batch = db.batch();
    for (const v of variants) {
      const vRef = ref.collection("variants").doc();
      batch.set(vRef, { label: v.label, values: v.values });
    }
    await batch.commit();
  }

  cacheDeleteByPrefix(`products:list:${store_id}`);
  cacheDeleteByPrefix("products:list:__all__");

  const doc = await ref.get();
  const variantsSnap = await ref.collection("variants").get();
  const savedVariants = variantsSnap.docs.map(v => ({ id: v.id, ...v.data() }));
  return res.status(201).json({ id: doc.id, ...doc.data(), variants: savedVariants });
});

router.patch("/products/:id", async (req, res) => {
  const { variants, ...fields } = req.body;
  const ref = db.collection("products").doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Product not found" });

  await ref.update({ ...fields, updated_at: FieldValue.serverTimestamp() });

  if (variants && Array.isArray(variants)) {
    const existingVariants = await ref.collection("variants").get();
    const batch = db.batch();
    for (const v of existingVariants.docs) batch.delete(v.ref);
    for (const v of variants) {
      const vRef = ref.collection("variants").doc();
      batch.set(vRef, { label: v.label, values: v.values });
    }
    await batch.commit();
  }

  // Invalidate caches
  cacheDeleteByPrefix(`products:detail:${req.params.id}`);
  const storeId = (snap.data() as any)?.store_id;
  if (storeId) cacheDeleteByPrefix(`products:list:${storeId}`);
  cacheDeleteByPrefix("products:list:__all__");

  const updated = await ref.get();
  const variantsSnap = await ref.collection("variants").get();
  const savedVariants = variantsSnap.docs.map(v => ({ id: v.id, ...v.data() }));
  return res.json({ id: updated.id, ...updated.data(), variants: savedVariants });
});

router.delete("/products/:id", async (req, res) => {
  const ref = db.collection("products").doc(req.params.id);
  const snap = await ref.get();
  const storeId = (snap.data() as any)?.store_id;

  const variantsSnap = await ref.collection("variants").get();
  const batch = db.batch();
  for (const v of variantsSnap.docs) batch.delete(v.ref);
  batch.delete(ref);
  await batch.commit();

  cacheDeleteByPrefix(`products:detail:${req.params.id}`);
  if (storeId) cacheDeleteByPrefix(`products:list:${storeId}`);
  cacheDeleteByPrefix("products:list:__all__");

  return res.status(204).send();
});

export default router;
