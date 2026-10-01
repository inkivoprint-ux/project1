export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const IMAGE_UPLOAD_HINT = "JPG/JPEG, PNG or WebP · maximum 5 MB per image";
export function validateImageUpload(file: Pick<File, "type" | "size">) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPG/JPEG, PNG or WebP image.");
  if (!file.size || file.size > MAX_IMAGE_UPLOAD_BYTES) throw new Error("Each image must be 5 MB or smaller.");
}

// Catalogue photos are display assets; keep their encoded JSON comfortably small.
export async function prepareProductPhoto(file: File) {
  validateImageUpload(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("The product image could not be read.")); image.src = url; });
    const canvas = document.createElement("canvas");
    let dimension = 1600;
    for (;;) {
      const scale = Math.min(1, dimension / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d"); if (!context) throw new Error("Image processing is unavailable.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL("image/webp", .9);
      if (result.length < 3_000_000) return result;
      if (dimension <= 400) throw new Error("The product photo could not be prepared.");
      dimension = Math.round(dimension * .75);
    }
  } finally { URL.revokeObjectURL(url); }
}
