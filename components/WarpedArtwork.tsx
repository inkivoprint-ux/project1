"use client";

import { useEffect, useRef, useState } from "react";
import { type BlendMode, type MaskPoint, type MaskShape, type SurfaceType } from "@/lib/customization";
import { adjustArtworkPixels } from "@/lib/artworkColor";
import { finishArtwork } from "@/lib/artworkFinishing";
import { calculateRenderSize, containImageSize } from "@/lib/renderQuality";
import { loadCanvasImage } from "@/lib/canvasImages";
import { curvedSourcePosition, surfaceCurveAngle, surfaceRowScale } from "@/lib/surfaceGeometry";

type Props = {
  src: string | null;
  alt?: string;
  curvature: number;
  perspective: number;
  taper: number;
  opacity: number;
  blendMode: BlendMode;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  maskRadius: number;
  maskShape?: MaskShape;
  maskPoints?: MaskPoint[];
  surface: SurfaceType;
  precisionWrap?: boolean;
  wrapAngle?: number;
  edgeFade?: number;
  surfaceMap?: string;
  displacementStrength?: number;
  fabricBlendStrength?: number;
  fabricTextureStrength?: number;
  surfaceShading?: boolean;
  deformationIntensity?: number;
  verticalDeformation?: number;
  artworkOpacity?: number;
  onRenderStateChange?: (state: "rendering" | "ready" | "error") => void;
  scale?: number;
  imageRotation?: number;
  offsetX?: number;
  offsetY?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const EMPTY_MASK_POINTS: MaskPoint[] = [];

export function WarpedArtwork({
  src, curvature, perspective, taper, opacity, blendMode, maskRadius, maskShape = "rectangle", maskPoints = EMPTY_MASK_POINTS, surface,
  precisionWrap = false, wrapAngle = 110, edgeFade = 0, surfaceMap,
  displacementStrength = 55, fabricBlendStrength = 48, fabricTextureStrength = 18,
  brightness = 100, contrast = 100, saturation = 100,
  deformationIntensity, verticalDeformation,
  surfaceShading = true, artworkOpacity = 1, onRenderStateChange,
  scale = 1, imageRotation = 0, offsetX = 0, offsetY = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCache = useRef(new Map<string, Promise<HTMLImageElement>>());
  const [renderSize, setRenderSize] = useState({ width: 560, height: 560 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return;
      const next = calculateRenderSize(bounds.width, bounds.height, window.devicePixelRatio || 1);
      setRenderSize((current) => current.width === next.width && current.height === next.height ? current : next);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) { onRenderStateChange?.("error"); return; }
    const { width, height } = renderSize;
    canvas.width = width;
    canvas.height = height;
    enableHighQuality(context);
    context.clearRect(0, 0, width, height);
    onRenderStateChange?.("rendering");
    if (!src) return;
    let cancelled = false;

    const cachedImage = (url: string) => {
      let pending = imageCache.current.get(url);
      if (!pending) {
        pending = loadCanvasImage(url);
        imageCache.current.set(url, pending);
        pending.catch(() => imageCache.current.delete(url));
      }
      return pending;
    };
    // Keep only this layer's source and map, avoiding repeated image decoding on slider input.
    for (const key of imageCache.current.keys()) if (key !== src && key !== surfaceMap) imageCache.current.delete(key);
    Promise.all([
      cachedImage(src),
      surface === "fabric" && surfaceMap ? cachedImage(surfaceMap).catch(() => null) : Promise.resolve(null),
    ]).then(([image, mapImage]) => {
      if (cancelled) return;
      const work = document.createElement("canvas");
      work.width = width;
      work.height = height;
      const workContext = work.getContext("2d", { willReadFrequently: true });
      if (!workContext) { onRenderStateChange?.("error"); return; }
      enableHighQuality(workContext);
      workContext.save();
      const offsetUnit = Math.min(width, height) / 300;
      workContext.translate(width / 2 + offsetX * offsetUnit, height / 2 + offsetY * offsetUnit);
      workContext.rotate((imageRotation * Math.PI) / 180);
      workContext.scale(scale, scale);
      const fitted = containImageSize(image.naturalWidth || image.width, image.naturalHeight || image.height, width, height);
      const drawWidth = fitted.width;
      const drawHeight = fitted.height;
      workContext.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      workContext.restore();
      if (brightness !== 100 || contrast !== 100 || saturation !== 100) {
        const pixels = workContext.getImageData(0, 0, width, height);
        adjustArtworkPixels(pixels.data, { brightness, contrast, saturation });
        workContext.putImageData(pixels, 0, 0);
      }
      context.clearRect(0, 0, width, height);

      if (surface === "flat") context.drawImage(work, 0, 0);
      else if (surface === "fabric") {
        if (mapImage) renderMappedFabric(context, work, mapImage, width, height, displacementStrength, fabricBlendStrength, deformationIntensity);
        else renderProceduralFabric(context, work, width, height, curvature, fabricBlendStrength, deformationIntensity);
        applyFabricTexture(context, width, height, fabricTextureStrength);
      } else renderCurvedSurface(context, work, width, height, surface, curvature, taper, precisionWrap, wrapAngle, edgeFade, deformationIntensity, verticalDeformation);

      if (surface !== "fabric" && surfaceShading) applySurfaceShade(context, width, height, curvature);
      // Masks, perspective and opacity must be pixels, not preview-only CSS.
      finishArtwork(context, canvas, { opacity: opacity * artworkOpacity, perspective, maskRadius, maskShape, maskPoints });
      onRenderStateChange?.("ready");
    }).catch(() => {
      if (!cancelled) { context.clearRect(0, 0, width, height); onRenderStateChange?.("error"); }
    });
    return () => { cancelled = true; };
  }, [src, curvature, taper, scale, imageRotation, offsetX, offsetY, surface, precisionWrap, wrapAngle, edgeFade, surfaceMap, displacementStrength, fabricBlendStrength, fabricTextureStrength, brightness, contrast, saturation, surfaceShading, deformationIntensity, verticalDeformation, artworkOpacity, opacity, perspective, maskRadius, maskShape, maskPoints, onRenderStateChange, renderSize]);

  // Blend the enclosing positioned layer against the photograph, not inside an
  // isolated stacking context. Exports use the same mode from this metadata.
  return <canvas ref={canvasRef} className="warped-artwork" aria-label="Warped artwork preview" data-blend-mode={blendMode} />;
}

function renderMappedFabric(context: CanvasRenderingContext2D, work: HTMLCanvasElement, mapImage: HTMLImageElement, width: number, height: number, displacementStrength: number, fabricBlendStrength: number, deformationIntensity?: number) {
  const sourceContext = work.getContext("2d", { willReadFrequently: true });
  const mapCanvas = document.createElement("canvas");
  mapCanvas.width = width;
  mapCanvas.height = height;
  const mapContext = mapCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext || !mapContext) return;
  enableHighQuality(mapContext);
  mapContext.fillStyle = "rgb(128,128,128)";
  mapContext.fillRect(0, 0, width, height);
  mapContext.drawImage(mapImage, 0, 0, width, height);
  const source = sourceContext.getImageData(0, 0, width, height);
  const map = mapContext.getImageData(0, 0, width, height);
  const output = context.createImageData(width, height);
  const shadowMask = context.createImageData(width, height);
  const highlightMask = context.createImageData(width, height);
  const resolutionScale = Math.min(width, height) / 560;
  const strength = (deformationIntensity === undefined ? 2 + clamp(displacementStrength, 0, 100) / 100 * 18 : clamp(displacementStrength, 0, 100) / 100 * 20) * resolutionScale;
  const luminanceAt = (x: number, y: number) => {
    const index = (clamp(y, 0, height - 1) * width + clamp(x, 0, width - 1)) * 4;
    return map.data[index] * 0.299 + map.data[index + 1] * 0.587 + map.data[index + 2] * 0.114;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const luminance = luminanceAt(x, y);
      const gradientX = (luminanceAt(x + 2, y) - luminanceAt(x - 2, y)) / 255;
      const gradientY = (luminanceAt(x, y + 2) - luminanceAt(x, y - 2)) / 255;
      const heightOffset = (luminance - 128) / 128;
      const sourceX = clamp(x + gradientX * strength + heightOffset * strength * 0.26, 0, width - 1);
      const sourceY = clamp(y + gradientY * strength * 0.62, 0, height - 1);
      const x0 = Math.floor(sourceX);
      const y0 = Math.floor(sourceY);
      const x1 = Math.min(width - 1, x0 + 1);
      const y1 = Math.min(height - 1, y0 + 1);
      const tx = sourceX - x0;
      const ty = sourceY - y0;
      const targetIndex = (y * width + x) * 4;
      const shade = 1 + (clamp(0.96 + ((luminance - 128) / 128) * 0.08 + (gradientX - gradientY) * 0.04, 0.88, 1.1) - 1) * (deformationIntensity === undefined ? 1 : clamp(fabricBlendStrength, 0, 100) / 100);
      for (let channel = 0; channel < 4; channel += 1) {
        const top = source.data[(y0 * width + x0) * 4 + channel] * (1 - tx) + source.data[(y0 * width + x1) * 4 + channel] * tx;
        const bottom = source.data[(y1 * width + x0) * 4 + channel] * (1 - tx) + source.data[(y1 * width + x1) * 4 + channel] * tx;
        const value = top * (1 - ty) + bottom * ty;
        output.data[targetIndex + channel] = channel === 3 ? value : clamp(value * shade, 0, 255);
      }
      const shadow = Math.round(255 - clamp(128 - luminance, 0, 112) * 1.75);
      const highlight = Math.round(clamp(luminance - 128, 0, 112) * 1.75);
      shadowMask.data[targetIndex] = shadow;
      shadowMask.data[targetIndex + 1] = shadow;
      shadowMask.data[targetIndex + 2] = shadow;
      shadowMask.data[targetIndex + 3] = output.data[targetIndex + 3];
      highlightMask.data[targetIndex] = highlight;
      highlightMask.data[targetIndex + 1] = highlight;
      highlightMask.data[targetIndex + 2] = highlight;
      highlightMask.data[targetIndex + 3] = output.data[targetIndex + 3];
    }
  }
  context.putImageData(output, 0, 0);
  applyFabricLighting(context, shadowMask, highlightMask, width, height, fabricBlendStrength);
}

