import { describe, expect, it } from "vitest";
import { createDefaultTemplate, type SurfaceType } from "./customization";
import { products } from "./products";
import { changeTemplateSurface } from "./templateSurface";

const original = createDefaultTemplate(products[0]).area;
describe("reversible template surface switching", () => {
  it.each<SurfaceType>(["cylinder", "flat", "perspective", "fabric", "custom-mask"])("can leave tapered cylinder for %s without resetting", (surface) => {
    const tapered = changeTemplateSurface(original, "tapered-cylinder");
    expect(tapered).toMatchObject({ taper: 12, maskShape: "tapered" });
    const changed = changeTemplateSurface(tapered, surface);
    expect(changed).toMatchObject({ surface, taper: 0, maskShape: "rectangle", x: original.x, y: original.y, width: original.width, height: original.height, opacity: original.opacity });
    expect(changed.precisionWrap).toBe(surface === "cylinder");
  });

  it("keeps deliberately selected shapes, artwork fit and physical settings", () => {
    const shaped = { ...original, maskShape: "heart" as const, defaultArtworkScale: 1.9, defaultArtworkOffsetX: 57 };
    const cycled = changeTemplateSurface(changeTemplateSurface(shaped, "tapered-cylinder"), "flat");
    expect(cycled).toMatchObject({ maskShape: "heart", defaultArtworkScale: 1.9, defaultArtworkOffsetX: 57, widthMm: original.widthMm, heightMm: original.heightMm });
  });

  it("can cycle flat, cylinder, tapered and cylinder repeatedly", () => {
    let area = original;
    for (const surface of ["tapered-cylinder", "flat", "cylinder", "tapered-cylinder", "cylinder"] as const) area = changeTemplateSurface(area, surface);
    expect(area).toMatchObject({ surface: "cylinder", maskShape: "rectangle", taper: 0, precisionWrap: true });
    expect(area.curvature).toBeGreaterThan(0);
  });
});
