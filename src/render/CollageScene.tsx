/**
 * The collage, drawn.
 *
 * This component is the whole reason preview and export can't drift apart:
 * the editor puts it in a <Canvas>, the exporter hands the exact same element
 * to Skia's offscreen renderer at 1080x1920, and both walk the same geometry
 * functions. The only difference is the canvas size passed in.
 *
 * Gestures are the one wrinkle. Committing every frame of a pinch to React
 * state would put the JS thread in the middle of the interaction, so a live
 * gesture is applied as a transform read straight off a shared value on the UI
 * thread. It is the identity transform at rest, which is what the exporter
 * sees, so this costs nothing in fidelity.
 */
import type { ReactNode } from 'react';
import {
  Blur,
  Fill,
  Group,
  Image,
  rect,
  rrect,
  Rect,
  RoundedRect,
  Shadow,
} from '@shopify/react-native-skia';
import type { SkImage, Transforms3d } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { SAFE_ZONE, type Collage, type Layer, type Photo, type Size } from '../model/collage';
import {
  borderWidth,
  contentRect,
  cornerRadius,
  gutter,
  imageDestRect,
  insetRect,
  layerAngle,
  layerRect,
  shadowSpec,
} from '../model/geometry';
import type { ImageMap } from './images';

/** A gesture in progress. `scale` is relative to the committed state. */
export type LiveTransform = {
  layerId: string;
  /** `frame` moves the photo's box, `crop` moves the photo inside its box. */
  mode: 'frame' | 'crop';
  tx: number;
  ty: number;
  scale: number;
} | null;

const IDENTITY: Transforms3d = [];

/** The paper a print is on. Slightly warm — pure white glares next to photos. */
const PAPER = '#FBF8F2';

export type CollageSceneProps = {
  collage: Collage;
  photos: Record<string, Photo>;
  images: ImageMap;
  size: Size;
  /** Editor only. Omit for a static render such as the export. */
  live?: SharedValue<LiveTransform>;
  selectedId?: string | null;
  /** Long-press-and-drag in progress: which photo is moving, and where to. */
  swap?: { sourceId: string | null; targetId: string | null };
  /** Dims the strips Instagram covers with its own UI. */
  showSafeZone?: boolean;
};

export function CollageScene({
  collage,
  photos,
  images,
  size,
  live,
  selectedId,
  swap,
  showSafeZone,
}: CollageSceneProps) {
  const content = contentRect(collage, size);
  const gut = gutter(collage, size);
  const border = borderWidth(collage, size);
  const shadow = shadowSpec(collage, size);
  const background = collage.background;
  const backgroundImage = background.kind === 'photo' ? images[background.photoId] : undefined;

  return (
    <Group>
      <Fill color={background.kind === 'color' ? background.color : '#000000'} />

      {backgroundImage && background.kind === 'photo' ? (
        <>
          {/* Oversized so the blur has pixels to reach for at the edges. */}
          <Image
            image={backgroundImage}
            fit="cover"
            x={-size.width * 0.08}
            y={-size.height * 0.08}
            width={size.width * 1.16}
            height={size.height * 1.16}
          >
            <Blur blur={background.blur * 0.06 * Math.min(size.width, size.height)} />
          </Image>
          <Rect
            x={0}
            y={0}
            width={size.width}
            height={size.height}
            color={`rgba(0,0,0,${background.dim})`}
          />
        </>
      ) : null}

      {collage.layers.map((layer) => {
        const image = images[layer.photoId];
        if (!image) return null;
        const box = layerRect(layer.frame, content, gut);
        const radius = cornerRadius(collage.radius, box);
        const angle = layerAngle(layer, collage.scatter);
        const body = (
          <LayerBody
            layer={layer}
            image={image}
            box={box}
            radius={radius}
            angle={angle}
            border={border}
            shadow={shadow}
            live={live}
          />
        );
        return live ? (
          <LiveGroup key={layer.id} layerId={layer.id} box={box} live={live}>
            {body}
          </LiveGroup>
        ) : (
          <Group key={layer.id}>{body}</Group>
        );
      })}

      {selectedId && !swap?.sourceId ? (
        <LayerMarker collage={collage} layerId={selectedId} size={size} kind="selection" />
      ) : null}

      {swap?.sourceId ? (
        <LayerMarker collage={collage} layerId={swap.sourceId} size={size} kind="source" />
      ) : null}
      {swap?.targetId && swap.targetId !== swap.sourceId ? (
        <LayerMarker collage={collage} layerId={swap.targetId} size={size} kind="target" />
      ) : null}

      {/* Independent of `respectSafeZone`: the guide matters most when the
          collage *does* run under Instagram's bars. */}
      {showSafeZone ? <SafeZone size={size} /> : null}
    </Group>
  );
}

/**
 * Editor-only overlay marking a layer: the current selection, the photo being
 * dragged, or the slot it would land in. Drawn from the collage rather than
 * passed a rect so it always lines up with what the layer itself did.
 */
