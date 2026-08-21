import { describe, expect, test } from 'bun:test';

import { DEFAULT_CROP, emptyCollage, swapPhotos, type Layer } from './collage';

function layer(id: string, photoId: string, crop = DEFAULT_CROP): Layer {
  return { id, photoId, frame: { x: 0, y: 0, w: 1, h: 0.5, rotation: 0 }, crop: { ...crop } };
}

const base = {
  ...emptyCollage('t'),
  layers: [
    layer('a', 'photo-1', { fit: 'cover' as const, scale: 2, offsetX: 0.1, offsetY: 0 }),
    layer('b', 'photo-2'),
    layer('c', 'photo-3'),
  ],
};

describe('swapPhotos', () => {
  test('trades the photos and leaves every frame where it was', () => {
    const next = swapPhotos(base, 'a', 'c');
    expect(next.layers.map((l) => l.photoId)).toEqual(['photo-3', 'photo-2', 'photo-1']);
    expect(next.layers.map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(next.layers.map((l) => l.frame)).toEqual(base.layers.map((l) => l.frame));
  });

  test('the crop travels with its photo', () => {
    const next = swapPhotos(base, 'a', 'c');
    expect(next.layers[2].crop.scale).toBe(2);
    expect(next.layers[0].crop.scale).toBe(1);
  });

  test('swapping a layer with itself or with a stranger changes nothing', () => {
    expect(swapPhotos(base, 'a', 'a')).toBe(base);
    expect(swapPhotos(base, 'a', 'nope')).toBe(base);
  });
});
