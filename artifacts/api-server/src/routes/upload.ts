import { Router, Request, Response } from "express";
import multer from "multer";
import { bucket } from "../lib/firebase.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/upload", upload.single("image"), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No image file provided" });

  try {
    const ext = file.originalname.split(".").pop() ?? "jpg";
    const filename = `product-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const fileRef = bucket.file(filename);
    await fileRef.save(file.buffer, {
      contentType: file.mimetype,
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    await fileRef.makePublic();

    const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    return res.status(201).json({ url });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Upload failed" });
  }
});

export default router;
