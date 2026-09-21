#!/usr/bin/env node
// Evaluation harness: runs every fixture in eval/fixtures/fixtures.json
// through the real extraction + comparison pipeline and reports two kinds
// of accuracy separately, since they fail for different reasons:
//
//   1. Extraction accuracy - did the model correctly read each field off
//      the image, compared to the text actually rendered onto it?
//   2. Verdict accuracy - did the comparison logic reach the expected
//      match/review/mismatch conclusion for each field?
//
// Requires MODEL_API_URL / MODEL_API_KEY / MODEL_NAME to be set (see
// server/.env.example) - this hits the real model, unlike the unit tests
// under server/src, which mock it out on purpose.
//
// Usage (from the eval/ directory):
//   node run_eval.mjs

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.join(__dirname, "..", "server", "src");

// Load the server's .env explicitly by path, rather than relying on
// dotenv/config's cwd-based default, since this script is typically run
// from eval/ rather than server/.
dotenv.config({ path: path.join(__dirname, "..", "server", ".env") });

const { extractLabelFields } = await import(path.join(serverSrc, "services", "modelClient.js"));
const { preprocessImage } = await import(path.join(serverSrc, "services", "imagePreprocess.js"));
const { compareFields } = await import(path.join(serverSrc, "utils", "compare.js"));

function normalizeForComparison(s) {
  return (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function fieldsMatch(expected, actual) {
  if (expected == null && actual == null) return true;
  return normalizeForComparison(expected) === normalizeForComparison(actual);
}

async function loadFixtures() {
  const raw = await readFile(path.join(__dirname, "fixtures", "fixtures.json"), "utf-8");
  return JSON.parse(raw);
}

async function runFixture(fixture) {
  const imagePath = path.join(__dirname, "fixtures", fixture.image);
  const rawBuffer = await readFile(imagePath);
  const { buffer, mediaType } = await preprocessImage(rawBuffer);
  const base64 = buffer.toString("base64");

  const extracted = await extractLabelFields(base64, mediaType);
  const { rows } = compareFields(fixture.application, extracted);

  const extractionChecks = Object.entries(fixture.true_label_text).map(([key, trueValue]) => {
    const actualValue = extracted[key];
    return { field: key, trueValue, actualValue, correct: fieldsMatch(trueValue, actualValue) };
  });

  const verdictChecks = Object.entries(fixture.expected_verdicts).map(([fieldName, expectedStatus]) => {
    const row = rows.find((r) => r.name === fieldName);
    const actualStatus = row ? row.status : "MISSING_ROW";
    return { field: fieldName, expectedStatus, actualStatus, correct: actualStatus === expectedStatus };
  });

  return { fixture, extractionChecks, verdictChecks };
}

function printReport(results) {
  let totalExtractionChecks = 0;
  let correctExtractionChecks = 0;
  let totalVerdictChecks = 0;
  let correctVerdictChecks = 0;

  for (const { fixture, extractionChecks, verdictChecks } of results) {
    console.log(`\n${fixture.id}`);
    console.log(`  ${fixture.notes}`);

    for (const check of extractionChecks) {
      totalExtractionChecks++;
      if (check.correct) correctExtractionChecks++;
      const mark = check.correct ? "✓" : "✗";
      console.log(`  [extract] ${mark} ${check.field}`);
      if (!check.correct) {
        console.log(`      expected: ${JSON.stringify(check.trueValue)}`);
        console.log(`      got:      ${JSON.stringify(check.actualValue)}`);
      }
    }

    for (const check of verdictChecks) {
      totalVerdictChecks++;
      if (check.correct) correctVerdictChecks++;
      const mark = check.correct ? "✓" : "✗";
      console.log(`  [verdict] ${mark} ${check.field}: expected ${check.expectedStatus}, got ${check.actualStatus}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  if (totalExtractionChecks === 0) {
    console.log("No fixtures completed successfully - see errors above (likely missing MODEL_API_KEY).");
  } else {
    console.log(
      `Extraction accuracy: ${correctExtractionChecks}/${totalExtractionChecks} (${(
        (100 * correctExtractionChecks) /
        totalExtractionChecks
      ).toFixed(1)}%)`
    );
    console.log(
      `Verdict accuracy:    ${correctVerdictChecks}/${totalVerdictChecks} (${(
        (100 * correctVerdictChecks) /
        totalVerdictChecks
      ).toFixed(1)}%)`
    );
  }
  console.log("=".repeat(60));
}

async function main() {
  const fixtures = await loadFixtures();
  const results = [];
  for (const fixture of fixtures) {
    try {
      results.push(await runFixture(fixture));
    } catch (err) {
      console.error(`\n${fixture.id}: FAILED TO RUN — ${err.message}`);
    }
  }
  printReport(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
