import { Router } from "express";
import { db } from "../lib/firebase.js";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import nodemailer from "nodemailer";

const router = Router();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

router.post("/auth/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });

  const otp = generateOtp();
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));

  await db.collection("otps").doc(email).set({
    otp,
    expires_at: expiresAt,
    verified: false,
    created_at: FieldValue.serverTimestamp(),
  });

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: email,
      subject: "Your Advize Store verification code",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px;">
          <h2 style="color:#111;margin-bottom:8px;">Verify your email</h2>
          <p style="color:#555;margin-bottom:24px;">Use the code below to complete your Advize Store sign up. It expires in 10 minutes.</p>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;text-align:center;">
            <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#111;">${otp}</span>
          </div>
          <p style="color:#999;font-size:12px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (err: any) {
    console.error("Email send failed:", err.message);
    return res.status(500).json({ error: "Failed to send OTP email. Check SMTP configuration." });
  }

  return res.json({ message: "OTP sent" });
});

router.post("/auth/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "email and otp are required" });

  const doc = await db.collection("otps").doc(email).get();
  if (!doc.exists) return res.status(400).json({ error: "No OTP found for this email" });

  const data = doc.data()!;
  const now = Timestamp.now();

  if (data.expires_at.toMillis() < now.toMillis()) {
    return res.status(400).json({ error: "OTP has expired. Please request a new one." });
  }

  if (data.otp !== otp) {
    return res.status(400).json({ error: "Incorrect OTP. Please try again." });
  }

  await doc.ref.update({ verified: true });

  return res.json({ verified: true });
});

export default router;
