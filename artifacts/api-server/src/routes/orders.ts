import { Router } from "express";
import { db } from "../lib/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { verifyToken } from "../middlewares/verifyToken.js";
import { cacheGet, cacheSet, cacheDeleteByPrefix } from "../lib/cache.js";

const router = Router();

const ORDERS_TTL = 30_000;

router.post("/orders", async (req, res) => {
  const {
    store_id, razorpay_order_id, razorpay_payment_id,
    amount_paise, items, buyer,
  } = req.body as {
    store_id: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    amount_paise: number;
    items: { productId: string; name: string; quantity: number; price: number; variant?: string }[];
    buyer: { name: string; phone: string; addressLine: string; city: string; pincode: string };
  };

  if (!store_id || !amount_paise || !items) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const ref = await db.collection("orders").add({
    store_id,
    payment_method: "razorpay",
    razorpay_order_id: razorpay_order_id ?? null,
    razorpay_payment_id: razorpay_payment_id ?? null,
    payment_status: "paid",
    amount_paise,
    items,
    buyer: buyer ?? null,
    status: "pending",
    created_at: FieldValue.serverTimestamp(),
  });

  cacheDeleteByPrefix(`orders:store:${store_id}`);
  return res.status(201).json({ id: ref.id });
});

router.get("/orders/store/:store_id", verifyToken, async (req, res) => {
  const uid = (req as any).uid as string;
  const { store_id } = req.params;
  const cacheKey = `orders:store:${store_id}`;

  const cached = cacheGet<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const storeSnap = await db.collection("stores").doc(store_id).get();
  if (!storeSnap.exists) return res.status(404).json({ error: "Store not found" });
  const storeData = storeSnap.data() as any;
  if (storeData.owner_id && storeData.owner_id !== uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const snap = await db.collection("orders")
    .where("store_id", "==", store_id)
    .orderBy("created_at", "desc")
    .get();

  const rawOrders = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  const orders = rawOrders.map((o: any) => ({
    id: o.id,
    payment_method: o.payment_method ?? "razorpay",
    payment_status: o.payment_status ?? "paid",
    cashfree_order_id: o.cashfree_order_id ?? null,
    cashfree_payment_id: o.cashfree_payment_id ?? null,
    razorpay_payment_id: o.razorpay_payment_id ?? null,
    amount_paise: o.amount_paise ?? 0,
    items: o.items ?? [],
    buyer: o.buyer ?? null,
    status: o.status ?? "pending",
    created_at: o.created_at,
  }));

  const totalOrders = orders.length;
  const totalRevenuePaise = orders
    .filter((o: any) => o.payment_status === "paid")
    .reduce((s: number, o: any) => s + (o.amount_paise ?? 0), 0);
  const pendingOrders = orders.filter((o: any) => o.status === "pending").length;
  const confirmedOrders = orders.filter((o: any) => o.status === "confirmed").length;
  const deliveredOrders = orders.filter((o: any) => o.status === "delivered").length;
  const cancelledOrders = orders.filter((o: any) => o.status === "cancelled").length;

  const result = {
    totalOrders,
    totalRevenuePaise,
    totalRevenueRupees: Math.round(totalRevenuePaise / 100),
    pendingOrders,
    confirmedOrders,
    deliveredOrders,
    cancelledOrders,
    recentOrders: orders.slice(0, 10),
    orders,
  };

  cacheSet(cacheKey, result, ORDERS_TTL);
  return res.json(result);
});

router.patch("/orders/:order_id/status", verifyToken, async (req, res) => {
  const uid = (req as any).uid as string;
  const { order_id } = req.params;
  const { status } = req.body as { status: string };

  const validStatuses = ["pending", "confirmed", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const orderRef = db.collection("orders").doc(order_id);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return res.status(404).json({ error: "Order not found" });

  const orderData = orderSnap.data() as any;
  const storeSnap = await db.collection("stores").doc(orderData.store_id).get();
  if (!storeSnap.exists) return res.status(404).json({ error: "Store not found" });
  const storeData = storeSnap.data() as any;
  if (storeData.owner_id && storeData.owner_id !== uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await orderRef.update({ status, updated_at: FieldValue.serverTimestamp() });
  cacheDeleteByPrefix(`orders:store:${orderData.store_id}`);
  return res.json({ ok: true, status });
});

export default router;
