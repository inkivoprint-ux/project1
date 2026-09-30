import { afterEach, describe, expect, it, vi } from "vitest";
import { exportCanvasBlob, loadCanvasImage } from "./canvasImages";

afterEach(() => vi.unstubAllGlobals());

describe("export-safe image loading", () => {
  it("sets anonymous CORS before requesting an image and reports denied access", async () => {
    const events: string[] = [];
    class ImageProbe {
      onerror?: () => void;
      set crossOrigin(value: string) { events.push(`cors:${value}`); }
      set src(value: string) { events.push(`src:${value}`); queueMicrotask(() => this.onerror?.()); }
    }
    vi.stubGlobal("Image", ImageProbe);
    await expect(loadCanvasImage("/products/bamboo-travel-mug.png")).rejects.toThrow("safely");
    expect(events).toEqual(["cors:anonymous", "src:/products/bamboo-travel-mug.png"]);
  });

  it("turns canvas security exceptions into an actionable error, never success", async () => {
    const canvas = { toBlob() { throw new DOMException("Tainted canvas", "SecurityError"); } } as unknown as HTMLCanvasElement;
    await expect(exportCanvasBlob(canvas)).rejects.toThrow("mockup image access");
  });

  it("does not conceal unrelated export failures", async () => {
    const failure = new Error("Canvas allocation failed");
    const canvas = { toBlob() { throw failure; } } as unknown as HTMLCanvasElement;
    await expect(exportCanvasBlob(canvas)).rejects.toBe(failure);
  });
});
