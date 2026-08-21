/**
 * Layout recipes and the generator that picks one.
 *
 * Instagram drops every photo into identical squares and crops whatever sticks
 * out. We do the opposite: each recipe's slots have their own aspect ratios,
 * and we search for the recipe *and* the photo-to-slot assignment that requires
 * the least cropping. Two portraits and a landscape get a wide slot on top and
 * two tall ones underneath, without anyone choosing that.
 */
import { DEFAULT_CROP, type Layer, type Rect } from './collage';

export type Recipe = { id: string; slots: Rect[] };

/** `n` cells side by side, filling a horizontal band. */
const band = (y: number, h: number, n: number): Rect[] =>
  Array.from({ length: n }, (_, i) => ({ x: i / n, y, w: 1 / n, h }));

/** `n` cells stacked, filling a vertical column. */
const column = (x: number, w: number, n: number): Rect[] =>
  Array.from({ length: n }, (_, i) => ({ x, y: i / n, w, h: 1 / n }));

const grid = (cols: number, rows: number): Rect[] =>
  Array.from({ length: cols * rows }, (_, i) => ({
    x: (i % cols) / cols,
    y: Math.floor(i / cols) / rows,
    w: 1 / cols,
    h: 1 / rows,
  }));

const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

export const RECIPES: Recipe[] = [
  { id: '1/full', slots: [FULL] },

  { id: '2/stack', slots: band(0, 0.5, 1).concat(band(0.5, 0.5, 1)) },
  { id: '2/side', slots: band(0, 1, 2) },
  { id: '2/big-top', slots: [{ x: 0, y: 0, w: 1, h: 0.62 }, { x: 0, y: 0.62, w: 1, h: 0.38 }] },

  { id: '3/rows', slots: column(0, 1, 3) },
  { id: '3/cols', slots: band(0, 1, 3) },
  { id: '3/big-top', slots: [{ x: 0, y: 0, w: 1, h: 0.6 }, ...band(0.6, 0.4, 2)] },
  { id: '3/big-bottom', slots: [...band(0, 0.4, 2), { x: 0, y: 0.4, w: 1, h: 0.6 }] },
  { id: '3/big-left', slots: [{ x: 0, y: 0, w: 0.6, h: 1 }, ...column(0.6, 0.4, 2)] },

  { id: '4/quad', slots: grid(2, 2) },
  { id: '4/rows', slots: column(0, 1, 4) },
  { id: '4/big-top', slots: [{ x: 0, y: 0, w: 1, h: 0.55 }, ...band(0.55, 0.45, 3)] },
  { id: '4/big-left', slots: [{ x: 0, y: 0, w: 0.58, h: 1 }, ...column(0.58, 0.42, 3)] },

  { id: '5/2-3', slots: [...band(0, 0.5, 2), ...band(0.5, 0.5, 3)] },
  { id: '5/3-2', slots: [...band(0, 0.5, 3), ...band(0.5, 0.5, 2)] },
  {
    id: '5/big-left',
    slots: [
      { x: 0, y: 0, w: 0.55, h: 1 },
      ...grid(2, 2).map((r) => ({ x: 0.55 + r.x * 0.45, y: r.y, w: r.w * 0.45, h: r.h })),
    ],
  },

  { id: '6/3x2', slots: grid(3, 2) },
  { id: '6/2x3', slots: grid(2, 3) },
  { id: '6/1-2-3', slots: [...band(0, 0.34, 1), ...band(0.34, 0.33, 2), ...band(0.67, 0.33, 3)] },
];

export type Suggestion = {
  recipe: Recipe;
  /** `assignment[slotIndex]` is the index of the photo that goes in that slot. */
  assignment: number[];
  /** Total crop mismatch; lower is better. */
  cost: number;
};

/**
 * How badly a photo has to be cropped to fill a slot. 0 = perfect fit.
 *
 * The log ratio *is* the crop: a photo in a slot keeps
 * `min(a, b) / max(a, b)` of itself, which is `exp(-|ln(a/b)|)`. Squaring it
 * before summing is what stops the search from sacrificing one photo to a
 * badly-shaped slot just because another one landed perfectly — across a
 * collage, evenly-cropped photos look considered and one mangled photo doesn't.
 */
function mismatch(photoAspect: number, slotAspect: number): number {
  const loss = Math.log(photoAspect / slotAspect);
  return loss * loss;
}

function permutations(n: number): number[][] {
  if (n <= 1) return [[0]];
  const out: number[][] = [];
  const walk = (prefix: number[], rest: number[]) => {
    if (rest.length === 0) {
      out.push(prefix);
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      walk([...prefix, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)]);
    }
  };
  walk([], Array.from({ length: n }, (_, i) => i));
  return out;
}

/** Fallback for counts we have no hand-made recipe for. */
function genericGrid(count: number): Recipe {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { id: `${count}/auto`, slots: grid(cols, rows).slice(0, count) };
}

/**
 * All layouts that fit `photoAspects`, best first.
 *
 * `contentAspect` is the width/height of the area layers live in, in pixels —
 * a slot that is half as wide as it is tall means something different on a
 * 9:16 story than on a 4:5 post.
 */
export function suggestLayouts(photoAspects: number[], contentAspect: number): Suggestion[] {
  const count = photoAspects.length;
  if (count === 0) return [];

  const candidates = RECIPES.filter((r) => r.slots.length === count);
  const recipes = candidates.length > 0 ? candidates : [genericGrid(count)];
  // 6 photos is 720 permutations per recipe — cheap, and above that the search
  // stops paying for itself, so we keep the photos in the order they were tapped.
  const orders = count <= 6 ? permutations(count) : [Array.from({ length: count }, (_, i) => i)];

  const suggestions: Suggestion[] = [];
  for (const recipe of recipes) {
    const slotAspects = recipe.slots.map((s) => (s.w / s.h) * contentAspect);
    let best: Suggestion | null = null;
    for (const order of orders) {
      let cost = 0;
      for (let i = 0; i < count; i++) cost += mismatch(photoAspects[order[i]], slotAspects[i]);
      if (!best || cost < best.cost) best = { recipe, assignment: order, cost };
    }
    if (best) suggestions.push(best);
  }
  return suggestions.sort((a, b) => a.cost - b.cost);
}

export function layersFrom(suggestion: Suggestion, photoIds: string[]): Layer[] {
  return suggestion.recipe.slots.map((slot, i) => {
    const photoId = photoIds[suggestion.assignment[i]];
    return {
      id: `${suggestion.recipe.id}:${i}:${photoId}`,
      photoId,
      frame: { ...slot, rotation: 0 },
      crop: { ...DEFAULT_CROP },
    };
  });
}
