import { describe, expect, it } from "vitest";
import { fitMockupFrame, mockupFrame } from "./mockupGeometry";

describe("one template coordinate plane across devices", () => {
  it.each([[1024, 1536], [770, 770], [1600, 900]])("preserves product and print-area proportions for %sx%s images", (imageWidth, imageHeight) => {
    const desktop = fitMockupFrame(772, 710, imageWidth, imageHeight);
    const mobile = fitMockupFrame(375, 470, imageWidth, imageHeight);
    expect(desktop.width / desktop.height).toBeCloseTo(imageWidth / imageHeight);
    expect(mobile.width / mobile.height).toBeCloseTo(imageWidth / imageHeight);
    const relativePrintRatio = (frame: typeof desktop) => (frame.width * 0.10936) / (frame.height * 0.34530);
    expect(relativePrintRatio(desktop)).toBeCloseTo(relativePrintRatio(mobile), 8);
    expect(desktop.padding / desktop.width).toBeCloseTo(mobile.padding / mobile.width, 8);
  });

  it("scales uniformly when only the available panel height changes", () => {
    const large = fitMockupFrame(900, 750, 1024, 1536), small = fitMockupFrame(900, 375, 1024, 1536);
    expect(small.width).toBeCloseTo(large.width / 2);
    expect(small.height).toBeCloseTo(large.height / 2);
    expect(small.padding).toBeCloseTo(large.padding / 2);
  });

  it("uses the same image reference for detection, surface maps and display", () => {
    expect(mockupFrame(770, 770)).toEqual({ width: 1024, height: 1024 });
    expect(mockupFrame(1024, 1536)).toEqual({ width: 1024, height: 1536 });
  });

  it("rejects invalid intrinsic dimensions and handles an unmeasured panel", () => {
    expect(() => mockupFrame(0, 100)).toThrow("dimensions");
    expect(() => mockupFrame(100, Number.NaN)).toThrow("dimensions");
    expect(fitMockupFrame(0, 0, 100, 100)).toEqual({ width: 0, height: 0, padding: 0 });
  });
});
