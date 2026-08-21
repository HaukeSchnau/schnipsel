/**
 * Turning the collage into a file.
 *
 * The same <CollageScene> the editor shows is handed to Skia's offscreen
 * renderer at full story resolution — no view snapshotting, no second drawing
 * path that can quietly disagree with the preview.
 *
 * JPEG at q90: Instagram re-compresses whatever it gets, so PNG would only buy
 * a bigger file. (That changes if we ever ship the collage as a transparent
 * sticker layer instead of a background — see notes/schnipsel.md.)
 */
import { createElement } from 'react';
import { drawAsImage, ImageFormat } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { Asset } from 'expo-media-library';

import { CollageScene } from './CollageScene';
import { canvasSize } from '../model/geometry';
import type { Collage, Photo } from '../model/collage';
import type { ImageMap } from './images';

const JPEG_QUALITY = 90;

export type ExportResult = { uri: string; width: number; height: number };

export async function renderCollage(
  collage: Collage,
  photos: Record<string, Photo>,
  images: ImageMap
): Promise<ExportResult> {
  const size = canvasSize(collage);
  const element = createElement(CollageScene, { collage, photos, images, size });
  const image = await drawAsImage(element, size);
  if (!image) throw new Error('Skia konnte die Collage nicht rendern.');

  const bytes = image.encodeToBytes(ImageFormat.JPEG, JPEG_QUALITY);
  image.dispose();

  const file = new File(Paths.cache, `schnipsel-${Date.now()}.jpg`);
  file.create({ overwrite: true });
  file.write(bytes);
  return { uri: file.uri, ...size };
}

/**
 * The Instagram intent never reports back whether she actually posted, and
 * sometimes the collage is just meant for someone's chat. So every export
 * lands in the gallery regardless of where it goes next.
 */
export async function saveToGallery(fileUri: string): Promise<void> {
  await Asset.create(fileUri);
}