function renderProceduralFabric(context: CanvasRenderingContext2D, work: HTMLCanvasElement, width: number, height: number, curvature: number, fabricBlendStrength: number, deformationIntensity?: number) {
  const wrinkleStrength = (deformationIntensity === undefined ? 3 + curvature / 100 * 15 : clamp(curvature, 0, 100) / 100 * 18) * (Math.min(width, height) / 560);
  const rowStep = Math.max(1, Math.round(height / 420));
  for (let destinationY = 0; destinationY < height; destinationY += rowStep) {
    const vertical = destinationY / height;
    const displacement = Math.sin(vertical * Math.PI * 3.2 + 0.4) * wrinkleStrength + Math.sin(vertical * Math.PI * 11.7) * wrinkleStrength * 0.22 + Math.sin(vertical * Math.PI) * Math.sin(vertical * Math.PI * 5.1) * wrinkleStrength * 0.45;
    context.drawImage(work, 0, destinationY, width, rowStep + 1, displacement, destinationY, width - Math.abs(displacement) * 0.6, rowStep + 1);
  }
  context.globalCompositeOperation = "source-atop";
  context.globalAlpha = deformationIntensity === undefined ? 0.35 + clamp(fabricBlendStrength, 0, 100) / 100 * 0.65 : clamp(fabricBlendStrength, 0, 100) / 100;
  const light = context.createLinearGradient(0, 0, width, height);
  light.addColorStop(0, "rgba(255,255,255,0.11)");
  light.addColorStop(0.28, "rgba(0,0,0,0.09)");
  light.addColorStop(0.52, "rgba(255,255,255,0.13)");
  light.addColorStop(0.74, "rgba(0,0,0,0.12)");
  light.addColorStop(1, "rgba(255,255,255,0.06)");
  context.fillStyle = light;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
}

