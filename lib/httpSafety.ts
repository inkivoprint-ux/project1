export const MAX_JSON_BYTES = 3_800_000;
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new Error("This request must come from the Inkivo website.");
}
export async function readLimitedBody(request: Request, limit = MAX_JSON_BYTES) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body is missing.");
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw new Error("The request is too large. Use smaller images."); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.byteLength; });
    return bytes;
  } finally { reader.releaseLock(); }
}
export async function readLimitedJson(request: Request, limit = MAX_JSON_BYTES): Promise<unknown> {
  return JSON.parse(new TextDecoder().decode(await readLimitedBody(request, limit)));
}
