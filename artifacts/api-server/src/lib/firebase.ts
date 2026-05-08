import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required");
if (!clientEmail) throw new Error("FIREBASE_CLIENT_EMAIL is required");
if (!privateKey) throw new Error("FIREBASE_PRIVATE_KEY is required");
if (!storageBucket) throw new Error("FIREBASE_STORAGE_BUCKET is required");

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  });
}

export const db = getFirestore();
export const bucket = getStorage().bucket();
export const auth = getAuth();
