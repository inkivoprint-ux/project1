export function canvasBlendOperation(mode: string | null | undefined): GlobalCompositeOperation {
  return mode === "multiply" || mode === "screen" || mode === "overlay" ? mode : "source-over";
}

export function previewBlendMode(mode: "normal" | "screen" | "multiply" | "overlay", overlayStrength = 100) {
  return mode === "overlay" && overlayStrength < 100 ? "normal" : mode;
}

// Blend against the product photograph while preserving the artwork's alpha.
export function applyOverlayStrength(source: Uint8ClampedArray, backdrop: Uint8ClampedArray, strength: number) {
  const amount = Math.min(100, Math.max(0, strength)) / 100;
  if (amount === 0) return;
  for (let index = 0; index < source.length; index += 4) {
    if (source[index + 3] === 0) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      const foreground = source[index + channel] / 255;
      const background = backdrop[index + channel] / 255;
      const overlay = background <= 0.5 ? 2 * background * foreground : 1 - 2 * (1 - background) * (1 - foreground);
      source[index + channel] = (foreground * (1 - amount) + overlay * amount) * 255;
    }
  }
}
