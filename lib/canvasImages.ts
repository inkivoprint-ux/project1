export function loadCanvasImage(src: string, errorMessage = "The image could not be loaded safely. Reload and try again.") {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    // This MUST precede src: otherwise remote Supabase images taint the canvas.
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(errorMessage));
    image.src = src;
  });
}

export function exportCanvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve, reject) => {
    try { canvas.toBlob(resolve, "image/png", 1); }
    catch (error) {
      if (error instanceof DOMException && error.name === "SecurityError") reject(new Error("The product image could not be exported safely. Reload the page and try again. If this continues, ask Inkivo to check the mockup image access."));
      else reject(error);
    }
  });
}
