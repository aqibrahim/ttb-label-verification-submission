import { z } from "zod";

// Every application field is optional text (an agent might be checking a
// label against a partially-filled record, or intentionally leaving a
// field blank to see what the label itself says) but each has a sane
// max length so a malformed or abusive payload can't reach the model call.
export const verifyBodySchema = z.object({
  brand: z.string().max(200).optional().default(""),
  classType: z.string().max(200).optional().default(""),
  abv: z.string().max(100).optional().default(""),
  net: z.string().max(100).optional().default(""),
  warning: z.string().max(2000).optional().default(""),
});

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateImageFile(file) {
  if (!file) {
    return "No image file was provided.";
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return `Unsupported image type "${file.mimetype}". Use JPEG, PNG, or WEBP.`;
  }
  return null;
}

// Shape of the JSON the model is asked to return when reading a label.
// Validating this matters for a different reason than validating the
// request body: a model can return syntactically valid JSON that doesn't
// match the contract (wrong types, missing keys, a string where a boolean
// was asked for). Catching that here, rather than letting it flow into
// the comparison logic, is what turns "the model returned something weird"
// into a clear, retryable error instead of a silent bad verdict.
export const extractionResultSchema = z.object({
  brand_name: z.string().nullable().default(null),
  class_type: z.string().nullable().default(null),
  alcohol_content_raw: z.string().nullable().default(null),
  net_contents_raw: z.string().nullable().default(null),
  government_warning_text: z.string().nullable().default(null),
  government_warning_header_all_caps: z.boolean().default(true),
  government_warning_header_bold: z.boolean().default(true),
  image_quality_issues: z.array(z.string()).default([]),
  notes: z.string().default(""),
});
