/**
 * Layout recipes and the generator that picks one.
 *
 * Instagram drops every photo into identical squares and crops whatever sticks
 * out. We do the opposite: each recipe's slots have their own aspect ratios,
 * and we search for the recipe *and* the photo-to-slot assignment that requires
 * the least cropping. Two portraits and a landscape get a wide slot on top and
 * two tall ones underneath, without anyone choosing that.
 *
 * The recipes deliberately are not all even tilings. A grid of equal cells is
 * the safest possible fit and the dullest possible picture, so most counts also
 * offer a layout with one dominant photo — and the search gets a small nudge
 * towards those when the crop cost is close.
 */
import { DEFAULT_CROP, type Layer, type Rect } from './collage';

export type Recipe = {
  id: string;
  slots: Rect[];
  /**
   * Slots overlap instead of tiling. Only offered when photos have a paper
   * border and a shadow: with flat opaque rectangles an overlap is invisible
   * (the covered part is simply gone), so it renders as a plain split with
   * stray slivers of background that read as misalignment. Give each photo a
   * visible edge and the same arrangement reads as prints lying on each other.
   */
  overlapping?: boolean;
};

const UNIT: Rect = { x: 0, y: 0, w: 1, h: 1 };

/** Splits a rect into horizontal bands with the given relative weights. */
function rows(rect: Rect, ...weights: number[]): Rect[] {
  const total = weights.reduce((a, b) => a + b, 0);
  let y = rect.y;
  return weights.map((weight) => {
    const h = (rect.h * weight) / total;
    const band = { x: rect.x, y, w: rect.w, h };
    y += h;
    return band;
  });
}

/** Splits a rect into vertical columns with the given relative weights. */
function cols(rect: Rect, ...weights: number[]): Rect[] {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rect.x;
  return weights.map((weight) => {
    const w = (rect.w * weight) / total;
    const column = { x, y: rect.y, w, h: rect.h };
    x += w;
    return column;
  });
}

const grid = (columnCount: number, rowCount: number): Rect[] =>
  rows(UNIT, ...Array(rowCount).fill(1)).flatMap((band) =>
    cols(band, ...Array(columnCount).fill(1))
  );

/** Builds a recipe from a band split, e.g. `stacked([52, 48], [1, 2])`. */
function stacked(weights: number[], perBand: number[]): Rect[] {
  return rows(UNIT, ...weights).flatMap((band, i) =>
    perBand[i] === 1 ? [band] : cols(band, ...Array(perBand[i]).fill(1))
  );
}

export const RECIPES: Recipe[] = (() => {
  const two = rows(UNIT, 62, 38);
  const twoLow = rows(UNIT, 38, 62);
  const leftHeavy = cols(UNIT, 62, 38);
  const rightHeavy = cols(UNIT, 38, 62);
  const leftHeavy4 = cols(UNIT, 58, 42);
  const leftHeavy5 = cols(UNIT, 55, 45);

  return [
    { id: '1/full', slots: [UNIT] },

    { id: '2/stack', slots: rows(UNIT, 1, 1) },
    { id: '2/hero-top', slots: two },
    { id: '2/hero-bottom', slots: twoLow },
    { id: '2/side', slots: cols(UNIT, 1, 1) },

    { id: '3/rows', slots: rows(UNIT, 1, 1, 1) },
    { id: '3/band', slots: rows(UNIT, 30, 40, 30) },
    { id: '3/hero-top', slots: stacked([52, 48], [1, 2]) },
    { id: '3/hero-bottom', slots: stacked([48, 52], [2, 1]) },
    {
      id: '3/hero-left',
      slots: [leftHeavy[0], ...rows(leftHeavy[1], 1, 1)],
    },
    {
      id: '3/hero-right',
      slots: [...rows(rightHeavy[0], 1, 1), rightHeavy[1]],
    },

    { id: '4/quad', slots: grid(2, 2) },
    { id: '4/rows', slots: rows(UNIT, 1, 1, 1, 1) },
    { id: '4/hero-top', slots: stacked([46, 54], [1, 3]) },
    { id: '4/hero-bottom', slots: stacked([54, 46], [3, 1]) },
    { id: '4/sandwich', slots: stacked([38, 26, 36], [1, 2, 1]) },
    {
      id: '4/hero-left',
      slots: [leftHeavy4[0], ...rows(leftHeavy4[1], 1, 1, 1)],
    },

    { id: '5/2-3', slots: stacked([48, 52], [2, 3]) },
    { id: '5/3-2', slots: stacked([52, 48], [3, 2]) },
    { id: '5/hero-top', slots: stacked([42, 29, 29], [1, 2, 2]) },
    { id: '5/hero-bottom', slots: stacked([29, 29, 42], [2, 2, 1]) },
    {
      id: '5/hero-left',
      slots: [
        leftHeavy5[0],
        ...rows(leftHeavy5[1], 1, 1).flatMap((band) => cols(band, 1, 1)),
      ],
    },

    { id: '6/2x3', slots: grid(2, 3) },
    { id: '6/3x2', slots: grid(3, 2) },
    { id: '6/1-2-3', slots: stacked([34, 33, 33], [1, 2, 3]) },
    { id: '6/3-2-1', slots: stacked([33, 33, 34], [3, 2, 1]) },
    { id: '6/hero-top', slots: stacked([40, 30, 30], [1, 2, 3]) },

    // Prints laid on top of one another. These need `overlapping` styling to
    // make any sense — see the flag's docs.
    {
      id: '2/aufeinander',
      overlapping: true,
      slots: [
        { x: 0.02, y: 0.04, w: 0.72, h: 0.5 },
        { x: 0.26, y: 0.46, w: 0.72, h: 0.5 },
      ],
    },
    {
      id: '3/faecher',
      overlapping: true,
      slots: [
        { x: 0.02, y: 0.03, w: 0.66, h: 0.36 },
        { x: 0.3, y: 0.32, w: 0.68, h: 0.36 },
        { x: 0.04, y: 0.61, w: 0.66, h: 0.36 },
      ],
    },
    {
      id: '3/hero-aufgelegt',
      overlapping: true,
      slots: [
        { x: 0, y: 0, w: 1, h: 0.74 },
        { x: 0.06, y: 0.58, w: 0.42, h: 0.38 },
        { x: 0.52, y: 0.64, w: 0.42, h: 0.34 },
      ],
    },
    {
      id: '4/stapel',
      overlapping: true,
      slots: [
        { x: 0.04, y: 0.02, w: 0.5, h: 0.34 },
        { x: 0.44, y: 0.22, w: 0.52, h: 0.34 },
        { x: 0.03, y: 0.44, w: 0.52, h: 0.34 },
        { x: 0.45, y: 0.63, w: 0.5, h: 0.34 },
      ],
    },
  ];
})();

