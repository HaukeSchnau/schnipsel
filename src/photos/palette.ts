/**
 * Background colours picked out of the photos themselves.
 *
 * Five swatches you can tap beat a colour wheel you have to aim at, and a
 * colour lifted from the photos is almost always a better answer than anything
 * chosen from scratch. Runs on the 24px swatch copies made at import, so this
 * is a handful of pixels, not a megabyte.
 */
import { AlphaType, ColorType } from '@shopify/react-native-skia';

import { loadSkImage } from '../render/images';
import type { Photo } from '../model/collage';

/** Bits dropped per channel when bucketing — 5 gives an 8x8x8 histogram. */
const SHIFT = 5;

type Bucket = { r: number; g: number; b: number; n: number; weight: number };

function hex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** Favours colours with some life in them over the muddy average of a photo. */
function vibrance(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  // Mid-tones read best behind photos; pure black and blown-out white do not.
  const tone = 1 - Math.abs((max + min) / 2 / 255 - 0.5) * 1.6;
  return 0.25 + saturation * Math.max(0, tone);
}

async function swatchesOf(photo: Photo): Promise<Bucket[]> {
  const image = await loadSkImage(photo.swatchUri);
  if (!image) return [];
  const width = image.width();
  const height = image.height();
  const pixels = image.readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  image.dispose();
  if (!pixels) return [];

  const buckets = new Map<number, Bucket>();
  for (let i = 0; i < width * height; i++) {
    const r = Number(pixels[i * 4]);
    const g = Number(pixels[i * 4 + 1]);
    const b = Number(pixels[i * 4 + 2]);
    const key = ((r >> SHIFT) << 10) | ((g >> SHIFT) << 5) | (b >> SHIFT);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, weight: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    bucket.weight += vibrance(r, g, b);
    buckets.set(key, bucket);
  }
  return [...buckets.values()];
}

/** Up to `count` background colours drawn from the given photos, best first. */
export async function extractPalette(photos: Photo[], count = 5): Promise<string[]> {
  const all: Bucket[] = [];
  for (const photo of photos) all.push(...(await swatchesOf(photo)));

  return all
    .sort((a, b) => b.weight - a.weight)
    .slice(0, count * 3)
    .map((b) => hex(b.r / b.n, b.g / b.n, b.b / b.n))
    .filter((color, i, list) => list.indexOf(color) === i)
    .slice(0, count);
}
