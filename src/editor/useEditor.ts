/**
 * Editor state: one collage, its photos, an undo stack, and autosave.
 *
 * The collage is plain immutable data, so undo is just a list of previous
 * versions — cheap, because a collage is a few hundred bytes of numbers, not
 * pixels. That same property is what makes the archive/remix idea free later.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { emptyCollage, type Collage, type Photo } from '../model/collage';
import { canvasSize, contentRect } from '../model/geometry';
import { layersFrom, suggestLayouts, type Suggestion } from '../model/layout';
import { pruneUnused } from '../photos/import';
import { loadDraft, saveDraft } from '../storage/draft';

const UNDO_LIMIT = 50;

export function useEditor() {
  const [collage, setCollage] = useState<Collage | null>(null);
  /**
   * Mirrors `collage` so `apply` can read the current value without a state
   * updater. The undo stack and the shuffle cursor are refs, and mutating a ref
   * inside an updater is not safe: React may run it twice, and two `apply`
   * calls in one tick would then push the wrong history.
   */
  const collageRef = useRef<Collage | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [restored, setRestored] = useState(false);
  const undoStack = useRef<Collage[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const suggestions = useRef<Suggestion[]>([]);
  const suggestionIndex = useRef(0);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      collageRef.current = draft.collage;
      setCollage(draft.collage);
      setPhotos(draft.photos);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (collage && restored) saveDraft(collage, photos);
  }, [collage, photos, restored]);

  const photosById = useMemo(
    () => Object.fromEntries(photos.map((p) => [p.id, p])),
    [photos]
  );

  /**
   * `history: false` is for continuous changes — a slider being dragged, a
   * gesture in flight — which get one undo entry when they settle instead of
   * one per frame.
   */
  const apply = useCallback(
    (mutate: (current: Collage) => Collage, { history = true }: { history?: boolean } = {}) => {
      const current = collageRef.current;
      if (!current) return;
      const next = mutate(current);
      if (next === current) return;
      if (history) {
        undoStack.current = [...undoStack.current.slice(-(UNDO_LIMIT - 1)), current];
        setCanUndo(true);
      }
      collageRef.current = { ...next, updatedAt: Date.now() };
      setCollage(collageRef.current);
    },
    []
  );

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    setCanUndo(undoStack.current.length > 0);
    if (previous) {
      collageRef.current = previous;
      setCollage(previous);
    }
  }, []);

  /** Replaces the photo set and lays it out from scratch. */
  const startWith = useCallback((nextPhotos: Photo[]) => {
    // Only one draft exists, so anything outside the new set is unreachable.
    try {
      pruneUnused(nextPhotos.map((p) => p.id));
    } catch {
      // Housekeeping must never block starting a collage.
    }
    const base = emptyCollage(`c-${Date.now()}`);
    const ranked = rank(base, nextPhotos);
    suggestions.current = ranked;
    suggestionIndex.current = 0;
    undoStack.current = [];
    setCanUndo(false);
    setPhotos(nextPhotos);
    collageRef.current =
      ranked.length > 0
        ? { ...base, layers: layersFrom(ranked[0], nextPhotos.map((p) => p.id)) }
        : base;
    setCollage(collageRef.current);
  }, []);

  /** Next-best layout. Wraps around, so it's a browse rather than a dice roll. */
  const shuffle = useCallback(() => {
    apply((current) => {
      if (suggestions.current.length === 0) suggestions.current = rank(current, photos);
      if (suggestions.current.length === 0) return current;
      suggestionIndex.current = (suggestionIndex.current + 1) % suggestions.current.length;
      const next = suggestions.current[suggestionIndex.current];
      return { ...current, layers: layersFrom(next, photos.map((p) => p.id)) };
    });
  }, [apply, photos]);

  return {
    collage,
    photos,
    photosById,
    restored,
    canUndo,
    apply,
    undo,
    startWith,
    shuffle,
    reset: useCallback(() => {
      collageRef.current = null;
      setCollage(null);
      setPhotos([]);
      undoStack.current = [];
      setCanUndo(false);
    }, []),
  };
}

function rank(collage: Collage, photos: Photo[]): Suggestion[] {
  if (photos.length === 0) return [];
  const canvas = canvasSize(collage);
  const content = contentRect(collage, canvas);
  return suggestLayouts(
    photos.map((p) => p.width / p.height),
    content.w / content.h
  );
}
