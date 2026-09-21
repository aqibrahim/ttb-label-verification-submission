import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// The model client reads its config at import time via process.env, so
// these need to be set before the module is imported.
process.env.MODEL_API_URL = "https://example.invalid/v1/messages";
process.env.MODEL_API_KEY = "test-key";
process.env.MODEL_NAME = "test-model";

const { extractLabelFields } = await import("./modelClient.js");

let originalFetch;
let calls;

beforeEach(() => {
  originalFetch = global.fetch;
  calls = 0;
});

afterEach(() => {
  global.fetch = originalFetch;
});

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function textContent(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj) }] };
}

test("returns validated data on a clean first response", async () => {
  global.fetch = async () => {
    calls++;
    return jsonResponse(
      textContent({
        brand_name: "Old Tom Distillery",
        class_type: "Bourbon",
        alcohol_content_raw: "45%",
        net_contents_raw: "750 mL",
        government_warning_text: "GOVERNMENT WARNING: text",
        government_warning_header_all_caps: true,
        government_warning_header_bold: true,
        image_quality_issues: [],
        notes: "",
      })
    );
  };

  const result = await extractLabelFields("base64data", "image/jpeg");
  assert.equal(result.brand_name, "Old Tom Distillery");
  assert.equal(calls, 1);
});

test("retries once on a 500 and succeeds on the second attempt", async () => {
  global.fetch = async () => {
    calls++;
    if (calls === 1) return jsonResponse({}, 500);
    return jsonResponse(textContent({ brand_name: "Recovered Brand" }));
  };

  const result = await extractLabelFields("base64data", "image/jpeg");
  assert.equal(result.brand_name, "Recovered Brand");
  assert.equal(calls, 2);
});

test("does not retry on a 400 - fails immediately", async () => {
  global.fetch = async () => {
    calls++;
    return jsonResponse({ error: "bad request" }, 400);
  };

  await assert.rejects(() => extractLabelFields("base64data", "image/jpeg"));
  assert.equal(calls, 1);
});

test("retries on malformed JSON from the model, then succeeds", async () => {
  global.fetch = async () => {
    calls++;
    if (calls === 1) {
      return jsonResponse({ content: [{ type: "text", text: "not valid json {{{" }] });
    }
    return jsonResponse(textContent({ brand_name: "Fixed On Retry" }));
  };

  const result = await extractLabelFields("base64data", "image/jpeg");
  assert.equal(result.brand_name, "Fixed On Retry");
  assert.equal(calls, 2);
});

test("retries when the response violates the extraction schema (wrong type)", async () => {
  global.fetch = async () => {
    calls++;
    if (calls === 1) {
      // government_warning_header_all_caps should be a boolean, not a string
      return jsonResponse(textContent({ brand_name: "X", government_warning_header_all_caps: "yes" }));
    }
    return jsonResponse(textContent({ brand_name: "X", government_warning_header_all_caps: true }));
  };

  const result = await extractLabelFields("base64data", "image/jpeg");
  assert.equal(result.government_warning_header_all_caps, true);
  assert.equal(calls, 2);
});

test("gives up after the maximum number of attempts and surfaces the last error", async () => {
  global.fetch = async () => {
    calls++;
    return jsonResponse({}, 503);
  };

  await assert.rejects(() => extractLabelFields("base64data", "image/jpeg"));
  assert.equal(calls, 3); // MAX_ATTEMPTS
});
