/**
 * Taking ownership of the photos.
 *
 * Six 12-megapixel photos decoded at full size is a few hundred megabytes of
 * bitmap, and Android will simply kill the app for it. So every photo is
 * downscaled once on import and the app never touches the original again.
 * 1440px on the long edge is well above what a single tile of a 1080px-wide
 * collage can show, so this costs nothing visually — it just means the editor
 * and the export share one modest set of files.
 *
 * The system picker hands over full-size copies in the cache, metadata and
 * all. The privacy policy promises downscaled copies without metadata, so
 * those copies are deleted as soon as the working copies exist.
 */
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import type { Photo } from "../model/collage";

/** Long-edge cap for the working copy. */
const WORK_MAX = 1440;

/** Long-edge size of the swatch used for palette extraction. */
const SWATCH_MAX = 24;

const photosDir = new Directory(Paths.document, "photos");

function ensureDir() {
  if (!photosDir.exists) photosDir.create({ intermediates: true, idempotent: true });
}

/**
 * Filesystem-safe, stable key for a photo id. Drafts saved before the system
 * picker use MediaLibrary asset ids, which are content:// URIs on Android.
 */
function keyFor(assetId: string): string {
  let h = 0x811c9dc5;

  for (let i = 0; i < assetId.length; i++) {
    h ^= assetId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  return (h >>> 0).toString(16).padStart(8, "0") + "-" + assetId.length.toString(36);
}

async function renderTo(
  sourceUri: string,
  target: File,
  size: { width?: number; height?: number },
  compress: number,
): Promise<{ width: number; height: number }> {
  const ref = await ImageManipulator.manipulate(sourceUri).resize(size).renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress });
  const dimensions = { width: ref.width, height: ref.height };

  if (target.exists) target.delete();
  await new File(saved.uri).move(target);

  return dimensions;
}

export type PickedPhoto = { uri: string; width: number; height: number };

/**
 * Imports the picked photos in the order the picker returned them, which is
 * the order layouts fill their slots with.
 */
export async function importPhotos(picked: PickedPhoto[]): Promise<Photo[]> {
  ensureDir();
  const batch = Date.now().toString(36);
  const out: Photo[] = [];

  try {
    for (const [index, photo] of picked.entries()) {
      const id = `${batch}-${index}`;
      const work = new File(photosDir, `${keyFor(id)}.jpg`);
      const swatch = new File(photosDir, `${keyFor(id)}.swatch.jpg`);
      const landscape = photo.width >= photo.height;
      const size = landscape ? { width: WORK_MAX } : { height: WORK_MAX };
      const dimensions = await renderTo(photo.uri, work, size, 0.92);
      await renderTo(
        work.uri,
        swatch,
        landscape ? { width: SWATCH_MAX } : { height: SWATCH_MAX },
        0.8,
      );

      out.push({ id, uri: work.uri, ...dimensions, swatchUri: swatch.uri });
    }
  } finally {
    for (const photo of picked) discard(photo.uri);
  }

  return out;
}

function discard(uri: string) {
  try {
    const file = new File(uri);

    if (file.exists) file.delete();
  } catch {
    // The cache is the OS's to clear if this fails; the import must not.
  }
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
