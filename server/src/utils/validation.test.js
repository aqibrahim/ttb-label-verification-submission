import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyBodySchema, validateImageFile } from "./validation.js";

test("verifyBodySchema fills in defaults for missing fields", () => {
  const result = verifyBodySchema.parse({});
  assert.equal(result.brand, "");
  assert.equal(result.warning, "");
});

test("verifyBodySchema rejects an oversized field", () => {
  assert.throws(() => verifyBodySchema.parse({ brand: "a".repeat(500) }));
});

test("verifyBodySchema accepts normal-sized fields", () => {
  const result = verifyBodySchema.parse({ brand: "Old Tom Distillery", abv: "45%" });
  assert.equal(result.brand, "Old Tom Distillery");
  assert.equal(result.abv, "45%");
});

test("validateImageFile rejects a missing file", () => {
  assert.equal(validateImageFile(null), "No image file was provided.");
});

test("validateImageFile rejects an unsupported mime type", () => {
  const msg = validateImageFile({ mimetype: "application/pdf" });
  assert.match(msg, /Unsupported image type/);
});

test("validateImageFile accepts a supported mime type", () => {
  assert.equal(validateImageFile({ mimetype: "image/jpeg" }), null);
});