function applyFabricLighting(context: CanvasRenderingContext2D, shadowMask: ImageData, highlightMask: ImageData, width: number, height: number, strength: number) {
  const amount = clamp(strength, 0, 100) / 100;
  if (amount <= 0) return;
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = width;
  shadowCanvas.height = height;
  shadowCanvas.getContext("2d")?.putImageData(shadowMask, 0, 0);
  const highlightCanvas = document.createElement("canvas");
  highlightCanvas.width = width;
  highlightCanvas.height = height;
  highlightCanvas.getContext("2d")?.putImageData(highlightMask, 0, 0);
  context.save();
  context.globalCompositeOperation = "multiply";
  context.globalAlpha = amount * 0.42;
  context.drawImage(shadowCanvas, 0, 0);
  context.globalCompositeOperation = "screen";
  context.globalAlpha = amount * 0.25;
  context.drawImage(highlightCanvas, 0, 0);
  context.restore();
}

function applyFabricTexture(context: CanvasRenderingContext2D, width: number, height: number, strength: number) {
  context.globalCompositeOperation = "source-atop";
  context.globalAlpha = (clamp(strength, 0, 100) / 100) * 0.1;
  context.fillStyle = context.createPattern(makeFabricTexture(), "repeat") || "transparent";
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
}

function renderCurvedSurface(context: CanvasRenderingContext2D, work: HTMLCanvasElement, width: number, height: number, surface: SurfaceType, curvature: number, taper: number, precisionWrap: boolean, wrapAngle: number, edgeFade: number, deformationIntensity?: number, verticalDeformation?: number) {
  const curve = clamp(curvature, 0, 100) / 100;
  const cylindrical = surface === "cylinder" || surface === "tapered-cylinder";
  const amount = deformationIntensity === undefined ? 1 : clamp(deformationIntensity, 0, 1);
  const maxAngle = surfaceCurveAngle(surface, curvature, precisionWrap, wrapAngle, deformationIntensity);
  const mapped = document.createElement("canvas");
  mapped.width = width;
  mapped.height = height;
  const mappedContext = mapped.getContext("2d");
  if (!mappedContext) return;
  enableHighQuality(mappedContext);
  const columnStep = Math.max(1, Math.round(width / 420));
  if (maxAngle === 0 && !verticalDeformation) mappedContext.drawImage(work, 0, 0);
  else for (let destinationX = 0; destinationX < width; destinationX += columnStep) {
    const normalized = (destinationX / width) * 2 - 1;
    const sourceNormalized = curvedSourcePosition(normalized, maxAngle);
    const sourceX = ((sourceNormalized + 1) / 2) * width;
    const edge = Math.abs(normalized);
    const bowStrength = verticalDeformation === undefined ? (precisionWrap && cylindrical ? maxAngle / 1.35 : curve) : clamp(verticalDeformation, 0, 100) / 100 * 2;
    const bow = bowStrength * edge * edge * 19 * (height / 560);
    mappedContext.drawImage(work, sourceX, 0, columnStep + 1, height, destinationX, bow, columnStep + 1, height - bow * 2);
  }
  if ((surface === "tapered-cylinder" || surface === "custom-mask") && taper !== 0) {
    const rowStep = Math.max(1, Math.round(height / 420));
    for (let destinationY = 0; destinationY < height; destinationY += rowStep) {
      const rowScale = surfaceRowScale(surface, taper, destinationY / height);
      const rowWidth = width * rowScale;
      context.drawImage(mapped, 0, destinationY, width, rowStep + 1, (width - rowWidth) / 2, destinationY, rowWidth, rowStep + 1);
    }
  } else context.drawImage(mapped, 0, 0);

  if (precisionWrap && cylindrical) {
    context.globalCompositeOperation = "source-atop";
    const light = context.createLinearGradient(0, 0, width, 0);
    const ratio = Math.min(1, maxAngle / (Math.PI / 2));
    light.addColorStop(0, `rgba(0,0,0,${0.42 * ratio})`);
    light.addColorStop(0.2, `rgba(0,0,0,${0.13 * ratio})`);
    light.addColorStop(0.46, `rgba(255,255,255,${0.11 * amount})`);
    light.addColorStop(0.62, `rgba(255,255,255,${0.03 * amount})`);
    light.addColorStop(0.82, `rgba(0,0,0,${0.12 * ratio})`);
    light.addColorStop(1, `rgba(0,0,0,${0.44 * ratio})`);
    context.fillStyle = light;
    context.fillRect(0, 0, width, height);
    if (edgeFade > 0) {
      const fade = clamp(edgeFade, 0, 24) / 100;
      context.globalCompositeOperation = "destination-in";
      const mask = context.createLinearGradient(0, 0, width, 0);
      mask.addColorStop(0, "rgba(0,0,0,0.3)");
      mask.addColorStop(fade, "rgba(0,0,0,1)");
      mask.addColorStop(1 - fade, "rgba(0,0,0,1)");
      mask.addColorStop(1, "rgba(0,0,0,0.3)");
      context.fillStyle = mask;
      context.fillRect(0, 0, width, height);
    }
    context.globalCompositeOperation = "source-over";
  }
}

