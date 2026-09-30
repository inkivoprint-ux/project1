export type MaskPoint = { x: number; y: number };
export const MASK_PRESETS = [
  { id: "rectangle", label: "Rectangle" }, { id: "ellipse", label: "Ellipse" },
  { id: "tapered", label: "Tapered" }, { id: "triangle", label: "Triangle" },
  { id: "diamond", label: "Diamond" }, { id: "heart", label: "Heart" },
  { id: "star", label: "Star" }, { id: "hexagon", label: "Hexagon" },
  { id: "octagon", label: "Octagon" }, { id: "shield", label: "Shield" },
  { id: "ticket", label: "Ticket" }, { id: "speech-bubble", label: "Speech bubble" },
  { id: "arrow", label: "Arrow" },
] as const;
export type MaskShape = typeof MASK_PRESETS[number]["id"] | "custom";
export const isMaskShape = (value: unknown): value is MaskShape => value === "custom" || MASK_PRESETS.some((shape) => shape.id === value);

const points = (pairs: number[][]): MaskPoint[] => pairs.map(([x, y]) => ({ x, y }));
const polygons: Partial<Record<MaskShape, MaskPoint[]>> = {
  tapered: points([[0,0],[100,0],[92,100],[8,100]]),
  triangle: points([[50,0],[100,100],[0,100]]),
  diamond: points([[50,0],[100,50],[50,100],[0,50]]),
  hexagon: points([[25,0],[75,0],[100,50],[75,100],[25,100],[0,50]]),
  octagon: points([[30,0],[70,0],[100,30],[100,70],[70,100],[30,100],[0,70],[0,30]]),
  shield: points([[0,0],[100,0],[100,55],[90,75],[70,92],[50,100],[30,92],[10,75],[0,55]]),
  ticket: points([[0,0],[100,0],[100,30],[93,35],[90,50],[93,65],[100,70],[100,100],[0,100],[0,70],[7,65],[10,50],[7,35],[0,30]]),
  "speech-bubble": points([[0,0],[100,0],[100,78],[55,78],[30,100],[30,78],[0,78]]),
  arrow: points([[0,25],[60,25],[60,0],[100,50],[60,100],[60,75],[0,75]]),
};
polygons.star = Array.from({ length: 10 }, (_, index) => {
  const angle = index * Math.PI / 5 - Math.PI / 2;
  const radius = index % 2 === 0 ? 50 : 22;
  return { x: Number((50 + Math.cos(angle) * radius).toFixed(2)), y: Number((50 + Math.sin(angle) * radius).toFixed(2)) };
});
const heart = Array.from({ length: 80 }, (_, index) => {
  const t = index * Math.PI * 2 / 80;
  return { x: 16 * Math.sin(t) ** 3, y: -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) };
});
const minX = Math.min(...heart.map((point) => point.x)), maxX = Math.max(...heart.map((point) => point.x));
const minY = Math.min(...heart.map((point) => point.y)), maxY = Math.max(...heart.map((point) => point.y));
polygons.heart = heart.map(({ x, y }) => ({ x: Number(((x-minX)/(maxX-minX)*100).toFixed(2)), y: Number(((y-minY)/(maxY-minY)*100).toFixed(2)) }));

// One outline drives the editor, customer preview and exported canvas mask.
export function getMaskPolygon(shape: MaskShape, customPoints: MaskPoint[] = []): MaskPoint[] | undefined {
  return shape === "custom" ? customPoints.length >= 3 ? customPoints : undefined : polygons[shape];
}
