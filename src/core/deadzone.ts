export function applyDeadzone(x: number, y: number, threshold = 0.15): { x: number; y: number } {
  const mag = Math.hypot(x, y);
  if (mag <= 0 || mag < threshold) return { x: 0, y: 0 };
  const scaled = Math.min(1, (mag - threshold) / (1 - threshold));
  return { x: (x / mag) * scaled, y: (y / mag) * scaled };
}
