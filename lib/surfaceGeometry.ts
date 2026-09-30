import type { SurfaceType } from "./customization";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function surfaceCurveAngle(surface: SurfaceType, curvature: number, precisionWrap: boolean, wrapAngle: number) {
  const cylindrical = surface === "cylinder" || surface === "tapered-cylinder";
  if (precisionWrap && cylindrical) return clamp(wrapAngle, 30, 170) * Math.PI / 360;
  const curve = clamp(curvature, 0, 100) / 100;
  // A custom mask with zero curvature must retain straight artwork.
  return surface === "custom-mask" ? curve * 1.3 : 0.15 + curve * 1.15;
}

export function curvedSourcePosition(normalized: number, maxAngle: number) {
  if (maxAngle === 0) return normalized;
  return Math.asin(clamp(normalized * Math.sin(maxAngle), -1, 1)) / maxAngle;
}

export function surfaceRowScale(surface: SurfaceType, taper: number, vertical: number) {
  if (surface !== "tapered-cylinder" && surface !== "custom-mask") return 1;
  return 1 + clamp(taper, -50, 50) / 100 * (vertical - 0.5) * 0.32;
}
