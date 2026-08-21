/**
 * Loading photos into Skia.
 *
 * `useImage` from react-native-skia is one hook per image, which does not
 * survive a collage whose layer count changes. This loads a whole set instead
 * and hands back a plain lookup, so the scene stays a pure function of props
 * (and therefore renders identically offscreen at export time).
 */
import { useEffect, useRef, useState } from 'react';
import { Skia, type SkImage } from '@shopify/react-native-skia';

import type { Photo } from '../model/collage';

export type ImageMap = Record<string, SkImage>;

export async function loadSkImage(uri: string): Promise<SkImage | null> {
  const data = await Skia.Data.fromURI(uri);
  return Skia.Image.MakeImageFromEncoded(data);
}

/** Decoded photos keyed by photo id. Missing ids are still loading. */
export function useSkImages(photos: Photo[]): ImageMap {
  const [images, setImages] = useState<ImageMap>({});
  const cache = useRef<ImageMap>({});

  useEffect(() => {
    let cancelled = false;
    const wanted = new Set(photos.map((p) => p.id));
    const missing = photos.filter((p) => !cache.current[p.id]);

    for (const id of Object.keys(cache.current)) {
      if (!wanted.has(id)) delete cache.current[id];
    }
    if (missing.length === 0) {
      setImages({ ...cache.current });
      return;
    }

    Promise.all(
      missing.map(async (photo) => {
        const image = await loadSkImage(photo.uri);
        if (image) cache.current[photo.id] = image;
      })
    ).then(() => {
      if (!cancelled) setImages({ ...cache.current });
    });

    return () => {
      cancelled = true;
    };
  }, [photos]);

  return images;
}
