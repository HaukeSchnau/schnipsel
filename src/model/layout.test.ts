import { describe, expect, test } from 'bun:test';

import { RECIPES, layersFrom, suggestLayouts } from './layout';

/** 9:16 content area, which is what a story collage actually gets. */
const STORY = 1080 / 1920;

describe('recipes', () => {
  test('every recipe stays inside the canvas', () => {
    for (const recipe of RECIPES) {
      for (const slot of recipe.slots) {
        expect(slot.x).toBeGreaterThanOrEqual(-1e-9);
        expect(slot.y).toBeGreaterThanOrEqual(-1e-9);
        expect(slot.x + slot.w).toBeLessThanOrEqual(1 + 1e-9);
        expect(slot.y + slot.h).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  test('tiling recipes cover the canvas exactly', () => {
    for (const recipe of RECIPES.filter((r) => !r.overlapping)) {
      const area = recipe.slots.reduce((sum, s) => sum + s.w * s.h, 0);
      expect(area).toBeCloseTo(1, 6);
    }
  });

  test('overlapping recipes are only offered when photos have a paper edge', () => {
    // Flat, they render as a plain split with stray background slivers.
    const flat = suggestLayouts([1, 1, 1], STORY);
    expect(flat.some((s) => s.recipe.overlapping)).toBe(false);

    const withPaper = suggestLayouts([1, 1, 1], STORY, { overlapping: true });
    expect(withPaper.some((s) => s.recipe.overlapping)).toBe(true);
  });

  test('recipe ids agree with their slot count', () => {
    for (const recipe of RECIPES) {
      expect(recipe.slots.length).toBe(Number(recipe.id.split('/')[0]));
    }
  });
});

describe('suggestLayouts', () => {
  test('two landscape photos get an even split, not a lopsided one', () => {
    // 2/big-top would fit one of them beautifully and crop the other hard.
    // Squaring the per-slot cost is what keeps that from winning on total.
    const best = suggestLayouts([16 / 9, 16 / 9], STORY)[0];
    expect(best.recipe.id).toBe('2/stack');
  });

  test('slot shapes are judged against the canvas, not in the abstract', () => {
    // Side by side on a 9:16 story means two very tall strips, which crops a
    // portrait photo more than stacking does. On a square canvas it doesn't.
    expect(suggestLayouts([2 / 3, 2 / 3], STORY)[0].recipe.id).toBe('2/stack');
    expect(suggestLayouts([2 / 3, 2 / 3], 1)[0].recipe.id).toBe('2/side');
  });

  test('the landscape photo gets the wide slot, whatever order it was tapped in', () => {
    // 3/hero-top has one wide slot on top and two narrower ones underneath.
    const best = suggestLayouts([2 / 3, 16 / 9, 2 / 3], STORY).find(
      (s) => s.recipe.id === '3/hero-top'
    )!;
    expect(best.assignment[0]).toBe(1);
  });

  test('suggestions come back best first', () => {
    const all = suggestLayouts([1, 1, 1, 1], STORY);
    expect(all.length).toBeGreaterThan(1);
    for (let i = 1; i < all.length; i++) {
      expect(all[i].score).toBeGreaterThanOrEqual(all[i - 1].score);
    }
  });

  test('the hierarchy nudge never rescues a layout that butchers a photo', () => {
    // Three matching portraits: an even three-row split fits them all badly on
    // a 9:16 story, but a hero layout must not win just for being uneven.
    for (const aspects of [[1, 1, 1], [2 / 3, 2 / 3, 2 / 3], [3 / 2, 3 / 2, 3 / 2]]) {
      const all = suggestLayouts(aspects, STORY);
      const best = all[0];
      const cheapest = [...all].sort((a, b) => a.cropCost - b.cropCost)[0];
      // The winner may differ from the pure-crop optimum, but only barely.
      expect(best.cropCost - cheapest.cropCost).toBeLessThan(0.15);
    }
  });

  test('counts without a hand-made recipe fall back to a grid', () => {
    const best = suggestLayouts([1, 1, 1, 1, 1, 1, 1], STORY)[0];
    expect(best.recipe.slots.length).toBe(7);
  });

  test('layers come out in slot order, carrying the assigned photo', () => {
    const best = suggestLayouts([2 / 3, 16 / 9, 2 / 3], STORY).find(
      (s) => s.recipe.id === '3/hero-top'
    )!;
    const layers = layersFrom(best, ['a', 'b', 'c']);
    expect(layers.map((l) => l.photoId)).toEqual(['b', 'a', 'c']);
    expect(new Set(layers.map((l) => l.id)).size).toBe(3);
  });
});
