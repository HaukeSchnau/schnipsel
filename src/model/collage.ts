/**
 * Schnipsel's document model.
 *
 * Two decisions shape everything else:
 *
 * 1. Positions are stored *relative* (0..1 of the content area), never in
 *    pixels. The same collage therefore renders to a 1080x1920 story and a
 *    1080x1350 feed post without touching a single layer.
 * 2. A grid is not a mode, it is a generator (see `layout.ts`). Layers always
 *    carry a free frame, so a tidy 3-up can be nudged into something playful
 *    without leaving the grid behind.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { width: number; height: number };

/** A layer's box, relative to the content area. `rotation` is in degrees. */
export type Frame = Rect & { rotation: number };

/** How the photo sits inside its frame. */
export type Crop = {
  /** `cover` fills the frame, `contain` letterboxes it. Double tap toggles. */
  fit: 'cover' | 'contain';
  /** Zoom on top of the fitted size. 1 = exactly fitted. */
  scale: number;
  /** Pan away from centred, in frame widths / heights. */
  offsetX: number;
  offsetY: number;
};

/** Array order is stacking order: later layers draw on top. */
export type Layer = {
  id: string;
  photoId: string;
  frame: Frame;
  crop: Crop;
};

export type Background =
  | { kind: 'color'; color: string }
  /** The classic: one of the photos, blown up and blurred behind the collage. */
  | { kind: 'photo'; photoId: string; blur: number; dim: number };

export type CanvasPreset = 'story' | 'post';

export type Collage = {
  id: string;
  layers: Layer[];
  background: Background;
  /** Gutter between photos. 0 = they touch. */
  gap: number;
  /**
   * Border around the whole collage. Separate from `gap` on purpose: a
   * full-bleed collage wants hairline gutters and *no* outer border, while a
   * print-style one wants a mat wider than its gutters. Tying them together
   * made every layout look like a card grid.
   */
  margin: number;
  /** 0 = square corners, 1 = fully rounded. */
  radius: number;
  /** 0 = accurate, 1 = shoebox of loose prints. */
  scatter: number;
  /** Keep layers clear of Instagram's own top and bottom bars. */
  respectSafeZone: boolean;
  canvas: CanvasPreset;
  updatedAt: number;
};

/** A photo the app has taken ownership of: downscaled and stored locally. */
export type Photo = {
  /** MediaLibrary asset id. On Android this is a `content://` URI. */
  id: string;
  /** Working copy in document storage — capped resolution, see photos/import.ts. */
  uri: string;
  width: number;
  height: number;
  /** Tiny copy used only for palette extraction. */
  swatchUri: string;
};

export const CANVAS_SIZES: Record<CanvasPreset, Size> = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 },
};

/**
 * Instagram draws its own chrome over the story: the account bar at the top and
 * the reply / share bar at the bottom. These are the fractions of canvas height
 * those bars cover — measured against the 1920px story, and deliberately
 * generous, because being a little too cautious costs nothing.
 */
export const SAFE_ZONE = { top: 250 / 1920, bottom: 310 / 1920 };

/** Largest gutter the gap slider can produce, as a fraction of the short edge. */
export const MAX_GAP = 0.05;
/** Largest outer border the margin slider can produce, same units. */
export const MAX_MARGIN = 0.12;
/** Largest scatter angle in degrees at `scatter === 1`. */
export const MAX_SCATTER_DEG = 7;

export const DEFAULT_CROP: Crop = { fit: 'cover', scale: 1, offsetX: 0, offsetY: 0 };

export function aspectOf(photo: Pick<Photo, 'width' | 'height'>) {
  return photo.width / photo.height;
}

/**
 * Full bleed, hairline gutters, square corners.
 *
 * The first version defaulted to keeping every photo inside the safe zone,
 * which left 29% of the story empty and — worse — made the layout generator
 * plan for a nearly square area instead of 9:16. Rounded corners over wide
 * gutters on a dark surface then finished the job of making the export look
 * like an app screenshot. The safe zone is a guide you switch on when you need
 * it, not the frame everything is built inside.
 */
export function emptyCollage(id: string): Collage {
  return {
    id,
    layers: [],
    background: { kind: 'color', color: '#F3EDE3' },
    gap: 0.08,
    margin: 0,
    radius: 0,
    scatter: 0,
    respectSafeZone: false,
    canvas: 'story',
    updatedAt: Date.now(),
  };
}
