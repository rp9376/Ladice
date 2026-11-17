export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Shortest signed angle from a to b, in (-PI, PI]. */
export function angDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

export function rotateToward(a: number, b: number, maxStep: number): number {
  const d = angDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

/** Does segment AB pass within r of point C? */
export function segCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number): boolean {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  const px = ax + dx * t - cx, py = ay + dy * t - cy;
  return px * px + py * py <= r * r;
}
