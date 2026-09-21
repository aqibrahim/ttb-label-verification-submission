import sharp from "sharp";

// Vision models have a practical maximum useful image dimension - sending
// something larger just costs more upload time and more tokens without
// improving extraction quality, since the model downsamples internally
// anyway. Resizing here keeps requests fast and cheap at any volume.
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 85;

/**
 * Resizes (if needed) and normalizes an uploaded label photo to JPEG
 * before it's sent to the model. Accepts JPEG/PNG/WEBP input.
 *
 * @param {Buffer} buffer  raw uploaded file bytes
 * @returns {Promise<{ buffer: Buffer, mediaType: string }>}
 */
export async function preprocessImage(buffer) {
  const image = sharp(buffer, { failOnError: false });
  const metadata = await image.metadata();

  let pipeline = image;
  if ((metadata.width && metadata.width > MAX_DIMENSION) || (metadata.height && metadata.height > MAX_DIMENSION)) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const outputBuffer = await pipeline.rotate().jpeg({ quality: JPEG_QUALITY }).toBuffer();
  return { buffer: outputBuffer, mediaType: "image/jpeg" };
}
