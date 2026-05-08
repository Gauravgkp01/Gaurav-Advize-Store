import { Router } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { db } from "../lib/firebase.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

function getPartnerInstance(): Razorpay | null {
  const key_id = process.env.RAZORPAY_PARTNER_KEY_ID;
  const key_secret = process.env.RAZORPAY_PARTNER_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
}

// ── Partner Onboarding: Create Linked Account ─────────────────────────────────
router.post("/payments/razorpay/onboard", verifyToken, async (req, res) => {
  const uid = (req as any).uid as string;
  try {
    const {
      store_id, legal_business_name, contact_name, business_type,
      email, phone, pan, category, subcategory, city, state, postal_code, street1,
    } = req.body as Record<string, string>;

    if (!store_id || !legal_business_name || !contact_name || !business_type ||
        !email || !phone || !pan || !city || !state || !postal_code) {
      return res.status(400).json({ error: "All required fields must be provided" });
    }

    const storeSnap = await db.collection("stores").doc(store_id).get();
    if (!storeSnap.exists) return res.status(404).json({ error: "Store not found" });
    const storeData = storeSnap.data() as any;
    if (storeData.owner_id !== uid) return res.status(403).json({ error: "Forbidden" });

    const rzp = getPartnerInstance();
    if (!rzp) {
      return res.status(500).json({
        error: "Platform Razorpay partner credentials are not configured. Please set RAZORPAY_PARTNER_KEY_ID and RAZORPAY_PARTNER_KEY_SECRET.",
      });
    }

    const account = await rzp.accounts.create({
      email,
      phone,
      contact_name,
      legal_business_name,
      business_type,
      profile: {
        category: category || "ecommerce",
        subcategory: subcategory || "fashion_and_lifestyle",
        addresses: {
          registered: {
            street1: street1 || city,
            city,
            state,
            postal_code,
            country: "IN",
          },
        },
      },
      legal_info: { pan: pan.toUpperCase() },
    });

    const account_id: string = account.id;
    const status: string = (account as any).activation_status ?? "created";

    await db.collection("stores").doc(store_id).update({
      razorpay_account_id: account_id,
      razorpay_account_status: status,
      razorpay_enabled: true,
    });

    return res.json({ account_id, status });
  } catch (err: any) {
    console.error("Razorpay onboard error:", err);
    const message = err?.error?.description ?? err.message ?? "Failed to create Razorpay account";
    return res.status(500).json({ error: message });
  }
});

// ── Create Payment Order ───────────────────────────────────────────────────────
router.post("/payments/razorpay/create-order", async (req, res) => {
  try {
    const { store_id, amount_paise, receipt } = req.body as {
      store_id: string;
      amount_paise: number;
      receipt?: string;
    };

    if (!store_id || !amount_paise) {
      return res.status(400).json({ error: "store_id and amount_paise are required" });
    }

    const storeSnap = await db.collection("stores").doc(store_id).get();
    if (!storeSnap.exists) return res.status(404).json({ error: "Store not found" });
    const storeData = storeSnap.data() as any;

    const accountId: string | undefined = storeData.razorpay_account_id;
    const keyId: string | undefined = storeData.razorpay_key_id;
    const keySecret: string | undefined = storeData.razorpay_key_secret;

    let razorpay: Razorpay;
    let returnKeyId: string;

    if (accountId) {
      const rzp = getPartnerInstance();
      if (!rzp) return res.status(500).json({ error: "Platform payment gateway not configured" });
      razorpay = rzp;
      returnKeyId = process.env.RAZORPAY_PARTNER_KEY_ID!;
    } else if (keyId && keySecret) {
      razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
      returnKeyId = keyId;
    } else {
      return res.status(400).json({ error: "Payment gateway not configured for this store" });
    }

    const orderParams: any = {
      amount: amount_paise,
      currency: "INR",
      receipt: receipt ?? `rcpt_${Date.now()}`,
    };

    if (accountId) {
      orderParams.transfers = [{ account: accountId, amount: amount_paise, currency: "INR" }];
    }

    const order = await razorpay.orders.create(orderParams);
    return res.json({ order_id: order.id, key_id: returnKeyId, amount: order.amount, currency: order.currency });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Failed to create payment order" });
  }
});

// ── Verify Payment ────────────────────────────────────────────────────────────
router.post("/payments/razorpay/verify", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, store_id } = req.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    store_id: string;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !store_id) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const storeSnap = await db.collection("stores").doc(store_id).get();
    if (!storeSnap.exists) return res.status(404).json({ error: "Store not found" });
    const storeData = storeSnap.data() as any;

    const keySecret: string | undefined = storeData.razorpay_account_id
      ? process.env.RAZORPAY_PARTNER_KEY_SECRET
      : storeData.razorpay_key_secret;

    if (!keySecret) return res.status(400).json({ error: "Payment gateway not configured" });

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac("sha256", keySecret).update(body).digest("hex");

    if (expectedSignature === razorpay_signature) {
      return res.json({ verified: true });
    } else {
      return res.status(400).json({ verified: false, error: "Signature mismatch" });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Verification failed" });
  }
});

export default router;
