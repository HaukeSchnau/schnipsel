/**
 * There is no save button.
 *
 * Every change writes to a draft, and the app opens where she left it. Putting
 * the phone down mid-collage and picking it up after coffee has to be free —
 * "I had something nice and it's gone" is the one failure this app can't
 * afford.
 */
import { File, Paths } from 'expo-file-system';

import type { Collage, Photo } from '../model/collage';
import { emptyCollage } from '../model/collage';

const DRAFT_VERSION = 2;
const draftFile = new File(Paths.document, 'draft.json');

export type Draft = { version: number; collage: Collage; photos: Photo[] };

let pending: ReturnType<typeof setTimeout> | null = null;

/** Debounced so a slider drag doesn't hit the filesystem sixty times a second. */
export function saveDraft(collage: Collage, photos: Photo[]) {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    const draft: Draft = { version: DRAFT_VERSION, collage, photos };
    try {
      draftFile.create({ overwrite: true });
      draftFile.write(JSON.stringify(draft));
    } catch {
      // A failed autosave must never interrupt editing.
    }
  }, 400);
}

/**
 * Loads the last draft, dropping photos whose working copies are gone (and any
 * layers that used them) so a half-collected collage still opens.
 */
export function loadDraft(): { collage: Collage; photos: Photo[] } | null {
  if (!draftFile.exists) return null;
  let draft: Draft;
  try {
    draft = JSON.parse(draftFile.textSync());
  } catch {
    return null;
  }
  if (draft.version !== DRAFT_VERSION && draft.version !== 1) return null;

  const photos = draft.photos.filter((photo) => new File(photo.uri).exists);
  const available = new Set(photos.map((p) => p.id));
  const layers = draft.collage.layers.filter((layer) => available.has(layer.photoId));
  if (photos.length === 0) return null;

  const collage =
    draft.version === 1 ? migrateFromV1(draft.collage) : draft.collage;
  return { collage: { ...collage, layers }, photos };
}

/**
 * v1 drafts have no `margin`, and their gap/radius/safe-zone values are the old
 * card-grid defaults — the very look this version exists to get rid of. The
 * photos and their arrangement are the work worth keeping, so those carry over
 * and the styling is reset.
 */
function migrateFromV1(collage: Collage): Collage {
  const fresh = emptyCollage(collage.id);
  return {
    ...collage,
    gap: fresh.gap,
    margin: fresh.margin,
    radius: fresh.radius,
    scatter: fresh.scatter,
    respectSafeZone: fresh.respectSafeZone,
    background: fresh.background,
  };
}

export function clearDraft() {
  if (draftFile.exists) draftFile.delete();
}
