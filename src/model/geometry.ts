/**
 * The single source of truth for where things end up on the canvas.
 *
 * The editor preview and the 1080x1920 export both go through these functions,
 * which is what makes "what you see is what you post" true rather than
 * aspirational. Nothing here reads state — pass in a canvas size and you get
 * pixels for that size.
 */
import {
  CANVAS_SIZES,
  MAX_BORDER,
  MAX_GAP,
  MAX_MARGIN,
  MAX_SCATTER_DEG,
  SAFE_ZONE,
  type Collage,
  type Crop,
  type Frame,
  type Layer,
  type Rect,
  type Size,
} from './collage';

/** Gutter width in canvas pixels, driven by the gap slider. */
export function gutter(collage: Collage, canvas: Size): number {
  return collage.gap * MAX_GAP * Math.min(canvas.width, canvas.height);
}

/** Outer border in canvas pixels, driven by the margin slider. */
export function margin(collage: Collage, canvas: Size): number {
  return collage.margin * MAX_MARGIN * Math.min(canvas.width, canvas.height);
}

/**
 * The area layers are positioned within.
 *
 * Expanded by half a gutter so that the half-gutter every layer gives back in
 * `layerRect` cancels out at the edges. That way the outer border is exactly
 * `margin` — zero when the collage is meant to run off the edge — while
 * neighbouring photos still sit a full gutter apart.
 */
export function contentRect(collage: Collage, canvas: Size): Rect {
  const top = collage.respectSafeZone ? canvas.height * SAFE_ZONE.top : 0;
  const bottom = collage.respectSafeZone ? canvas.height * SAFE_ZONE.bottom : 0;
  const m = margin(collage, canvas);
  const half = gutter(collage, canvas) / 2;
  return {
    x: m - half,
    y: top + m - half,
    w: Math.max(1, canvas.width - m * 2 + half * 2),
    h: Math.max(1, canvas.height - top - bottom - m * 2 + half * 2),
  };
}

/** A layer's box in canvas pixels, gutter applied. */
export function layerRect(frame: Frame, content: Rect, gut: number): Rect {
  const half = gut / 2;
  return {
    x: content.x + frame.x * content.w + half,
    y: content.y + frame.y * content.h + half,
    w: Math.max(1, frame.w * content.w - gut),
    h: Math.max(1, frame.h * content.h - gut),
  };
}

/** Inverse of `layerRect`, for turning a dragged pixel box back into a frame. */
export function rectToFrame(rect: Rect, content: Rect, gut: number, rotation: number): Frame {
  const half = gut / 2;
  return {
    x: (rect.x - half - content.x) / content.w,
    y: (rect.y - half - content.y) / content.h,
    w: (rect.w + gut) / content.w,
    h: (rect.h + gut) / content.h,
    rotation,
  };
}

/**
 * Stable pseudo-random value in [-1, 1] derived from a layer id, so the scatter
 * slider stays live and reproducible instead of re-rolling on every render.
 */
