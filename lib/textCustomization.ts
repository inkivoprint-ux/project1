import type { TemplateArea } from "./customization";

export type TextFont = "classic" | "clean" | "playful" | "malayalam" | "manjari" | "chilanka" | "gayathri" | "baloo-malayalam" | "noto-serif-malayalam";
export type TextSurface = "product" | "normal" | "wrinkled" | "cylindrical";

export function getTextStyle(font: TextFont, bold: boolean | null, italic: boolean | null) {
  return {
    weight: bold === null ? (font === "clean" || font === "playful" ? 700 : 600) : bold ? 700 : 400,
    italic: italic ?? font === "playful",
  };
}

export type TextDeformation = {
  wrinkleIntensity: number;
  cylindricalIntensity: number;
  horizontalCurvature: number;
  verticalDeformation: number;
  perspective: number;
};
export const DEFAULT_TEXT_DEFORMATION: TextDeformation = {
  wrinkleIntensity: 55, cylindricalIntensity: 100, horizontalCurvature: 65,
  verticalDeformation: 35, perspective: 0,
};
const bounded = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

// Override only the text layer; the product mask and photo mapping stay intact.
export function getTextSurfaceOverrides(surface: TextSurface, area: TemplateArea, settings?: TextDeformation): Partial<TemplateArea> & { surfaceShading?: boolean; deformationIntensity?: number; verticalDeformation?: number } {
  if (surface === "product") return {};
  const common = { perspective: 0, taper: 0, opacity: 1, blendMode: "normal" as const };
  if (surface === "normal") return { ...common, surface: "flat", curvature: 0, precisionWrap: false, edgeFade: 0, surfaceShading: false };
  if (surface === "wrinkled" && settings) {
    const intensity = bounded(settings.wrinkleIntensity);
    if (intensity === 0) return getTextSurfaceOverrides("normal", area);
    return {
      ...common, surface: "fabric", precisionWrap: false, edgeFade: 0,
      surfaceMap: area.surfaceMap, curvature: intensity, displacementStrength: intensity,
      fabricBlendStrength: (area.surface === "fabric" ? area.fabricBlendStrength ?? 48 : 48) * intensity / 100,
      fabricTextureStrength: (area.surface === "fabric" ? area.fabricTextureStrength ?? 18 : 18) * intensity / 100,
      deformationIntensity: intensity / 100,
    };
  }
  if (surface === "wrinkled") return {
    ...common, surface: "fabric", curvature: area.surface === "fabric" ? area.curvature : 58,
    precisionWrap: false, edgeFade: 0,
    surfaceMap: area.surface === "fabric" ? area.surfaceMap : undefined,
    displacementStrength: area.surface === "fabric" ? area.displacementStrength : 55,
    fabricBlendStrength: area.surface === "fabric" ? area.fabricBlendStrength : 48,
    fabricTextureStrength: area.surface === "fabric" ? area.fabricTextureStrength : 18,
  };
  if (surface === "cylindrical" && settings) {
    const intensity = bounded(settings.cylindricalIntensity) / 100;
    if (intensity === 0) return getTextSurfaceOverrides("normal", area);
    return {
      ...common, surface: "cylinder", precisionWrap: true,
      curvature: bounded(settings.horizontalCurvature) * intensity,
      wrapAngle: bounded(settings.horizontalCurvature) * 1.7,
      edgeFade: 0, deformationIntensity: intensity,
      verticalDeformation: bounded(settings.verticalDeformation) * intensity,
      perspective: bounded(settings.perspective, -35, 35) * intensity,
    };
  }
  const cylindrical = area.surface === "cylinder" || area.surface === "tapered-cylinder";
  return { ...common, surface: "cylinder", curvature: 72, precisionWrap: true, wrapAngle: cylindrical ? area.wrapAngle ?? 110 : 110, edgeFade: cylindrical ? area.edgeFade ?? 8 : 8 };
}
