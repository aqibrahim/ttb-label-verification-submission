import { test } from "node:test";
import assert from "node:assert/strict";
import { compareFields, parsePercent, parseVolumeToMl, normalizeText } from "./compare.js";

test("brand name matches despite case and punctuation differences", () => {
  const { rows } = compareFields(
    { brand: "Stone's Throw" },
    { brand_name: "STONE'S THROW" }
  );
  const row = rows.find((r) => r.name === "Brand Name");
  assert.equal(row.status, "pass");
});

test("brand name fails on a genuine mismatch", () => {
  const { rows } = compareFields(
    { brand: "Old Tom Distillery" },
    { brand_name: "Young Tom Distillery" }
  );
  const row = rows.find((r) => r.name === "Brand Name");
  assert.equal(row.status, "fail");
});

test("missing brand name on the label is a fail, not a silent pass", () => {
  const { rows } = compareFields({ brand: "Old Tom Distillery" }, { brand_name: null });
  const row = rows.find((r) => r.name === "Brand Name");
  assert.equal(row.status, "fail");
});

test("alcohol content within rounding tolerance passes", () => {
  const { rows } = compareFields(
    { abv: "45%" },
    { alcohol_content_raw: "45% Alc./Vol. (90 Proof)" }
  );
  const row = rows.find((r) => r.name === "Alcohol Content");
  assert.equal(row.status, "pass");
});

test("alcohol content outside tolerance fails", () => {
  const { rows } = compareFields({ abv: "45%" }, { alcohol_content_raw: "40%" });
  const row = rows.find((r) => r.name === "Alcohol Content");
  assert.equal(row.status, "fail");
});

test("net contents matches across unit conversion", () => {
  const { rows } = compareFields({ net: "750 mL" }, { net_contents_raw: "0.75 L" });
  const row = rows.find((r) => r.name === "Net Contents");
  assert.equal(row.status, "pass");
});

test("government warning must match exactly - wording differences fail", () => {
  const { rows } = compareFields(
    { warning: "GOVERNMENT WARNING: exact required text." },
    { government_warning_text: "Government warning: slightly different text." }
  );
  const row = rows.find((r) => r.name === "Government Warning");
  assert.equal(row.status, "fail");
});

test("government warning header not in all caps is flagged for review, not auto-failed", () => {
  const { rows } = compareFields(
    { warning: "Sample warning text." },
    {
      government_warning_text: "Sample warning text.",
      government_warning_header_all_caps: false,
    }
  );
  const row = rows.find((r) => r.name === "Government Warning");
  assert.equal(row.status, "review");
});

test("overall verdict is fail if any field fails", () => {
  const { overall } = compareFields(
    { brand: "Old Tom Distillery", abv: "45%" },
    { brand_name: "Old Tom Distillery", alcohol_content_raw: "40%" }
  );
  assert.equal(overall, "fail");
});

test("parsePercent extracts a numeric value from label text", () => {
  assert.equal(parsePercent("45% Alc./Vol."), 45);
  assert.equal(parsePercent("no number here"), null);
});

test("parseVolumeToMl converts liters and fluid ounces to milliliters", () => {
  assert.equal(parseVolumeToMl("0.75 L"), 750);
  assert.ok(Math.abs(parseVolumeToMl("25.4 fl oz") - 751.17) < 0.5);
});

test("normalizeText strips punctuation and case for comparison", () => {
  assert.equal(normalizeText("Stone's Throw"), normalizeText("STONE'S THROW"));
});
