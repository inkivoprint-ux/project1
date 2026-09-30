import type { BlendMode, SurfaceType, TemplateArea } from "./customization";
import { loadCanvasImage } from "./canvasImages";
import { mockupFrame, MOCKUP_REFERENCE_PADDING } from "./mockupGeometry";

export type PixelImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type SmartAreaSuggestion = {
  x: number;
  y: number;
  width: number;
  height: number;
  surface: SurfaceType;
  curvature: number;
  taper: number;
  maskRadius: number;
  opacity: number;
  blendMode: BlendMode;
  confidence: number;
};

type Bounds = { x: number; y: number; width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 10) / 10;

export function detectForegroundBounds(image: PixelImage): Bounds {
  const { data, width, height } = image;
  const cornerSize = Math.max(2, Math.floor(Math.min(width, height) * 0.04));
  const corners: Array<[number, number]> = [[0, 0], [width - cornerSize, 0], [0, height - cornerSize], [width - cornerSize, height - cornerSize]];
  let backgroundR = 0;
  let backgroundG = 0;
  let backgroundB = 0;
  let backgroundSamples = 0;
  let transparentSamples = 0;

  for (const [startX, startY] of corners) {
    for (let y = startY; y < Math.min(height, startY + cornerSize); y += 2) {
      for (let x = startX; x < Math.min(width, startX + cornerSize); x += 2) {
        const index = (y * width + x) * 4;
        const alpha = data[index + 3];
        if (alpha < 24) transparentSamples += 1;
        else {
          backgroundR += data[index];
          backgroundG += data[index + 1];
          backgroundB += data[index + 2];
          backgroundSamples += 1;
        }
      }
    }
  }

  const hasTransparentBackground = transparentSamples > Math.max(4, backgroundSamples * 0.12);
  const baseR = backgroundSamples ? backgroundR / backgroundSamples : 0;
  const baseG = backgroundSamples ? backgroundG / backgroundSamples : 0;
  const baseB = backgroundSamples ? backgroundB / backgroundSamples : 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const step = Math.max(1, Math.floor(Math.max(width, height) / 900));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      const distance = Math.sqrt(
        (data[index] - baseR) ** 2 +
        (data[index + 1] - baseG) ** 2 +
        (data[index + 2] - baseB) ** 2,
      );
      const foreground = hasTransparentBackground ? alpha > 24 : alpha > 24 && distance > 34;
      if (!foreground) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return { x: width * 0.1, y: height * 0.08, width: width * 0.8, height: height * 0.84 };
  return { x: minX, y: minY, width: maxX - minX + step, height: maxY - minY + step };
}

export function suggestSmartArea(
  image: PixelImage,
  preferredSurface: SurfaceType,
  stageWidth: number,
  stageHeight: number,
  stagePadding = 12,
): SmartAreaSuggestion {
  const bounds = detectForegroundBounds(image);
  const contentWidth = Math.max(1, stageWidth - stagePadding * 2);
  const contentHeight = Math.max(1, stageHeight - stagePadding * 2);
  const scale = Math.min(contentWidth / image.width, contentHeight / image.height);
  const renderedWidth = image.width * scale;
  const renderedHeight = image.height * scale;
  const imageLeft = (stageWidth - renderedWidth) / 2;
  const imageTop = (stageHeight - renderedHeight) / 2;
  const object = {
    x: imageLeft + bounds.x * scale,
    y: imageTop + bounds.y * scale,
    width: bounds.width * scale,
    height: bounds.height * scale,
  };

  const isFabric = preferredSurface === "fabric";
  const isCylinder = preferredSurface === "cylinder" || preferredSurface === "tapered-cylinder";
  const relative = isFabric
    ? { x: 0.31, y: 0.23, width: 0.38, height: 0.5 }
    : isCylinder
      ? { x: 0.32, y: 0.25, width: 0.36, height: 0.49 }
      : { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };

  const x = ((object.x + object.width * relative.x) / stageWidth) * 100;
  const y = ((object.y + object.height * relative.y) / stageHeight) * 100;
  const width = ((object.width * relative.width) / stageWidth) * 100;
  const height = ((object.height * relative.height) / stageHeight) * 100;
  const objectCoverage = (bounds.width * bounds.height) / (image.width * image.height);

  return {
    x: round(clamp(x, 1, 92)),
    y: round(clamp(y, 1, 90)),
    width: round(clamp(width, 8, 65)),
    height: round(clamp(height, 10, 70)),
    surface: preferredSurface,
    curvature: isFabric ? 58 : isCylinder ? 72 : 20,
    taper: preferredSurface === "tapered-cylinder" ? 12 : 0,
    maskRadius: isFabric ? 2 : isCylinder ? 5 : 2,
    opacity: isFabric ? 1 : 0.96,
    blendMode: "normal",
    confidence: Math.round(clamp(56 + objectCoverage * 52, 58, 96)),
  };
}