function applySurfaceShade(context: CanvasRenderingContext2D, width: number, height: number, curvature: number) {
  context.globalCompositeOperation = "source-atop";
  const shade = context.createLinearGradient(0, 0, width, 0);
  const strength = Math.max(0.08, curvature / 170);
  shade.addColorStop(0, `rgba(0,0,0,${strength})`);
  shade.addColorStop(0.18, "rgba(255,255,255,0.02)");
  shade.addColorStop(0.5, `rgba(255,255,255,${strength * 0.35})`);
  shade.addColorStop(0.82, "rgba(255,255,255,0.02)");
  shade.addColorStop(1, `rgba(0,0,0,${strength})`);
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "source-over";
}

function makeFabricTexture() {
  const texture = document.createElement("canvas");
  texture.width = 12;
  texture.height = 12;
  const context = texture.getContext("2d");
  if (context) {
    context.strokeStyle = "rgba(255,255,255,.45)";
    context.lineWidth = 0.45;
    context.beginPath(); context.moveTo(0, 1); context.lineTo(12, 11); context.stroke();
    context.strokeStyle = "rgba(0,0,0,.32)";
    context.beginPath(); context.moveTo(0, 11); context.lineTo(12, 1); context.stroke();
  }
  return texture;
}

function enableHighQuality(context: CanvasRenderingContext2D) {
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
}
