import { describe, expect, it } from "vitest";
import { canvasBlendOperation } from "./artworkBlend";

describe("preview export blend modes", () => {
  it.each(["multiply", "screen", "overlay"] as const)("maps %s to the matching canvas operation", (mode) => {
    expect(canvasBlendOperation(mode)).toBe(mode);
  });
  it.each(["normal", "", null, undefined, "unsupported"])("falls back safely for %s", (mode) => {
    expect(canvasBlendOperation(mode)).toBe("source-over");
  });
});
