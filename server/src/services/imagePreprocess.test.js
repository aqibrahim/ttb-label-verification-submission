import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { preprocessImage } from "./imagePreprocess.js";

async function makeImage(width, height) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 180, b: 150 } },
  })
    .png()
    .toBuffer();
}

test("downscales an oversized image to the max dimension", async () => {
  const input = await makeImage(3000, 2000);
  const { buffer, mediaType } = await preprocessImage(input);
  const meta = await sharp(buffer).metadata();
  assert.equal(mediaType, "image/jpeg");
  assert.ok(meta.width <= 1568 && meta.height <= 1568);
});

test("leaves a small image's dimensions unchanged", async () => {
  const input = await makeImage(400, 300);
  const { buffer } = await preprocessImage(input);
  const meta = await sharp(buffer).metadata();
  assert.equal(meta.width, 400);
  assert.equal(meta.height, 300);
});

test("always normalizes output to JPEG regardless of input format", async () => {
  const input = await makeImage(200, 200);
  const { buffer, mediaType } = await preprocessImage(input);
  const meta = await sharp(buffer).metadata();
  assert.equal(mediaType, "image/jpeg");
  assert.equal(meta.format, "jpeg");
});

test("reduces file size for a large image", async () => {
  const input = await makeImage(3000, 3000);
  const { buffer } = await preprocessImage(input);
  assert.ok(buffer.length < input.length);
});
