export function canvasBlendOperation(mode: string | null | undefined): GlobalCompositeOperation {
  return mode === "multiply" || mode === "screen" || mode === "overlay" ? mode : "source-over";
}
