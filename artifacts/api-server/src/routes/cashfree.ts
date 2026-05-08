import { Router } from "express";
import crypto from "crypto";
import { db } from "../lib/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { cacheDeleteByPrefix } from "../lib/cache.js";

const router = Router();

const CF_BASE = process.env.CASHFREE_ENV === "production"
  ? "https://api.cashfree.com/pg"
  : "https://sandbox.cashfree.com/pg";

const CF_VERSION = "2022-09-01";

function cfHeaders() {
  return {
    "x-client-id": process.env.CASHFREE_APP_ID ?? "",
    "x-client-secret": process.env.CASHFREE_SECRET_KEY ?? "",
    "x-api-version": CF_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

router.post("/cashfree/create-order", async (req, res) => {
  try {
    const { store_id, amount_paise, items, buyer, slug } = req.body as {
      store_id: string;
      amount_paise: number;
      items: { productId: string; name: string; quantity: number; price: number; variant?: string }[];
      buyer: { name: string; phone: string; addressLine: string; city: string; pincode: string };
      slug: string;
    };

    if (!store_id || !amount_paise || !items?.length || !buyer || !slug) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const storeSnap = await db.collection("stores").doc(store_id).get();
    if (!storeSnap.exists) return res.status(404).json({ error: "Store not found" });
    const storeData = storeSnap.data() as any;

    if (!storeData.advize_payment_enabled) {
      return res.status(403).json({ error: "Advize Payment not enabled for this store" });
    }

    if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
      return res.status(503).json({ error: "Payment gateway not configured" });
    }

    const cfOrderId = `ADV${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const amountRupees = Math.round(amount_paise) / 100;

    const baseUrl = process.env.STORE_BASE_URL ?? "https://store.advize.in";
    const returnUrl = `${baseUrl}/store/${slug}/cart?advize_oid={order_id}&advize_status={payment_status}`;
    const notifyUrl = `${baseUrl}/api/cashfree/webhook`;

    const cfRes = await fetch(`${CF_BASE}/orders`, {
      method: "POST",
      headers: cfHeaders(),
      body: JSON.stringify({
        order_id: cfOrderId,
        order_amount: amountRupees,
        order_currency: "INR",
        customer_details: {
          customer_id: `cust_${buyer.phone.replace(/\D/g, "").slice(0, 10)}`,
          customer_name: buyer.name.slice(0, 50),
          customer_phone: `+91${buyer.phone.replace(/\D/g, "").slice(0, 10)}`,
        },
        order_meta: {
          return_url: returnUrl,
          notify_url: notifyUrl,
        },
        order_note: `Store: ${(storeData.name as string | undefined) ?? store_id}`,
      }),
    });

    const cfText = await cfRes.text();
    if (!cfRes.ok) {
      console.error("Cashfree error:", cfText);
      return res.status(502).json({ error: "Payment order creation failed", detail: cfText });
    }

    const cfData = JSON.parse(cfText) as any;
    const paymentSessionId = cfData.payment_session_id as string | undefined;
    if (!paymentSessionId) {
      return res.status(502).json({ error: "No payment session returned", detail: cfText });
    }

    const orderRef = await db.collection("orders").add({
      store_id,
      payment_method: "advize",
      cashfree_order_id: cfOrderId,
      cashfree_payment_id: null,
      payment_status: "pending",
      amount_paise,
      items,
      buyer: buyer ?? null,
      status: "pending",
      created_at: FieldValue.serverTimestamp(),
    });

    cacheDeleteByPrefix(`orders:store:${store_id}`);

    return res.json({
      payment_session_id: paymentSessionId,
      order_doc_id: orderRef.id,
      cf_order_id: cfOrderId,
    });
  } catch (err: any) {
    console.error("cashfree create-order error", err);
    return res.status(500).json({ error: err?.message ?? "Internal error" });
  }
});

router.post("/cashfree/webhook", async (req, res) => {
  try {
    const timestamp = req.headers["x-webhook-timestamp"] as string | undefined;
    const signature = req.headers["x-webhook-signature"] as string | undefined;
    const secret = process.env.CASHFREE_SECRET_KEY ?? "";

    if (timestamp && signature && secret) {
      const rawBody = JSON.stringify(req.body);
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}${rawBody}`)
        .digest("base64");
      if (expectedSig !== signature) {
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const event = req.body as any;
    const eventType: string = event?.type ?? "";

    if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
      const cfOrderId = event?.data?.order?.order_id as string | undefined;
      const cfPaymentId = String(event?.data?.payment?.cf_payment_id ?? "");
      if (cfOrderId) {
        const snap = await db.collection("orders")
          .where("cashfree_order_id", "==", cfOrderId)
          .limit(1)
          .get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const data = doc.data() as any;
          await doc.ref.update({
            payment_status: "paid",
            cashfree_payment_id: cfPaymentId,
            status: "confirmed",
            paid_at: FieldValue.serverTimestamp(),
          });
          cacheDeleteByPrefix(`orders:store:${data.store_id as string}`);
        }
      }
    } else if (eventType === "PAYMENT_FAILED_WEBHOOK") {
      const cfOrderId = event?.data?.order?.order_id as string | undefined;
      if (cfOrderId) {
        const snap = await db.collection("orders")
          .where("cashfree_order_id", "==", cfOrderId)
          .limit(1)
          .get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const data = doc.data() as any;
          await doc.ref.update({ payment_status: "failed" });
          cacheDeleteByPrefix(`orders:store:${data.store_id as string}`);
        }
      }
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("cashfree webhook error", err);
    return res.status(500).json({ error: err?.message });
  }
});

router.get("/cashfree/verify/:cf_order_id", async (req, res) => {
  try {
    const { cf_order_id } = req.params;
    const snap = await db.collection("orders")
      .where("cashfree_order_id", "==", cf_order_id)
      .limit(1)
      .get();
    if (snap.empty) return res.status(404).json({ error: "Order not found" });
    const doc = snap.docs[0];
    const data = doc.data() as any;
    return res.json({
      id: doc.id,
      payment_status: data.payment_status,
      status: data.status,
      amount_paise: data.amount_paise,
      cf_order_id: data.cashfree_order_id,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

export default router;