function jitter(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

export function layerAngle(layer: Layer, scatter: number): number {
  return layer.frame.rotation + jitter(layer.id) * scatter * MAX_SCATTER_DEG;
}

export function cornerRadius(radius: number, rect: Rect): number {
  return (radius * Math.min(rect.w, rect.h)) / 2;
}

/** Width of the white paper border around each photo, in canvas pixels. */
export function borderWidth(collage: Collage, canvas: Size): number {
  return collage.border * MAX_BORDER * Math.min(canvas.width, canvas.height);
}

/**
 * Drop shadow parameters in canvas pixels, so a shadow looks the same in the
 * preview and in the 1080x1920 export.
 */
export function shadowSpec(collage: Collage, canvas: Size) {
  const short = Math.min(canvas.width, canvas.height);
  return {
    blur: collage.shadow * 0.026 * short,
    dy: collage.shadow * 0.010 * short,
    opacity: collage.shadow * 0.38,
  };
}

/** Shrinks a rect on all sides, never past zero size. */
export function insetRect(rect: Rect, by: number): Rect {
  const dx = Math.min(by, rect.w / 2 - 0.5);
  const dy = Math.min(by, rect.h / 2 - 0.5);
  return { x: rect.x + dx, y: rect.y + dy, w: rect.w - dx * 2, h: rect.h - dy * 2 };
}

/**
 * Where the photo is drawn, in canvas pixels. May extend well past `rect` —
 * the caller clips to the rounded frame.
 */
export function imageDestRect(imageAspect: number, rect: Rect, crop: Crop): Rect {
  const rectAspect = rect.w / rect.h;
  const matchHeight = crop.fit === 'cover' ? imageAspect > rectAspect : imageAspect <= rectAspect;
  let w: number;
  let h: number;
  if (matchHeight) {
    h = rect.h;
    w = h * imageAspect;
  } else {
    w = rect.w;
    h = w / imageAspect;
  }
  w *= crop.scale;
  h *= crop.scale;
  return {
    x: rect.x + (rect.w - w) / 2 + crop.offsetX * rect.w,
    y: rect.y + (rect.h - h) / 2 + crop.offsetY * rect.h,
    w,
    h,
  };
}

/** Keeps a `cover` crop from exposing the frame's background when panned. */
export function clampCrop(crop: Crop, rect: Rect, imageAspect: number): Crop {
  const scale = Math.max(crop.fit === 'cover' ? 1 : 0.2, Math.min(6, crop.scale));
  const dest = imageDestRect(imageAspect, rect, { ...crop, scale });
  if (crop.fit === 'contain') return { ...crop, scale };
  const slackX = Math.max(0, (dest.w - rect.w) / 2 / rect.w);
  const slackY = Math.max(0, (dest.h - rect.h) / 2 / rect.h);
  return {
    ...crop,
    scale,
    offsetX: Math.max(-slackX, Math.min(slackX, crop.offsetX)),
    offsetY: Math.max(-slackY, Math.min(slackY, crop.offsetY)),
  };
}

/**
 * A layer reduced to what a hit test needs. Precomputed in JS so the same test
 * can run inside a gesture worklet, where the collage itself is not available.
 */
export type HitBox = {
  id: string;
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  sin: number;
  cos: number;
};

export function layerHitBoxes(collage: Collage, canvas: Size): HitBox[] {
  const content = contentRect(collage, canvas);
  const gut = gutter(collage, canvas);
  return collage.layers.map((layer) => {
    const box = layerRect(layer.frame, content, gut);
    const angle = (layerAngle(layer, collage.scatter) * Math.PI) / 180;
    return {
      id: layer.id,
      cx: box.x + box.w / 2,
      cy: box.y + box.h / 2,
      hw: box.w / 2,
      hh: box.h / 2,
      sin: Math.sin(angle),
      cos: Math.cos(angle),
    };
  });
}

/** Id of the topmost box under a point, or null. Safe to call on the UI thread. */
export function pickAt(boxes: HitBox[], px: number, py: number): string | null {
  'worklet';
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    const dx = px - b.cx;
    const dy = py - b.cy;
    const lx = dx * b.cos + dy * b.sin;
    const ly = -dx * b.sin + dy * b.cos;
    if (Math.abs(lx) <= b.hw && Math.abs(ly) <= b.hh) return b.id;
  }
  return null;
}

/** Topmost layer under a point, or null. */
export function hitTest(collage: Collage, canvas: Size, px: number, py: number): Layer | null {
  const id = pickAt(layerHitBoxes(collage, canvas), px, py);
  return collage.layers.find((l) => l.id === id) ?? null;
}

export function canvasSize(collage: Collage): Size {
  return CANVAS_SIZES[collage.canvas];
}

/** Screen size that fits the collage's aspect ratio inside `available`. */
export function fitCanvas(collage: Collage, available: Size): Size {
  const target = canvasSize(collage);
  const scale = Math.min(available.width / target.width, available.height / target.height);
  return { width: target.width * scale, height: target.height * scale };
}
