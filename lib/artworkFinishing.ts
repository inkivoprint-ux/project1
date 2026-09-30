import type { MaskPoint, MaskShape } from "./customization";
import { getMaskPolygon } from "./maskShapes";

export function projectArtworkColumn(x: number, width: number, angle: number, distance: number) {
  const radians = angle * Math.PI / 180;
  const relative = x - width / 2;
  const factor = distance / (distance + relative * Math.sin(radians));
  return { x: width / 2 + relative * Math.cos(radians) * factor, factor };
}

export function finishArtwork(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, settings: { opacity: number; perspective: number; maskRadius: number; maskShape: MaskShape; maskPoints: MaskPoint[] }) {
  const { width, height } = canvas;
  if (settings.perspective !== 0) {
    const source = document.createElement("canvas"); source.width = width; source.height = height;
    const sourceContext = source.getContext("2d");
    if (!sourceContext) throw new Error("Perspective rendering is unavailable.");
    sourceContext.drawImage(canvas, 0, 0);
    context.clearRect(0, 0, width, height);
    const distance = 700 * width / Math.max(1, canvas.clientWidth || width);
    const step = Math.max(1, Math.round(width / 560));
    for (let x = 0; x < width; x += step) {
      const left = projectArtworkColumn(x, width, settings.perspective, distance);
      const right = projectArtworkColumn(Math.min(width, x + step), width, settings.perspective, distance);
      context.drawImage(source, x, 0, Math.min(step + 1, width - x), height, left.x, height * (1 - left.factor) / 2, right.x - left.x + 1, height * left.factor);
    }
  }
  context.save();
  context.globalCompositeOperation = "destination-in";
  context.globalAlpha = Math.min(1, Math.max(0, settings.opacity));
  context.beginPath();
  const polygon = getMaskPolygon(settings.maskShape, settings.maskPoints);
  if (settings.maskShape === "ellipse") context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  else if (polygon) {
    polygon.forEach((point, index) => { if (index === 0) context.moveTo(point.x * width / 100, point.y * height / 100); else context.lineTo(point.x * width / 100, point.y * height / 100); });
    context.closePath();
  } else context.roundRect(0, 0, width, height, { x: Math.min(50, Math.max(0, settings.maskRadius)) * width / 100, y: Math.min(50, Math.max(0, settings.maskRadius)) * height / 100 });
  context.fillStyle = "#000";
  context.fill();
  context.restore();
}
