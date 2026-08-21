/**
 * Taking ownership of the photos.
 *
 * Six 12-megapixel photos decoded at full size is a few hundred megabytes of
 * bitmap, and Android will simply kill the app for it. So every photo is
 * downscaled once on import and the app never touches the original again.
 * 1440px on the long edge is well above what a single tile of a 1080px-wide
 * collage can show, so this costs nothing visually — it just means the editor
 * and the export share one modest set of files.
 */
import { Asset } from 'expo-media-library';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { Photo } from '../model/collage';

/** Long-edge cap for the working copy. */
const WORK_MAX = 1440;
/** Long-edge size of the swatch used for palette extraction. */
const SWATCH_MAX = 24;

const photosDir = new Directory(Paths.document, 'photos');

function ensureDir() {
  if (!photosDir.exists) photosDir.create({ intermediates: true, idempotent: true });
}

/** Filesystem-safe, stable key for an asset id (which is a content:// URI on Android). */
function keyFor(assetId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < assetId.length; i++) {
    h ^= assetId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + '-' + assetId.length.toString(36);
}

async function renderTo(
  sourceUri: string,
  target: File,
  size: { width?: number; height?: number },
  compress: number
): Promise<{ width: number; height: number }> {
  const ref = await ImageManipulator.manipulate(sourceUri).resize(size).renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress });
  const dimensions = { width: ref.width, height: ref.height };
  if (target.exists) target.delete();
  await new File(saved.uri).move(target);
  return dimensions;
}

export type PickedAsset = { id: string; width: number; height: number };

/**
 * Imports the picked assets, reusing working copies from earlier sessions.
 * Order is preserved — the picker's tap order is what layouts fill slots with.
 */
export async function importPhotos(assets: PickedAsset[]): Promise<Photo[]> {
  ensureDir();
  const out: Photo[] = [];
  for (const asset of assets) {
    const key = keyFor(asset.id);
    const work = new File(photosDir, `${key}.jpg`);
    const swatch = new File(photosDir, `${key}.swatch.jpg`);

    if (work.exists && swatch.exists) {
      // Dimensions come from the media store, so a cached copy needs no decode.
      const landscape = asset.width >= asset.height;
      const scale = Math.min(1, WORK_MAX / Math.max(asset.width, asset.height));
      out.push({
        id: asset.id,
        uri: work.uri,
        width: Math.round(asset.width * scale) || (landscape ? WORK_MAX : 1),
        height: Math.round(asset.height * scale) || (landscape ? 1 : WORK_MAX),
        swatchUri: swatch.uri,
      });
      continue;
    }

    const sourceUri = await new Asset(asset.id).getUri();
    const landscape = asset.width >= asset.height;
    const size = landscape ? { width: WORK_MAX } : { height: WORK_MAX };
    const dimensions = await renderTo(sourceUri, work, size, 0.92);
    await renderTo(work.uri, swatch, landscape ? { width: SWATCH_MAX } : { height: SWATCH_MAX }, 0.8);

    out.push({ id: asset.id, uri: work.uri, ...dimensions, swatchUri: swatch.uri });
  }
  return out;
}

/** Drops working copies that no collage or draft refers to any more. */
export function pruneUnused(keepAssetIds: Iterable<string>) {
  if (!photosDir.exists) return;
  const keep = new Set<string>();
  for (const id of keepAssetIds) {
    keep.add(`${keyFor(id)}.jpg`);
    keep.add(`${keyFor(id)}.swatch.jpg`);
  }
  for (const entry of photosDir.list()) {
    if (entry instanceof File && !keep.has(entry.name)) entry.delete();
  }
}