export async function analyseMockupImage(src: string, surface: SurfaceType, stageWidth?: number, stageHeight?: number) {
  const image = await loadCanvasImage(src, "The mockup image could not be analysed. Check image access and try again.");
  const frame = mockupFrame(image.naturalWidth, image.naturalHeight);
  const maxDimension = 900;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas analysis is unavailable in this browser.");
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  return suggestSmartArea(pixels, surface, stageWidth ?? frame.width, stageHeight ?? frame.height, MOCKUP_REFERENCE_PADDING);
}

export async function generateSurfaceMap(
  src: string,
  area: Pick<TemplateArea, "x" | "y" | "width" | "height">,
  suppliedWidth?: number,
  suppliedHeight?: number,
  stagePadding = 12,
) {
  const image = await loadCanvasImage(src, "The surface-map image could not be loaded safely. Reload and try again.");
  const frame = mockupFrame(image.naturalWidth, image.naturalHeight);
  const stageWidth = suppliedWidth ?? frame.width, stageHeight = suppliedHeight ?? frame.height;
  const contentWidth = Math.max(1, stageWidth - stagePadding * 2);
  const contentHeight = Math.max(1, stageHeight - stagePadding * 2);
  const scale = Math.min(contentWidth / image.naturalWidth, contentHeight / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const imageLeft = (stageWidth - renderedWidth) / 2;
  const imageTop = (stageHeight - renderedHeight) / 2;
  const areaLeft = (area.x / 100) * stageWidth;
  const areaTop = (area.y / 100) * stageHeight;
  const areaWidth = (area.width / 100) * stageWidth;
  const areaHeight = (area.height / 100) * stageHeight;
  const sourceX = clamp((areaLeft - imageLeft) / scale, 0, image.naturalWidth - 1);
  const sourceY = clamp((areaTop - imageTop) / scale, 0, image.naturalHeight - 1);
  const sourceWidth = clamp(areaWidth / scale, 1, image.naturalWidth - sourceX);
  const sourceHeight = clamp(areaHeight / scale, 1, image.naturalHeight - sourceY);

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Surface-map generation is unavailable in this browser.");
  context.fillStyle = "rgb(128,128,128)";
  context.fillRect(0, 0, size, size);
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size);
  let total = 0;
  let samples = 0;
  for (let index = 0; index < pixels.data.length; index += 4) {
    if (pixels.data[index + 3] < 16) continue;
    total += pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114;
    samples += 1;
  }
  const mean = samples ? total / samples : 128;
  for (let index = 0; index < pixels.data.length; index += 4) {
    const alpha = pixels.data[index + 3];
    const luminance = alpha < 16 ? mean : pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114;
    const normalized = Math.round(clamp(128 + (luminance - mean) * 1.85, 24, 232));
    pixels.data[index] = normalized;
    pixels.data[index + 1] = normalized;
    pixels.data[index + 2] = normalized;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/webp", 0.88);
}
