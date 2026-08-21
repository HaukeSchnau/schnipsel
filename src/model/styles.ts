/**
 * Four looks, one tap each.
 *
 * The first version shipped only raw sliders, which meant the default values
 * *were* the design — and the defaults were a card grid: wide gutters, 32px
 * rounded corners, dark surface. That reads as an Android app, not as a
 * collage. Presets let the look be chosen by eye instead of by guessing at
 * numbers, and every one of them starts from square corners.
 */
import type { Collage } from './collage';

export type StyleName = 'randlos' | 'kante' | 'passepartout' | 'abzuege' | 'schuhkarton';

/** Warm off-white. Pure #FFF reads as a blown-out highlight next to photos. */
const PAPER = '#F3EDE3';

type Style = {
  label: string;
  /** What it's for, in the one line that fits under a chip. */
  hint: string;
  settings: Pick<Collage, 'gap' | 'margin' | 'radius' | 'border' | 'shadow' | 'scatter'> & {
    background: Collage['background'];
  };
};

export const STYLES: Record<StyleName, Style> = {
  randlos: {
    label: 'Randlos',
    hint: 'Bilder stoßen aneinander, füllen die Story ganz aus',
    settings: {
      gap: 0,
      margin: 0,
      radius: 0,
      border: 0,
      shadow: 0,
      scatter: 0,
      background: { kind: 'color', color: PAPER },
    },
  },
  kante: {
    label: 'Kante',
    hint: 'Haarfeine Fugen, kein Rand',
    settings: {
      gap: 0.08,
      margin: 0,
      radius: 0,
      border: 0,
      shadow: 0,
      scatter: 0,
      background: { kind: 'color', color: PAPER },
    },
  },
  passepartout: {
    label: 'Passepartout',
    hint: 'Fugen und ein breiterer Rand aussen herum, wie ein Print',
    settings: {
      gap: 0.35,
      margin: 0.5,
      radius: 0,
      border: 0,
      shadow: 0,
      scatter: 0,
      background: { kind: 'color', color: PAPER },
    },
  },
  abzuege: {
    label: 'Abzüge',
    hint: 'Weiss gerahmte Abzüge, ausgerichtet',
    settings: {
      gap: 0.3,
      margin: 0.28,
      radius: 0.01,
      border: 0.55,
      shadow: 0.32,
      scatter: 0,
      background: { kind: 'color', color: PAPER },
    },
  },
  schuhkarton: {
    label: 'Schuhkarton',
    hint: 'Lose Abzüge, hingeworfen',
    settings: {
      gap: 0.5,
      margin: 0.22,
      radius: 0.01,
      border: 0.7,
      shadow: 0.68,
      scatter: 0.5,
      background: { kind: 'color', color: PAPER },
    },
  },
};

export const STYLE_ORDER: StyleName[] = [
  'randlos',
  'kante',
  'passepartout',
  'abzuege',
  'schuhkarton',
];

/** Applies a style, leaving layers and the safe-zone choice alone. */
export function applyStyle(collage: Collage, name: StyleName): Collage {
  return { ...collage, ...STYLES[name].settings };
}

/** Which style the collage currently matches, if any. */
export function currentStyle(collage: Collage): StyleName | null {
  return (
    STYLE_ORDER.find((name) => {
      const s = STYLES[name].settings;
      return (
        collage.gap === s.gap &&
        collage.margin === s.margin &&
        collage.radius === s.radius &&
        collage.border === s.border &&
        collage.shadow === s.shadow &&
        collage.scatter === s.scatter
      );
    }) ?? null
  );
}
