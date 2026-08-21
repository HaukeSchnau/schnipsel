/**
 * Generates the app icon.
 *
 * The motif is what the app makes: paper prints with a white border, lying on
 * each other at slight angles, in the editor's palette — so the icon and the
 * output belong together.
 *
 * Android adaptive icons crop the foreground to a circle, a squircle or a
 * rounded square depending on the launcher, and only the middle 72 of 108 units
 * are guaranteed to survive. `reach()` checks that, because a clipped corner is
 * the kind of thing you only notice once it is on a phone.
 *
 *   bun scripts/make-icon.ts <output-dir>
 */
const SIZE = 1024;
/** Radius every launcher mask is guaranteed to keep. */
const SAFE = (SIZE * (72 / 108)) / 2;

const BG = '#17130F';
const PAPER = '#FBF8F2';
const PHOTO = ['#C2643F', '#7D8C5C', '#4A6B7C'];

type Print = { cx: number; cy: number; w: number; h: number; angle: number };

const BASE: Print[] = [
  { cx: 430, cy: 396, w: 300, h: 330, angle: -10 },
  { cx: 612, cy: 512, w: 286, h: 316, angle: 7 },
  { cx: 452, cy: 636, w: 300, h: 330, angle: -3 },
];

/** Scales the arrangement about the canvas centre. */
const fit = (scale: number): Print[] =>
  BASE.map((p) => ({
    cx: SIZE / 2 + (p.cx - SIZE / 2) * scale,
    cy: SIZE / 2 + (p.cy - SIZE / 2) * scale,
    w: p.w * scale,
    h: p.h * scale,
    angle: p.angle,
  }));

/** Adaptive layers stay inside the mask; the square fallback can breathe out. */
const ADAPTIVE = fit(0.92);
const SQUARE = fit(1.2);

/** Worst-case distance of a rotated rect's corner from the canvas centre. */
function reach({ cx, cy, w, h }: Print): number {
  return Math.hypot(cx - SIZE / 2, cy - SIZE / 2) + Math.hypot(w / 2, h / 2);
}

function rect(p: Print, inset: number, fill: string, filter = ''): string {
  return `<rect x="${(p.cx - p.w / 2 - inset).toFixed(1)}" y="${(p.cy - p.h / 2 - inset).toFixed(1)}"
      width="${(p.w + inset * 2).toFixed(1)}" height="${(p.h + inset * 2).toFixed(1)}"
      fill="${fill}"${filter} transform="rotate(${p.angle} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)})" />`;
}

/** The colour version: white paper, a photo inside it, a soft shadow under it. */
function colourScene(prints: Print[], border: number): string {
  return prints
    .map(
      (p, i) =>
        rect(p, 0, PAPER, ' filter="url(#drop)"') +
        rect({ ...p, w: p.w - border * 2, h: p.h - border * 2 }, 0, PHOTO[i % PHOTO.length])
    )
    .join('\n');
}

/**
 * The themed (monochrome) version is a single flat colour, so the prints can
 * only be told apart by gaps. Each print therefore punches a slightly inflated
 * hole in whatever lies beneath it before being drawn.
 */
function monoScene(prints: Print[], gap: number): string {
  const layers = prints
    .map((p) => `${rect(p, gap, '#000000')}\n${rect(p, 0, '#FFFFFF')}`)
    .join('\n');
  return `<mask id="prints" maskUnits="userSpaceOnUse" x="0" y="0" width="${SIZE}" height="${SIZE}">
      <rect width="${SIZE}" height="${SIZE}" fill="black" />
      ${layers}
    </mask>
    <rect width="${SIZE}" height="${SIZE}" fill="#FFFFFF" mask="url(#prints)" />`;
}

const DROP = `<defs><filter id="drop" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="10" stdDeviation="14" flood-opacity="0.35" />
  </filter></defs>`;

const svg = (body: string, background: string | null, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
${defs}${background ? `<rect width="${SIZE}" height="${SIZE}" fill="${background}" />` : ''}
${body}
</svg>`;

const out = process.argv[2] ?? './icon';

const worst = Math.max(...ADAPTIVE.map(reach));
if (worst > SAFE) {
  console.error(`FEHLER: Motiv ragt ${(worst - SAFE).toFixed(0)}px aus der sicheren Zone`);
  process.exit(1);
}

await Bun.write(`${out}/icon.svg`, svg(colourScene(SQUARE, 30), BG, DROP));
await Bun.write(`${out}/adaptive-foreground.svg`, svg(colourScene(ADAPTIVE, 26), null, DROP));
await Bun.write(`${out}/adaptive-monochrome.svg`, svg(monoScene(ADAPTIVE, 12), null));

console.log(`geschrieben nach ${out}`);
console.log(`sichere Zone Radius ${SAFE.toFixed(0)}px, Motiv reicht bis ${worst.toFixed(0)}px`);
