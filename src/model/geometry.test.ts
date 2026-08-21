import { describe, expect, test } from 'bun:test';

import { CANVAS_SIZES, DEFAULT_CROP, emptyCollage, type Collage } from './collage';
import {
  clampCrop,
  contentRect,
  gutter,
  imageDestRect,
  layerRect,
  rectToFrame,
} from './geometry';

const story = CANVAS_SIZES.story;

function collageWith(overrides: Partial<Collage> = {}): Collage {
  return { ...emptyCollage('t'), ...overrides };
}

describe('frame <-> rect', () => {
  test('round-trips through pixels for any gap and safe zone setting', () => {
    for (const gap of [0, 0.3, 1]) {
      for (const respectSafeZone of [true, false]) {
        const collage = collageWith({ gap, respectSafeZone });
        const content = contentRect(collage, story);
        const gut = gutter(collage, story);
        const frame = { x: 0.25, y: 0.1, w: 0.5, h: 0.4, rotation: 0 };

        const box = layerRect(frame, content, gut);
        const back = rectToFrame(box, content, gut, 0);

        expect(back.x).toBeCloseTo(frame.x, 10);
        expect(back.y).toBeCloseTo(frame.y, 10);
        expect(back.w).toBeCloseTo(frame.w, 10);
        expect(back.h).toBeCloseTo(frame.h, 10);
      }
    }
  });

  test('the gap slider produces equal gutters and outer margins', () => {
    const collage = collageWith({ gap: 0.5, respectSafeZone: false });
    const content = contentRect(collage, story);
    const gut = gutter(collage, story);

    const left = layerRect({ x: 0, y: 0, w: 0.5, h: 1, rotation: 0 }, content, gut);
    const right = layerRect({ x: 0.5, y: 0, w: 0.5, h: 1, rotation: 0 }, content, gut);

    expect(right.x - (left.x + left.w)).toBeCloseTo(gut, 6);
    expect(left.x).toBeCloseTo(gut, 6);
    expect(story.width - (right.x + right.w)).toBeCloseTo(gut, 6);
  });

  test('the safe zone keeps layers clear of Instagram’s own bars', () => {
    const guarded = contentRect(collageWith({ gap: 0, respectSafeZone: true }), story);
    const full = contentRect(collageWith({ gap: 0, respectSafeZone: false }), story);

    expect(guarded.y).toBeGreaterThan(200);
    expect(guarded.y + guarded.h).toBeLessThan(story.height - 250);
    expect(full.y).toBe(0);
    expect(full.h).toBe(story.height);
  });
});

describe('imageDestRect', () => {
  const box = { x: 100, y: 200, w: 400, h: 600 };

  test('cover always fills the frame, whichever way the photo leans', () => {
    for (const aspect of [0.5, 2 / 3, 1, 1.5, 3]) {
      const dest = imageDestRect(aspect, box, DEFAULT_CROP);
      expect(dest.w).toBeGreaterThanOrEqual(box.w - 1e-9);
      expect(dest.h).toBeGreaterThanOrEqual(box.h - 1e-9);
      expect(dest.w / dest.h).toBeCloseTo(aspect, 10);
    }
  });

  test('contain always fits inside the frame', () => {
    for (const aspect of [0.5, 1, 3]) {
      const dest = imageDestRect(aspect, box, { ...DEFAULT_CROP, fit: 'contain' });
      expect(dest.w).toBeLessThanOrEqual(box.w + 1e-9);
      expect(dest.h).toBeLessThanOrEqual(box.h + 1e-9);
      expect(dest.w / dest.h).toBeCloseTo(aspect, 10);
    }
  });

  test('clampCrop stops a panned cover crop from exposing the background', () => {
    const crop = clampCrop({ ...DEFAULT_CROP, offsetX: 5, offsetY: -5 }, box, 1.5);
    const dest = imageDestRect(1.5, box, crop);
    expect(dest.x).toBeLessThanOrEqual(box.x + 1e-9);
    expect(dest.y).toBeLessThanOrEqual(box.y + 1e-9);
    expect(dest.x + dest.w).toBeGreaterThanOrEqual(box.x + box.w - 1e-9);
    expect(dest.y + dest.h).toBeGreaterThanOrEqual(box.y + box.h - 1e-9);
  });

  test('a zoomed crop still fills the frame after clamping', () => {
    const crop = clampCrop({ fit: 'cover', scale: 2, offsetX: 0.9, offsetY: 0.9 }, box, 1);
    const dest = imageDestRect(1, box, crop);
    expect(dest.x).toBeLessThanOrEqual(box.x + 1e-9);
    expect(dest.x + dest.w).toBeGreaterThanOrEqual(box.x + box.w - 1e-9);
  });
});
