// EPS contains filled vector contours only, never embedded bitmap/image operators.
// Trace the rendered text alpha so local fonts and complex-script shaping match.
export function textContoursEps(alpha: Uint8ClampedArray, width: number, height: number, color: string, widthMm: number, heightMm: number) {
  let peak = 0; for (let i=3;i<alpha.length;i+=4) peak = Math.max(peak, alpha[i]);
  if (!peak) throw new Error("The text outline is empty. Increase text opacity before saving.");
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && alpha[(y * width + x) * 4 + 3] >= peak / 2;
  const edges = new Map<string, Array<[number, number]>>();
  const edge = (x: number, y: number, a: number, b: number) => { const key = `${x},${y}`; const next = edges.get(key) ?? []; next.push([a, b]); edges.set(key, next); };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (filled(x,y)) {
    if (!filled(x,y-1)) edge(x,y,x+1,y);
    if (!filled(x+1,y)) edge(x+1,y,x+1,y+1);
    if (!filled(x,y+1)) edge(x+1,y+1,x,y+1);
    if (!filled(x-1,y)) edge(x,y+1,x,y);
  }
  const paths: string[] = [];
  while (edges.size) {
    const start = edges.keys().next().value!; let key = start; const points: Array<[number,number]> = [key.split(',').map(Number) as [number,number]];
    do { const nexts = edges.get(key); if (!nexts?.length) throw new Error('Text outline could not be closed'); const next = nexts.pop()!; if (!nexts.length) edges.delete(key); points.push(next); key = next.join(','); } while (key !== start);
    paths.push(`${points[0][0]} ${points[0][1]} moveto`);
    for (let i=1;i<points.length-1;i++) { const a=points[i-1], b=points[i], c=points[i+1]; if ((b[0]-a[0])*(c[1]-b[1]) !== (b[1]-a[1])*(c[0]-b[0])) paths.push(`${b[0]} ${b[1]} lineto`); }
    paths.push('closepath');
  }
  const w = widthMm * 72 / 25.4, h = heightMm * 72 / 25.4;
  const rgb = /^#[0-9a-f]{6}$/i.test(color) ? [1,3,5].map((i)=>parseInt(color.slice(i,i+2),16)/255) : [0,0,0];
  return `%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 ${Math.ceil(w)} ${Math.ceil(h)}\n%%HiResBoundingBox: 0 0 ${w} ${h}\n%%Title: Inkivo outlined text\n%%EndComments\ngsave\n0 ${h} translate\n${w/width} ${-h/height} scale\n${rgb.join(' ')} setrgbcolor\nnewpath\n${paths.join('\n')}\neofill\ngrestore\n%%EOF\n`;
}

export function assertSafeTextEps(content: string) {
  if (!content.startsWith("%!PS-Adobe-3.0 EPSF-3.0\n") || !content.trimEnd().endsWith("%%EOF")) throw new Error("Invalid text EPS file.");
  for (const line of content.split("\n").slice(1)) {
    if (!line || line.startsWith("%%")) continue;
    if (/^(gsave|grestore|newpath|closepath|eofill)$/.test(line)) continue;
    if (/^(?:-?\d+(?:\.\d+)?(?:e[+-]?\d+)?\s+){2}(translate|scale|moveto|lineto)$/.test(line)) continue;
    if (/^(?:-?\d+(?:\.\d+)?(?:e[+-]?\d+)?\s+){3}setrgbcolor$/.test(line)) continue;
    throw new Error("Text EPS must contain vector paths only.");
  }
}
