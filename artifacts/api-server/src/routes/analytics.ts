import { Router } from "express";
import { db } from "../lib/firebase.js";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { cacheGet, cacheSet, cacheDeleteByPrefix } from "../lib/cache.js";

const router = Router();

const ANALYTICS_TTL = 120_000; // 2 minutes

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#f97316", "#8b5cf6", "#10b981"];

router.post("/analytics/click", async (req, res) => {
  const { product_id, store_id } = req.body;
  if (!product_id || !store_id) {
    return res.status(400).json({ error: "product_id and store_id are required" });
  }
  await db.collection("product_clicks").add({
    product_id, store_id,
    clicked_at: FieldValue.serverTimestamp(),
  });
  // Invalidate analytics cache so next fetch is fresh
  cacheDeleteByPrefix(`analytics:${store_id}`);
  return res.status(201).json({ ok: true });
});

router.get("/analytics/:store_id", async (req, res) => {
  const { store_id } = req.params;
  const cacheKey = `analytics:${store_id}`;

  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const [clicksSnap, productsSnap] = await Promise.all([
    db.collection("product_clicks").where("store_id", "==", store_id).get(),
    db.collection("products").where("store_id", "==", store_id).get(),
  ]);

  const clicks = clicksSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  const productMap: Record<string, { name: string; category: string }> = {};
  for (const p of products) {
    productMap[p.id] = { name: p.name, category: p.category ?? "Uncategorised" };
  }

  const reviewsSnap = await db.collection("reviews")
    .where("product_id", "in", products.length > 0 ? products.map(p => p.id) : ["__none__"])
    .get().catch(() => ({ docs: [] as any[] }));
  const reviews = reviewsSnap.docs.map((d: any) => d.data()) as any[];

  const clicksByProduct: Record<string, { name: string; clicks: number }> = {};
  for (const c of clicks) {
    const pid = c.product_id;
    const info = productMap[pid];
    if (!clicksByProduct[pid]) {
      clicksByProduct[pid] = { name: info?.name ?? pid, clicks: 0 };
    }
    clicksByProduct[pid].clicks++;
  }

  const productClickList = Object.entries(clicksByProduct)
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.clicks - a.clicks);

  const totalClicks = productClickList.reduce((s, p) => s + p.clicks, 0);

  const clicksByCategory: Record<string, number> = {};
  for (const c of clicks) {
    const cat = productMap[c.product_id]?.category ?? "Uncategorised";
    clicksByCategory[cat] = (clicksByCategory[cat] ?? 0) + 1;
  }
  for (const p of products) {
    const cat = p.category || "Uncategorised";
    if (!(cat in clicksByCategory)) clicksByCategory[cat] = 0;
  }

  const categoryBreakdown = Object.entries(clicksByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([category, clicks], i) => ({
      category, clicks,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyClicks = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dayLabel = days[d.getDay()];
    const dateStr = d.toISOString().slice(0, 10);
    const count = clicks.filter(c => {
      const ts = c.clicked_at instanceof Timestamp ? c.clicked_at.toDate() : new Date(c.clicked_at);
      return ts.toISOString().slice(0, 10) === dateStr;
    }).length;
    return { day: dayLabel, clicks: count };
  });

  const ratingSum = reviews.reduce((s: number, r: any) => s + r.rating, 0);
  const avgRating = reviews.length ? (ratingSum / reviews.length).toFixed(1) : null;

  const inStock = products.filter(p => p.units > 0).length;
  const outOfStock = products.filter(p => p.units === 0).length;

  const result = {
    totalClicks,
    totalReviews: reviews.length,
    avgRating,
    inStock,
    outOfStock,
    productClicks: productClickList,
    mostClicked: productClickList[0] ?? null,
    leastClicked: productClickList[productClickList.length - 1] ?? null,
    categoryBreakdown,
    weeklyClicks,
  };

  cacheSet(cacheKey, result, ANALYTICS_TTL);
  return res.json(result);
});

router.get("/analytics/product/:product_id", async (req, res) => {
  const { product_id } = req.params;
  const cacheKey = `analytics:product:${product_id}`;

  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const snap = await db.collection("product_clicks").where("product_id", "==", product_id).get();
  const allClicks = snap.docs.map(d => d.data()) as any[];
  const totalClicks = allClicks.length;

  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyClicks = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dayLabel = days[d.getDay()];
    const dateStr = d.toISOString().slice(0, 10);
    const count = allClicks.filter(c => {
      const ts = c.clicked_at instanceof Timestamp ? c.clicked_at.toDate() : new Date(c.clicked_at);
      return ts.toISOString().slice(0, 10) === dateStr;
    }).length;
    return { day: dayLabel, clicks: count };
  });

  const result = { totalClicks, weeklyClicks };
  cacheSet(cacheKey, result, ANALYTICS_TTL);
  return res.json(result);
});

export default router;
