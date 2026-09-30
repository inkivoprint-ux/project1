import type { SurfaceType, TemplateArea } from "./customization";

export function changeTemplateSurface(area: TemplateArea, surface: SurfaceType, fallbackDiameter = 75): TemplateArea {
  const cylindrical = surface === "cylinder" || surface === "tapered-cylinder";
  const diameterMm = area.diameterMm ?? fallbackDiameter;
  let maskShape = area.maskShape;
  if (surface === "tapered-cylinder" && (!maskShape || maskShape === "rectangle" || maskShape === "tapered")) maskShape = "tapered";
  else if (surface !== "tapered-cylinder" && maskShape === "tapered") maskShape = "rectangle";
  return {
    ...area, surface, maskShape,
    taper: surface === "tapered-cylinder" ? area.taper || 12 : 0,
    curvature: surface === "flat" ? 0 : area.curvature || (surface === "fabric" ? 58 : 72),
    perspective: surface === "flat" ? 0 : area.perspective,
    precisionWrap: cylindrical,
    diameterMm: cylindrical ? diameterMm : area.diameterMm,
    wrapAngle: cylindrical ? Math.round(Math.min(170, Math.max(30, area.widthMm / (Math.PI * Math.max(1, diameterMm)) * 360))) : area.wrapAngle,
    displacementStrength: surface === "fabric" ? area.displacementStrength || 62 : area.displacementStrength,
    fabricBlendStrength: surface === "fabric" ? area.fabricBlendStrength || 48 : area.fabricBlendStrength,
    fabricTextureStrength: surface === "fabric" ? area.fabricTextureStrength || 18 : area.fabricTextureStrength,
  };
}
