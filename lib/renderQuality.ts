export type RenderSize = { width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function calculateRenderSize(cssWidth: number, cssHeight: number, devicePixelRatio = 1): RenderSize {
  const qualityScale = clamp(Math.max(devicePixelRatio, 2), 1, 2.5);
  let width = Math.max(1, Math.round(cssWidth * qualityScale));
  let height = Math.max(1, Math.round(cssHeight * qualityScale));
  const maxEdge = 1800;
  const maxPixels = 1_800_000;
  const edgeScale = Math.min(1, maxEdge / Math.max(width, height));
  const pixelScale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, width * height)));
  const scale = Math.min(edgeScale, pixelScale);
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  return { width, height };
}

export function containImageSize(imageWidth: number, imageHeight: number, targetWidth: number, targetHeight: number): RenderSize {
  const imageRatio = Math.max(1, imageWidth) / Math.max(1, imageHeight);
  const targetRatio = Math.max(1, targetWidth) / Math.max(1, targetHeight);
  if (imageRatio > targetRatio) return { width: targetWidth, height: targetWidth / imageRatio };
  return { width: targetHeight * imageRatio, height: targetHeight };
}

export function estimatedPrintDpi(imageWidth: number, imageHeight: number, printWidthMm: number, printHeightMm: number) {
  const horizontal = imageWidth / Math.max(0.1, printWidthMm / 25.4);
  const vertical = imageHeight / Math.max(0.1, printHeightMm / 25.4);
  return Math.round(Math.min(horizontal, vertical));
}
