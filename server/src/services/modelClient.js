// Thin client around a hosted vision-language model, used to read the
// structured fields off a label photo. Kept behind a small interface
// (extractLabelFields) so the rest of the app doesn't depend on any one
// provider's request/response shape - swapping providers means changing
// this file only.

import "dotenv/config";
import { extractionResultSchema } from "../utils/validation.js";

const MODEL_API_URL = process.env.MODEL_API_URL;
const MODEL_API_KEY = process.env.MODEL_API_KEY;
const MODEL_NAME = process.env.MODEL_NAME;

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

const EXTRACTION_PROMPT = `You are assisting a federal alcohol label compliance review. Look at this alcohol beverage label image and extract the following fields exactly as they appear on the label. Respond with ONLY a raw JSON object, no markdown fences, no commentary, matching this schema exactly:

{
  "brand_name": string or null,
  "class_type": string or null,
  "alcohol_content_raw": string or null,
  "net_contents_raw": string or null,
  "government_warning_text": string or null,
  "government_warning_header_all_caps": boolean,
  "government_warning_header_bold": boolean,
  "image_quality_issues": array of short strings (e.g. "glare", "angled", "blurry", "partially cropped") - empty array if none,
  "notes": short string of anything unusual, or empty string
}

Rules:
- Transcribe text exactly as printed, preserving original capitalization and punctuation, for brand_name, class_type, alcohol_content_raw, net_contents_raw, and government_warning_text.
- government_warning_text should be the full warning statement text visible on the label, or null if none is visible.
- If a field is not visible or not legible, use null for that field rather than guessing.
- Do not include any text outside the JSON object.`;

function assertConfigured() {
  const missing = ["MODEL_API_URL", "MODEL_API_KEY", "MODEL_NAME"].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Label-reading service is not configured. Missing environment variable(s): ${missing.join(", ")}. See server/.env.example.`
    );
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonFromModelText(text) {
  const clean = text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(clean);
}

async function requestOnce(base64Image, mediaType) {
  const response = await fetch(MODEL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MODEL_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Image } },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    const error = new Error(`Label-reading request failed (${response.status}): ${errText.slice(0, 300)}`);
    // 4xx (other than 429) means the request itself is wrong - a bad API
    // key, a malformed body - and retrying identical input won't help.
    // 429 and 5xx are worth a retry since they're often transient.
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }

  const data = await response.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) {
    const error = new Error("Label-reading service returned no readable text content.");
    error.retryable = true;
    throw error;
  }

  let parsedJson;
  try {
    parsedJson = parseJsonFromModelText(textBlock.text);
  } catch {
    const error = new Error("Could not parse the label-reading service's response as JSON.");
    error.retryable = true; // a fresh generation attempt may well come back clean
    throw error;
  }

  const validated = extractionResultSchema.safeParse(parsedJson);
  if (!validated.success) {
    const error = new Error(
      `Label-reading service returned a response that didn't match the expected shape: ${validated.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
    error.retryable = true;
    throw error;
  }

  return validated.data;
}

/**
 * Sends a label image to the configured vision model and returns the
 * structured, schema-validated fields it extracted. Retries on transient
 * failures (rate limits, server errors, malformed/invalid JSON) with
 * exponential backoff; does not retry on non-retryable failures like a
 * bad request or missing configuration.
 *
 * @param {string} base64Image  raw base64-encoded image bytes (no data: prefix)
 * @param {string} mediaType    e.g. "image/jpeg"
 * @returns {Promise<object>}
 */
export async function extractLabelFields(base64Image, mediaType) {
  assertConfigured();

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await requestOnce(base64Image, mediaType);
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      if (!err.retryable || isLastAttempt) {
        throw err;
      }
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
