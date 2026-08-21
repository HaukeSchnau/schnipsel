/**
 * The Leuchttisch.
 *
 * Everything is direct manipulation, one-handed, with no mode switcher: tap to
 * select, tap the selected photo again to adjust its crop inside the frame,
 * double tap to switch between filling and fitting. Undo sits in the corner
 * permanently, because with direct manipulation something is always about to
 * get knocked out of place.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import type { Collage, Layer, Photo } from '../model/collage';
import {
  canvasSize,
  clampCrop,
  contentRect,
  fitCanvas,
  gutter,
  hitTest,
  imageDestRect,
  layerRect,
  rectToFrame,
} from '../model/geometry';
import { CollageScene, type LiveTransform } from '../render/CollageScene';
import { useSkImages } from '../render/images';
import { renderCollage, saveToGallery } from '../render/export';
import { shareToInstagramStory } from '../share/instagram';
import { extractPalette } from '../photos/palette';
import { snapDelta, SNAP_THRESHOLD_RATIO, type SnapTargets } from '../editor/snapping';
import { applyStyle, currentStyle, STYLES, STYLE_ORDER } from '../model/styles';
import { Button, Chip, Slider, tick, Toolbar } from '../ui/controls';
import { theme } from '../ui/theme';

type Selection = { id: string; mode: 'frame' | 'crop' } | null;

export function EditorScreen({
  collage,
  photos,
  photosById,
  canUndo,
  apply,
  undo,
  shuffle,
  onPickPhotos,
}: {
  collage: Collage;
  photos: Photo[];
  photosById: Record<string, Photo>;
  canUndo: boolean;
  apply: (mutate: (c: Collage) => Collage, options?: { history?: boolean }) => void;
  undo: () => void;
  shuffle: () => void;
  onPickPhotos: () => void;
}) {
  const images = useSkImages(photos);
  const [selected, setSelected] = useState<Selection>(null);
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [showSliders, setShowSliders] = useState(false);
  const [palette, setPalette] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState({ width: 0, height: 0 });

  const live = useSharedValue<LiveTransform>(null);
  /** Pan and pinch can run together; only the last one to finish commits. */
  const activeGestures = useSharedValue(0);

  const preview = useMemo(
    () => (available.width > 0 ? fitCanvas(collage, available) : { width: 0, height: 0 }),
    [collage, available]
  );

  // Reads the 24px swatch copies made at import, so this is a few hundred
  // pixels per photo rather than a decode.
  const photoKey = photos.map((p) => p.id).join('|');
  useEffect(() => {
    if (photos.length === 0) return;
    let cancelled = false;
    extractPalette(photos)
      .then((colors) => !cancelled && setPalette(colors))
      .catch(() => !cancelled && setPalette([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);

  const selectedLayer = collage.layers.find((l) => l.id === selected?.id) ?? null;
  const style = currentStyle(collage);

  /** Geometry the gesture worklets close over. Recomputed every render. */
  const geometry = useMemo(() => {
    if (preview.width === 0) return null;
    const content = contentRect(collage, preview);
    const gut = gutter(collage, preview);
    const boxes = collage.layers.map((layer) => ({
      layer,
      box: layerRect(layer.frame, content, gut),
    }));
    const activeBox = boxes.find((b) => b.layer.id === selected?.id)?.box ?? null;
    const targets: SnapTargets = {
      vertical: [content.x, content.x + content.w / 2, content.x + content.w],
      horizontal: [content.y, content.y + content.h / 2, content.y + content.h],
    };
    for (const { layer, box } of boxes) {
      if (layer.id === selected?.id) continue;
      targets.vertical.push(box.x, box.x + box.w / 2, box.x + box.w);
      targets.horizontal.push(box.y, box.y + box.h / 2, box.y + box.h);
    }
    return { content, gut, activeBox, targets };
  }, [collage, preview, selected?.id]);

  const commit = useCallback(
    (transform: { tx: number; ty: number; scale: number }) => {
      if (!selected || !geometry?.activeBox) return;
      const layer = collage.layers.find((l) => l.id === selected.id);
      if (!layer) return;
      const box = geometry.activeBox;
      const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
      const { tx, ty, scale } = transform;

      apply((current) => ({
        ...current,
        layers: current.layers.map((l) => {
          if (l.id !== layer.id) return l;
          return selected.mode === 'frame'
            ? commitFrame(l, box, centre, transform, geometry.content, geometry.gut, photosById, images)
            : commitCrop(l, box, centre, { tx, ty, scale }, photosById, images);
        }),
      }));
    },
    [apply, collage.layers, geometry, images, photosById, selected]
  );

  const handleTap = useCallback(
    (x: number, y: number) => {
      const layer = hitTest(collage, preview, x, y);
      if (!layer) {
        setSelected(null);
        return;
      }
      tick();
      setSelected((current) =>
        current?.id === layer.id
          ? { id: layer.id, mode: current.mode === 'frame' ? 'crop' : 'frame' }
          : { id: layer.id, mode: 'frame' }
      );
    },
    [collage, preview]
  );

  const handleDoubleTap = useCallback(
    (x: number, y: number) => {
      const layer = hitTest(collage, preview, x, y);
      if (!layer) return;
      tick();
      apply((current) => ({
        ...current,
        layers: current.layers.map((l) =>
          l.id === layer.id
            ? { ...l, crop: { ...l.crop, fit: l.crop.fit === 'cover' ? 'contain' : 'cover', offsetX: 0, offsetY: 0 } }
            : l
        ),
      }));
    },
    [apply, collage, preview]
  );

  const gesture = useMemo(() => {
    const target = selected;
    const box = geometry?.activeBox;
    const targets = geometry?.targets;
    const threshold = preview.width * SNAP_THRESHOLD_RATIO;

    const begin = () => {
      'worklet';
      if (!target) return;
      activeGestures.value += 1;
      if (!live.value) live.value = { layerId: target.id, mode: target.mode, tx: 0, ty: 0, scale: 1 };
    };
    const finish = () => {
      'worklet';
      activeGestures.value = Math.max(0, activeGestures.value - 1);
      if (activeGestures.value > 0 || !live.value) return;
      const { tx, ty, scale } = live.value;
      live.value = null;
      if (tx !== 0 || ty !== 0 || scale !== 1) runOnJS(commit)({ tx, ty, scale });
    };

    const pan = Gesture.Pan()
      .averageTouches(true)
      .onBegin(begin)
      .onUpdate((e) => {
        'worklet';
        if (!live.value) return;
        let tx = e.translationX;
        let ty = e.translationY;
        // Frames snap to guides; a crop inside a frame has nothing to snap to.
        if (target?.mode === 'frame' && box && targets) {
          tx += snapDelta([box.x + tx, box.x + box.w / 2 + tx, box.x + box.w + tx], targets.vertical, threshold);
          ty += snapDelta([box.y + ty, box.y + box.h / 2 + ty, box.y + box.h + ty], targets.horizontal, threshold);
        }
        live.value = { ...live.value, tx, ty };
      })
      .onFinalize(finish);

    const pinch = Gesture.Pinch()
      .onBegin(begin)
      .onUpdate((e) => {
        'worklet';
        if (!live.value) return;
        live.value = { ...live.value, scale: e.scale };
      })
      .onFinalize(finish);

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDistance(16)
      .onEnd((e) => {
        'worklet';
        runOnJS(handleDoubleTap)(e.x, e.y);
      });

    const tap = Gesture.Tap()
      .maxDistance(16)
      .onEnd((e) => {
        'worklet';
        runOnJS(handleTap)(e.x, e.y);
      });

    return Gesture.Simultaneous(pan, pinch, Gesture.Exclusive(doubleTap, tap));
  }, [activeGestures, commit, geometry, handleDoubleTap, handleTap, live, preview.width, selected]);

  const exportCollage = useCallback(async () => {
    setBusy(true);
    try {
      const result = await renderCollage(collage, photosById, images);
      await saveToGallery(result.uri).catch(() => {});
      const share = await shareToInstagramStory(result.uri);
      if (share === 'no-instagram') {
        Alert.alert(
          'In der Galerie gespeichert',
          'Instagram ließ sich nicht öffnen — die Collage liegt aber in deinen Fotos.'
        );
      }
    } catch (error) {
      Alert.alert('Das hat nicht geklappt', String(error));
    } finally {
      setBusy(false);
    }
  }, [collage, images, photosById]);

  const setBackground = useCallback(
    (color: string) => apply((c) => ({ ...c, background: { kind: 'color', color } })),
    [apply]
  );

  const useBlurredBackground = useCallback(() => {
    apply((c) => {
      const current = c.background;
      const index =
        current.kind === 'photo' ? (photos.findIndex((p) => p.id === current.photoId) + 1) % photos.length : 0;
      const photo = photos[index];
      if (!photo) return c;
      return { ...c, background: { kind: 'photo', photoId: photo.id, blur: 0.5, dim: 0.25 } };
    });
  }, [apply, photos]);

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Button label="Fotos" tone="quiet" onPress={onPickPhotos} />
        <View style={styles.topRight}>
          <IconToggle
            label="Hilfslinien"
            active={showSafeZone}
            onPress={() => setShowSafeZone((v) => !v)}
          />
          <Button label="Rückgängig" tone="quiet" onPress={undo} style={{ opacity: canUndo ? 1 : 0.35 }} />
        </View>
      </View>

      <View
        style={styles.stage}
        onLayout={(e) =>
          setAvailable({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
        }
      >
        {preview.width > 0 ? (
          <GestureDetector gesture={gesture}>
            <Canvas style={{ width: preview.width, height: preview.height }}>
              <CollageScene
                collage={collage}
                photos={photosById}
                images={images}
                size={preview}
                live={live}
                selectedId={selected?.id ?? null}
                showSafeZone={showSafeZone}
              />
            </Canvas>
          </GestureDetector>
        ) : null}
      </View>

      <Toolbar>
        {selectedLayer && selected ? (
          <Text style={styles.hint}>
            {selected.mode === 'crop'
              ? 'Ausschnitt: schieben und zoomen im Rahmen · nochmal tippen für den Rahmen'
              : 'Rahmen: schieben und zoomen · nochmal tippen für den Ausschnitt'}
          </Text>
        ) : (
          <Text style={styles.hint}>Tippe ein Bild an, um es anzupassen</Text>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
          {STYLE_ORDER.map((name) => (
            <View key={name} style={{ marginRight: 8 }}>
              <Chip
                label={STYLES[name].label}
                active={style === name}
                onPress={() => {
                  tick();
                  apply((c) => applyStyle(c, name));
                }}
              />
            </View>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
          <Pressable onPress={useBlurredBackground} style={[styles.swatch, styles.swatchPhoto]}>
            <Text style={styles.swatchPhotoLabel}>Foto</Text>
          </Pressable>
          {[...palette, '#F3EDE3', '#12100E'].map((color) => (
            <Pressable
              key={color}
              onPress={() => setBackground(color)}
              style={[
                styles.swatch,
                { backgroundColor: color },
                collage.background.kind === 'color' && collage.background.color === color
                  ? styles.swatchActive
                  : null,
              ]}
            />
          ))}
        </ScrollView>

        {showSliders ? (
          <>
            <Slider
              label="Fuge"
              value={collage.gap}
              onChange={(v) => apply((c) => ({ ...c, gap: v }), { history: false })}
              onCommit={(v) => apply((c) => ({ ...c, gap: v }))}
            />
            <Slider
              label="Rand"
              value={collage.margin}
              onChange={(v) => apply((c) => ({ ...c, margin: v }), { history: false })}
              onCommit={(v) => apply((c) => ({ ...c, margin: v }))}
            />
            <Slider
              label="Rundung"
              value={collage.radius}
              onChange={(v) => apply((c) => ({ ...c, radius: v }), { history: false })}
              onCommit={(v) => apply((c) => ({ ...c, radius: v }))}
            />
            <Slider
              label="Streuung"
              value={collage.scatter}
              onChange={(v) => apply((c) => ({ ...c, scatter: v }), { history: false })}
              onCommit={(v) => apply((c) => ({ ...c, scatter: v }))}
            />
            <View style={styles.row}>
              <IconToggle
                label="Sicherheitsrand"
                active={collage.respectSafeZone}
                onPress={() => apply((c) => ({ ...c, respectSafeZone: !c.respectSafeZone }))}
              />
            </View>
          </>
        ) : null}

        <View style={styles.actions}>
          <Button label="Würfeln" onPress={() => { tick(); shuffle(); }} />
          <Button
            label={showSliders ? 'Regler zu' : 'Regler'}
            onPress={() => setShowSliders((v) => !v)}
          />
          <Button label={busy ? 'Rendert …' : 'Zu Instagram'} tone="primary" onPress={exportCollage} style={{ flex: 1 }} />
        </View>
      </Toolbar>
    </View>
  );
}

/** Applies a finished frame gesture: the box moves and scales, the crop follows. */
function commitFrame(
  layer: Layer,
  box: { x: number; y: number; w: number; h: number },
  centre: { x: number; y: number },
  { tx, ty, scale }: { tx: number; ty: number; scale: number },
  content: { x: number; y: number; w: number; h: number },
  gut: number,
  photosById: Record<string, Photo>,
  images: Record<string, { width(): number; height(): number }>
): Layer {
  const moved = {
    x: centre.x + (box.x - centre.x) * scale + tx,
    y: centre.y + (box.y - centre.y) * scale + ty,
    w: box.w * scale,
    h: box.h * scale,
  };
  const frame = rectToFrame(moved, content, gut, layer.frame.rotation);
  const image = images[layer.photoId];
  const aspect = image
    ? image.width() / image.height()
    : (photosById[layer.photoId]?.width ?? 1) / (photosById[layer.photoId]?.height ?? 1);
  return { ...layer, frame, crop: clampCrop(layer.crop, moved, aspect) };
}

/** Applies a finished crop gesture by inverting `imageDestRect`. */
function commitCrop(
  layer: Layer,
  box: { x: number; y: number; w: number; h: number },
  centre: { x: number; y: number },
  { tx, ty, scale }: { tx: number; ty: number; scale: number },
  photosById: Record<string, Photo>,
  images: Record<string, { width(): number; height(): number }>
): Layer {
  const image = images[layer.photoId];
  const aspect = image
    ? image.width() / image.height()
    : (photosById[layer.photoId]?.width ?? 1) / (photosById[layer.photoId]?.height ?? 1);

  const dest = imageDestRect(aspect, box, layer.crop);
  const movedX = centre.x + (dest.x - centre.x) * scale + tx;
  const movedY = centre.y + (dest.y - centre.y) * scale + ty;

  const zoomed = { ...layer.crop, scale: layer.crop.scale * scale, offsetX: 0, offsetY: 0 };
  const fitted = imageDestRect(aspect, box, zoomed);
  const crop = {
    ...zoomed,
    offsetX: (movedX - fitted.x) / box.w,
    offsetY: (movedY - fitted.y) / box.h,
  };
  return { ...layer, crop: clampCrop(crop, box, aspect) };
}

function IconToggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, active && styles.toggleActive]}>
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  hint: { color: theme.textDim, fontSize: 12, textAlign: 'center', paddingBottom: 8 },
  row: { flexGrow: 0, paddingBottom: 10 },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.line,
  },
  swatchActive: { borderColor: theme.accent, borderWidth: 2 },
  swatchPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceHigh },
  swatchPhotoLabel: { color: theme.textDim, fontSize: 10, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 10, paddingBottom: 6 },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
  },
  toggleActive: { backgroundColor: theme.surfaceHigh, borderColor: theme.surfaceHigh },
  toggleLabel: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
  toggleLabelActive: { color: theme.text },
});