function LayerMarker({
  collage,
  layerId,
  size,
  kind,
}: {
  collage: Collage;
  layerId: string;
  size: Size;
  kind: 'selection' | 'source' | 'target';
}) {
  const layer = collage.layers.find((l) => l.id === layerId);
  if (!layer) return null;
  const content = contentRect(collage, size);
  const box = layerRect(layer.frame, content, gutter(collage, size));
  const radius = cornerRadius(collage.radius, box);
  const shape = rrect(rect(box.x, box.y, box.w, box.h), radius, radius);
  const transform: Transforms3d = [
    { rotate: (layerAngle(layer, collage.scatter) * Math.PI) / 180 },
  ];
  const origin = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const stroke = Math.max(1.5, size.width * (kind === 'selection' ? 0.004 : 0.008));

  return (
    <Group transform={transform} origin={origin}>
      {kind === 'target' ? (
        <RoundedRect rect={shape} color="rgba(247,231,206,0.3)" />
      ) : null}
      <RoundedRect
        rect={shape}
        style="stroke"
        strokeWidth={stroke}
        color={kind === 'source' ? 'rgba(247,231,206,0.55)' : '#F7E7CE'}
      />
    </Group>
  );
}

/** Applies the in-progress frame gesture. Identity when nothing is happening. */
function LiveGroup({
  layerId,
  box,
  live,
  children,
}: {
  layerId: string;
  box: { x: number; y: number; w: number; h: number };
  live: SharedValue<LiveTransform>;
  children: ReactNode;
}) {
  const transform = useDerivedValue<Transforms3d>(() => {
    const l = live.value;
    if (!l || l.layerId !== layerId || l.mode !== 'frame') return IDENTITY;
    return [{ translateX: l.tx }, { translateY: l.ty }, { scale: l.scale }];
  }, [live, layerId]);

  return (
    <Group transform={transform} origin={{ x: box.x + box.w / 2, y: box.y + box.h / 2 }}>
      {children}
    </Group>
  );
}

function LayerBody({
  layer,
  image,
  box,
  radius,
  angle,
  border,
  shadow,
  live,
}: {
  layer: Layer;
  image: SkImage;
  box: { x: number; y: number; w: number; h: number };
  radius: number;
  angle: number;
  border: number;
  shadow: { blur: number; dy: number; opacity: number };
  live?: SharedValue<LiveTransform>;
}) {
  // The photo sits inside the paper, so everything about it — how it fills the
  // frame, where it is clipped — is measured against the inner rect.
  const inner = border > 0 ? insetRect(box, border) : box;
  const innerRadius = Math.max(0, radius - border);
  const dest = imageDestRect(image.width() / image.height(), inner, layer.crop);
  const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const card = rrect(rect(box.x, box.y, box.w, box.h), radius, radius);
  const photo = <Image image={image} fit="fill" x={dest.x} y={dest.y} width={dest.w} height={dest.h} />;

  return (
    <Group transform={[{ rotate: (angle * Math.PI) / 180 }]} origin={centre}>
      {shadow.opacity > 0 ? (
        // `shadowOnly` so the black source rect never shows through the
        // antialiased edge of the photo drawn over it.
        <RoundedRect rect={card} color="black">
          <Shadow
            dx={0}
            dy={shadow.dy}
            blur={shadow.blur}
            color={`rgba(0,0,0,${shadow.opacity.toFixed(3)})`}
            shadowOnly
          />
        </RoundedRect>
      ) : null}
      {border > 0 ? <RoundedRect rect={card} color={PAPER} /> : null}
      <Group clip={rrect(rect(inner.x, inner.y, inner.w, inner.h), innerRadius, innerRadius)}>
        {live ? (
          <LiveCrop layerId={layer.id} centre={centre} live={live}>
            {photo}
          </LiveCrop>
        ) : (
          photo
        )}
      </Group>
    </Group>
  );
}

/** Applies the in-progress crop gesture, inside the frame's clip. */
function LiveCrop({
  layerId,
  centre,
  live,
  children,
}: {
  layerId: string;
  centre: { x: number; y: number };
  live: SharedValue<LiveTransform>;
  children: ReactNode;
}) {
  const transform = useDerivedValue<Transforms3d>(() => {
    const l = live.value;
    if (!l || l.layerId !== layerId || l.mode !== 'crop') return IDENTITY;
    return [{ translateX: l.tx }, { translateY: l.ty }, { scale: l.scale }];
  }, [live, layerId]);

  return (
    <Group transform={transform} origin={centre}>
      {children}
    </Group>
  );
}

/**
 * Shows what Instagram covers with its own account bar and reply bar. A light
 * tint plus a hairline, not a heavy mask — it has to read as a guide laid over
 * the picture rather than as part of it.
 */
function SafeZone({ size }: { size: Size }) {
  const top = size.height * SAFE_ZONE.top;
  const bottom = size.height * SAFE_ZONE.bottom;
  const hairline = Math.max(1, size.height * 0.0012);
  return (
    <Group>
      <Rect x={0} y={0} width={size.width} height={top} color="rgba(0,0,0,0.22)" />
      <Rect x={0} y={top} width={size.width} height={hairline} color="rgba(255,255,255,0.5)" />
      <Rect
        x={0}
        y={size.height - bottom}
        width={size.width}
        height={bottom}
        color="rgba(0,0,0,0.22)"
      />
      <Rect
        x={0}
        y={size.height - bottom - hairline}
        width={size.width}
        height={hairline}
        color="rgba(255,255,255,0.5)"
      />
    </Group>
  );
}
