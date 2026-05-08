import { Router } from "express";
import { db } from "../lib/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { verifyToken } from "../middlewares/verifyToken.js";
import { cacheGet, cacheSet, cacheDeleteByPrefix } from "../lib/cache.js";

const router = Router();

const STORE_TTL = 60_000; // 60 seconds

function sanitizeStore(id: string, data: FirebaseFirestore.DocumentData) {
  const { razorpay_key_secret: _secret, owner_id: _owner, ...safe } = data;
  return { id, ...safe };
}

router.get("/stores", async (req, res) => {
  const { owner_id } = req.query as Record<string, string>;
  if (!owner_id) return res.status(400).json({ error: "owner_id is required" });

  const cacheKey = `store:owner:${owner_id}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const snap = await db.collection("stores").where("owner_id", "==", owner_id).limit(1).get();
  if (snap.empty) return res.status(404).json({ error: "Store not found" });
  const doc = snap.docs[0];
  const result = sanitizeStore(doc.id, doc.data());
  cacheSet(cacheKey, result, STORE_TTL);
  return res.json(result);
});

router.get("/stores/id/:id", async (req, res) => {
  const cacheKey = `store:id:${req.params.id}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const doc = await db.collection("stores").doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: "Store not found" });
  const result = sanitizeStore(doc.id, doc.data()!);
  cacheSet(cacheKey, result, STORE_TTL);
  return res.json(result);
});

router.get("/stores/:slug", async (req, res) => {
  const cacheKey = `store:slug:${req.params.slug}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const snap = await db.collection("stores").where("slug", "==", req.params.slug).limit(1).get();
  if (snap.empty) return res.status(404).json({ error: "Store not found" });
  const doc = snap.docs[0];
  const result = sanitizeStore(doc.id, doc.data());
  cacheSet(cacheKey, result, STORE_TTL);
  return res.json(result);
});

router.post("/stores", verifyToken, async (req, res) => {
  const owner_id = (req as any).uid;
  const { name, slug, whatsapp, category, location } = req.body;
  if (!name || !slug || !whatsapp) {
    return res.status(400).json({ error: "name, slug, and whatsapp are required" });
  }
  const existing = await db.collection("stores").where("slug", "==", slug).limit(1).get();
  if (!existing.empty) return res.status(400).json({ error: "Slug already taken" });

  const ref = await db.collection("stores").add({
    name, slug, whatsapp,
    category: category ?? "",
    location: location ?? "",
    owner_id: owner_id ?? null,
    created_at: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  const result = sanitizeStore(doc.id, doc.data()!);

  cacheSet(`store:id:${doc.id}`, result, STORE_TTL);
  cacheSet(`store:slug:${slug}`, result, STORE_TTL);
  if (owner_id) cacheSet(`store:owner:${owner_id}`, result, STORE_TTL);

  return res.status(201).json(result);
});

router.patch("/stores/:id", verifyToken, async (req, res) => {
  const uid = (req as any).uid as string;
  const ref = db.collection("stores").doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Store not found" });

  const storeData = snap.data() as any;
  if (storeData.owner_id && storeData.owner_id !== uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { razorpay_key_secret, ...safeBody } = req.body;

  const updatePayload: Record<string, any> = {
    ...safeBody,
    updated_at: FieldValue.serverTimestamp(),
  };
  if (razorpay_key_secret && typeof razorpay_key_secret === "string" && razorpay_key_secret.trim()) {
    updatePayload.razorpay_key_secret = razorpay_key_secret.trim();
  }

  await ref.update(updatePayload);
  const updated = await ref.get();
  const result = sanitizeStore(updated.id, updated.data()!);

  // Invalidate all cache entries for this store
  cacheDeleteByPrefix(`store:id:${req.params.id}`);
  if (storeData.slug) cacheDeleteByPrefix(`store:slug:${storeData.slug}`);
  if (storeData.owner_id) cacheDeleteByPrefix(`store:owner:${storeData.owner_id}`);

  // Re-populate cache with fresh data
  cacheSet(`store:id:${req.params.id}`, result, STORE_TTL);
  if (storeData.slug) cacheSet(`store:slug:${storeData.slug}`, result, STORE_TTL);
  if (storeData.owner_id) cacheSet(`store:owner:${storeData.owner_id}`, result, STORE_TTL);

  return res.json(result);
});

export default router;
