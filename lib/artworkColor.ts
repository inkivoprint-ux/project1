export type ArtworkColor = { brightness?: number; contrast?: number; saturation?: number };
const amount = (value = 100) => Math.min(200, Math.max(0, Number.isFinite(value) ? value : 100)) / 100;

// Adjust the rendered pixels so previews and exported print files match.
export function adjustArtworkPixels(pixels: Uint8ClampedArray, settings: ArtworkColor) {
  const brightness = amount(settings.brightness);
  const contrast = amount(settings.contrast);
  const saturation = amount(settings.saturation);
  if (brightness === 1 && contrast === 1 && saturation === 1) return;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) continue;
    const red = (pixels[index] * brightness - 127.5) * contrast + 127.5;
    const green = (pixels[index + 1] * brightness - 127.5) * contrast + 127.5;
    const blue = (pixels[index + 2] * brightness - 127.5) * contrast + 127.5;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    pixels[index] = luminance + (red - luminance) * saturation;
    pixels[index + 1] = luminance + (green - luminance) * saturation;
    pixels[index + 2] = luminance + (blue - luminance) * saturation;
  }
}
