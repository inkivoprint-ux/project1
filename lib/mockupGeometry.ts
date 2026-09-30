// Templates use one image-relative coordinate plane, never the responsive panel.
export const MOCKUP_REFERENCE_WIDTH = 1024;
export const MOCKUP_REFERENCE_PADDING = 12;

export function mockupFrame(imageWidth: number, imageHeight: number) {
  if (![imageWidth, imageHeight].every((value) => Number.isFinite(value) && value > 0)) throw new Error("The product image dimensions are invalid.");
  return { width: MOCKUP_REFERENCE_WIDTH, height: MOCKUP_REFERENCE_WIDTH * imageHeight / imageWidth };
}

export function fitMockupFrame(availableWidth: number, availableHeight: number, imageWidth: number, imageHeight: number) {
  const frame = mockupFrame(imageWidth, imageHeight);
  const scale = Math.max(0, Math.min(availableWidth / frame.width, availableHeight / frame.height));
  return { width: frame.width * scale, height: frame.height * scale, padding: MOCKUP_REFERENCE_PADDING * scale };
}
