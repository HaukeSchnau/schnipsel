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

const DRAFT_VERSION = 1;
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
  if (draft.version !== DRAFT_VERSION) return null;

  const photos = draft.photos.filter((photo) => new File(photo.uri).exists);
  const available = new Set(photos.map((p) => p.id));
  const layers = draft.collage.layers.filter((layer) => available.has(layer.photoId));
  if (photos.length === 0) return null;

  return { collage: { ...draft.collage, layers }, photos };
}

export function clearDraft() {
  if (draftFile.exists) draftFile.delete();
}
