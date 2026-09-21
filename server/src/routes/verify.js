import { Router } from "express";
import multer from "multer";
import { extractLabelFields } from "../services/modelClient.js";
import { preprocessImage } from "../services/imagePreprocess.js";
import { compareFields } from "../utils/compare.js";
import { verifyBodySchema, validateImageFile } from "../utils/validation.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per label photo
});

const router = Router();

router.post("/verify", upload.single("image"), async (req, res) => {
  try {
    const fileError = validateImageFile(req.file);
    if (fileError) {
      return res.status(400).json({ error: fileError });
    }

    const parsed = verifyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request fields.", details: parsed.error.issues });
    }
    const { brand, classType, abv, net, warning } = parsed.data;

    const { buffer: processedBuffer, mediaType } = await preprocessImage(req.file.buffer);
    const base64 = processedBuffer.toString("base64");

    const extracted = await extractLabelFields(base64, mediaType);
    const demoMode = Boolean(extracted._demoMode);
    const { rows, overall } = compareFields({ brand, classType, abv, net, warning }, extracted);

    res.json({ overall, rows, extracted, demoMode });
  } catch (err) {
    console.error("Verification error:", err.message);
    res.status(502).json({ error: err.message || "Verification failed." });
  }
});

export default router;
