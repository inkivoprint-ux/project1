import type { TemplateArea } from "./customization";

export type TextFont = "classic" | "clean" | "playful" | "malayalam";
export type TextSurface = "product" | "normal" | "wrinkled" | "cylindrical";

export function getTextStyle(font: TextFont, bold: boolean | null, italic: boolean | null) {
  return {
    weight: bold === null ? (font === "clean" || font === "playful" ? 700 : 600) : bold ? 700 : 400,
    italic: italic ?? font === "playful",
  };
}

// Override only the text layer; the product mask and photo mapping stay intact.
export function getTextSurfaceOverrides(surface: TextSurface, area: TemplateArea): Partial<TemplateArea> & { surfaceShading?: boolean } {
  if (surface === "product") return {};
  const common = { perspective: 0, taper: 0, opacity: 1, blendMode: "normal" as const };
  if (surface === "normal") return { ...common, surface: "flat", curvature: 0, precisionWrap: false, edgeFade: 0, surfaceShading: false };
  if (surface === "wrinkled") return {
    ...common, surface: "fabric", curvature: area.surface === "fabric" ? area.curvature : 58,
    precisionWrap: false, edgeFade: 0,
    surfaceMap: area.surface === "fabric" ? area.surfaceMap : undefined,
    displacementStrength: area.surface === "fabric" ? area.displacementStrength : 55,
    fabricBlendStrength: area.surface === "fabric" ? area.fabricBlendStrength : 48,
    fabricTextureStrength: area.surface === "fabric" ? area.fabricTextureStrength : 18,
  };
  const cylindrical = area.surface === "cylinder" || area.surface === "tapered-cylinder";
  return { ...common, surface: "cylinder", curvature: 72, precisionWrap: true, wrapAngle: cylindrical ? area.wrapAngle ?? 110 : 110, edgeFade: cylindrical ? area.edgeFade ?? 8 : 8 };
}
