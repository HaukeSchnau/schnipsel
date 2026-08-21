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
import { Blur, Fill, Group, Image, rect, rrect, Rect, RoundedRect } from '@shopify/react-native-skia';
import type { SkImage, Transforms3d } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { SAFE_ZONE, type Collage, type Layer, type Photo, type Size } from '../model/collage';
import {
  contentRect,
  cornerRadius,
  gutter,
  imageDestRect,
  layerAngle,
  layerRect,
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

export type CollageSceneProps = {
  collage: Collage;
  photos: Record<string, Photo>;
  images: ImageMap;
  size: Size;
  /** Editor only. Omit for a static render such as the export. */
  live?: SharedValue<LiveTransform>;
  selectedId?: string | null;
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
  showSafeZone,
}: CollageSceneProps) {
  const content = contentRect(collage, size);
  const gut = gutter(collage, size);
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

      {selectedId
        ? (() => {
            const layer = collage.layers.find((l) => l.id === selectedId);
            if (!layer) return null;
            const box = layerRect(layer.frame, content, gut);
            return (
              <RoundedRect
                rect={rrect(rect(box.x, box.y, box.w, box.h), cornerRadius(collage.radius, box), cornerRadius(collage.radius, box))}
                style="stroke"
                strokeWidth={Math.max(1.5, size.width * 0.004)}
                color="#F7E7CE"
                origin={{ x: box.x + box.w / 2, y: box.y + box.h / 2 }}
                transform={[{ rotate: (layerAngle(layer, collage.scatter) * Math.PI) / 180 }]}
              />
            );
          })()
        : null}

      {showSafeZone && collage.respectSafeZone ? <SafeZone size={size} /> : null}
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
  live,
}: {
  layer: Layer;
  image: SkImage;
  box: { x: number; y: number; w: number; h: number };
  radius: number;
  angle: number;
  live?: SharedValue<LiveTransform>;
}) {
  const dest = imageDestRect(image.width() / image.height(), box, layer.crop);
  const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const photo = <Image image={image} fit="fill" x={dest.x} y={dest.y} width={dest.w} height={dest.h} />;

  return (
    <Group
      transform={[{ rotate: (angle * Math.PI) / 180 }]}
      origin={centre}
      clip={rrect(rect(box.x, box.y, box.w, box.h), radius, radius)}
    >
      {live ? (
        <LiveCrop layerId={layer.id} centre={centre} live={live}>
          {photo}
        </LiveCrop>
      ) : (
        photo
      )}
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

function SafeZone({ size }: { size: Size }) {
  const top = size.height * SAFE_ZONE.top;
  const bottom = size.height * SAFE_ZONE.bottom;
  return (
    <Group>
      <Rect x={0} y={0} width={size.width} height={top} color="rgba(0,0,0,0.35)" />
      <Rect x={0} y={size.height - bottom} width={size.width} height={bottom} color="rgba(0,0,0,0.35)" />
    </Group>
  );
}
