/**
 * Magnetism while dragging.
 *
 * Not a grid you're locked into — edges and centre lines pull gently, and you
 * can drag straight past them. That's the difference between "tidy without
 * effort" and "fighting the app".
 */
export type SnapTargets = { vertical: number[]; horizontal: number[] };

/** How close, in canvas pixels, an edge has to get before it's pulled in. */
export const SNAP_THRESHOLD_RATIO = 0.022;

/** The nudge to add to a translation so the nearest edge lands on a guide. */
export function snapDelta(edges: number[], targets: number[], threshold: number): number {
  'worklet';
  let best = 0;
  let bestDistance = threshold;
  for (let i = 0; i < edges.length; i++) {
    for (let j = 0; j < targets.length; j++) {
      const delta = targets[j] - edges[i];
      const distance = delta < 0 ? -delta : delta;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = delta;
      }
    }
  }
  return best;
}