export type Suggestion = {
  recipe: Recipe;
  /** `assignment[slotIndex]` is the index of the photo that goes in that slot. */
  assignment: number[];
  /** Total crop mismatch; lower is better. */
  cropCost: number;
  /** What suggestions are actually ranked by: crop cost less a hierarchy nudge. */
  score: number;
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

/**
 * How unequal a recipe's cells are, as a coefficient of variation. An even grid
 * scores 0; one big photo over three small ones scores around 0.8.
 */
function hierarchy(slots: Rect[]): number {
  if (slots.length < 2) return 0;
  const mean = 1 / slots.length;
  const variance =
    slots.reduce((sum, slot) => sum + (slot.w * slot.h - mean) ** 2, 0) / slots.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Weight of the hierarchy nudge. Small on purpose: it should break ties between
 * layouts that crop about equally well, never rescue one that butchers a photo.
 */
const HIERARCHY_BONUS = 0.05;

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
  const columnCount = Math.ceil(Math.sqrt(count));
  const rowCount = Math.ceil(count / columnCount);
  return { id: `${count}/auto`, slots: grid(columnCount, rowCount).slice(0, count) };
}

/**
 * All layouts that fit `photoAspects`, best first.
 *
 * `contentAspect` is the width/height of the area layers live in, in pixels —
 * a slot that is half as wide as it is tall means something different on a
 * 9:16 story than on a 4:5 post.
 */
export function suggestLayouts(
  photoAspects: number[],
  contentAspect: number,
  /** Whether photos currently have the paper edge that overlaps need to read. */
  { overlapping = false }: { overlapping?: boolean } = {}
): Suggestion[] {
  const count = photoAspects.length;
  if (count === 0) return [];

  const candidates = RECIPES.filter(
    (r) => r.slots.length === count && (overlapping || !r.overlapping)
  );
  const recipes = candidates.length > 0 ? candidates : [genericGrid(count)];
  // 6 photos is 720 permutations per recipe — cheap, and above that the search
  // stops paying for itself, so we keep the photos in the order they were tapped.
  const orders = count <= 6 ? permutations(count) : [Array.from({ length: count }, (_, i) => i)];

  const suggestions: Suggestion[] = [];
  for (const recipe of recipes) {
    const slotAspects = recipe.slots.map((s) => (s.w / s.h) * contentAspect);
    const bonus = HIERARCHY_BONUS * hierarchy(recipe.slots);
    let best: Suggestion | null = null;
    for (const order of orders) {
      let cropCost = 0;
      for (let i = 0; i < count; i++) cropCost += mismatch(photoAspects[order[i]], slotAspects[i]);
      if (!best || cropCost < best.cropCost) {
        best = { recipe, assignment: order, cropCost, score: cropCost - bonus };
      }
    }
    if (best) suggestions.push(best);
  }
  return suggestions.sort((a, b) => a.score - b.score);
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
