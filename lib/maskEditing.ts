export function maskPointerPosition(clientX: number, clientY: number, centerX: number, centerY: number, width: number, height: number, rotation: number) {
  const angle = rotation * Math.PI / 180;
  const dx = clientX - centerX, dy = clientY - centerY;
  const bounded = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
  return { x: bounded(50 + (dx * Math.cos(angle) + dy * Math.sin(angle)) / Math.max(1, width) * 100), y: bounded(50 + (-dx * Math.sin(angle) + dy * Math.cos(angle)) / Math.max(1, height) * 100) };
}
