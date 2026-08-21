/**
 * Renders the layout catalogue to SVG, using the app's own geometry functions.
 *
 * The whole point is to be able to judge how the layouts look without waiting
 * on an APK: the collage skeleton is pure maths, so it draws fine here. What it
 * can't show is how photos read inside the slots — only the composition.
 *
 *   bun scripts/layout-sheet.ts <output-dir>
 */
import { emptyCollage, type Collage, type Layer, type Size } from '../src/model/collage';
import {
  contentRect,
  cornerRadius,
  gutter,
  layerAngle,
  layerRect,
} from '../src/model/geometry';
import { RECIPES, layersFrom, suggestLayouts } from '../src/model/layout';
import { applyStyle, STYLES, STYLE_ORDER, type StyleName } from '../src/model/styles';

const STORY: Size = { width: 1080, height: 1920 };
const SCALE = 0.15;

const INK = ['#c2643f', '#7d8c5c', '#4a6b7c', '#b08442', '#8a6a86', '#6b7f6b'];

function layersFromRecipe(recipeId: string): Layer[] {
  const recipe = RECIPES.find((r) => r.id === recipeId)!;
  return recipe.slots.map((slot, i) => ({
    id: `${recipeId}:${i}`,
    photoId: `p${i}`,
    frame: { ...slot, rotation: 0 },
    crop: { fit: 'cover' as const, scale: 1, offsetX: 0, offsetY: 0 },
  }));
}

function svg(collage: Collage, labels?: string[]): string {
  const w = STORY.width * SCALE;
  const h = STORY.height * SCALE;
  const content = contentRect(collage, STORY);
  const gut = gutter(collage, STORY);
  const bg = collage.background.kind === 'color' ? collage.background.color : '#333';

  const cells = collage.layers
    .map((layer, i) => {
      const r = layerRect(layer.frame, content, gut);
      const radius = cornerRadius(collage.radius, r);
      const angle = layerAngle(layer, collage.scatter);
      const cx = (r.x + r.w / 2) * SCALE;
      const cy = (r.y + r.h / 2) * SCALE;
      const label = labels?.[i] ?? String(i + 1);
      return `<g transform="rotate(${angle.toFixed(2)} ${cx.toFixed(1)} ${cy.toFixed(1)})">
        <rect x="${(r.x * SCALE).toFixed(1)}" y="${(r.y * SCALE).toFixed(1)}"
              width="${(r.w * SCALE).toFixed(1)}" height="${(r.h * SCALE).toFixed(1)}"
              rx="${(radius * SCALE).toFixed(1)}" fill="${INK[i % INK.length]}" />
        <text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle"
              font-family="system-ui" font-size="11" fill="#fff" opacity="0.85">${label}</text>
      </g>`;
    })
    .join('\n');

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${bg}" />
    ${cells}
  </svg>`;
}

function tile(title: string, subtitle: string, body: string): string {
  return `<figure><div class="frame">${body}</div>
    <figcaption><b>${title}</b><span>${subtitle}</span></figcaption></figure>`;
}

/** Photo mixes that actually turn up: all portrait, a landscape thrown in, etc. */
const MIXES: { label: string; aspects: number[] }[] = [
  { label: '2 Hochformate', aspects: [3 / 4, 3 / 4] },
  { label: '1 quer, 1 hoch', aspects: [16 / 9, 3 / 4] },
  { label: '3 Hochformate', aspects: [3 / 4, 3 / 4, 3 / 4] },
  { label: '2 hoch, 1 quer', aspects: [3 / 4, 16 / 9, 3 / 4] },
  { label: '3 quer', aspects: [3 / 2, 3 / 2, 3 / 2] },
  { label: '4 gemischt', aspects: [3 / 4, 16 / 9, 1, 3 / 4] },
  { label: '4 Hochformate', aspects: [3 / 4, 3 / 4, 3 / 4, 3 / 4] },
  { label: '5 gemischt', aspects: [3 / 4, 3 / 2, 3 / 4, 1, 16 / 9] },
  { label: '6 gemischt', aspects: [3 / 4, 3 / 2, 1, 3 / 4, 16 / 9, 1] },
];

function collageForMix(aspects: number[], style: StyleName): Collage {
  const base = applyStyle(emptyCollage('sheet'), style);
  const content = contentRect(base, STORY);
  const best = suggestLayouts(aspects, content.w / content.h)[0];
  return { ...base, layers: layersFrom(best, aspects.map((_, i) => `p${i}`)) };
}

const out = process.argv[2] ?? './layout-sheet';

const styleSections = STYLE_ORDER.map((name) => {
  const mix = [3 / 4, 16 / 9, 1, 3 / 4];
  const collage = collageForMix(mix, name);
  return tile(STYLES[name].label, STYLES[name].hint, svg(collage));
}).join('\n');

const mixSections = MIXES.map(({ label, aspects }) => {
  const collage = collageForMix(aspects, 'kante');
  const content = contentRect(collage, STORY);
  const best = suggestLayouts(aspects, content.w / content.h)[0];
  const labels = best.assignment.map((photoIndex) => {
    const a = aspects[photoIndex];
    return a > 1.2 ? 'quer' : a < 0.85 ? 'hoch' : '1:1';
  });
  return tile(label, best.recipe.id, svg(collage, labels));
}).join('\n');

const recipeSections = RECIPES.map((recipe) => {
  const collage = { ...applyStyle(emptyCollage('sheet'), 'kante'), layers: layersFromRecipe(recipe.id) };
  return tile(recipe.id, `${recipe.slots.length} Bilder`, svg(collage));
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Schnipsel — Layouts</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0 auto; padding: 2rem 1rem 4rem; max-width: 60rem;
    font: 15px/1.6 system-ui, sans-serif; color: #2f2a24; background: #fffdf8; }
  h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
  p.lead { color: #7a7264; margin: 0 0 2rem; }
  h2 { font-size: 1.1rem; margin: 2.5rem 0 .25rem; }
  p.note { color: #7a7264; margin: 0 0 1.25rem; font-size: .9rem; }
  .grid { display: grid; gap: 1.25rem;
    grid-template-columns: repeat(auto-fill, minmax(162px, 1fr)); }
  figure { margin: 0; }
  .frame { line-height: 0; border: 1px solid #e2dccf; border-radius: 4px; overflow: hidden; }
  svg { width: 100%; height: auto; display: block; }
  figcaption { font-size: .8rem; padding-top: .4rem; }
  figcaption b { display: block; }
  figcaption span { color: #7a7264; }
</style></head><body>
<h1>Schnipsel — Layouts</h1>
<p class="lead">Gerendert mit denselben Geometriefunktionen wie die App. Story-Format 1080×1920.</p>

<h2>Die vier Stile</h2>
<p class="note">Gleiche vier Bilder, gleiches Layout, nur andere Fugen und Ränder.</p>
<div class="grid">${styleSections}</div>

<h2>Was der Generator wählt</h2>
<p class="note">Je nach Seitenverhältnissen der Bilder, im Stil „Kante“. Beschriftung = Format des Bildes, das in den Slot kommt.</p>
<div class="grid">${mixSections}</div>

<h2>Alle Rezepte</h2>
<p class="note">Der ganze Katalog, aus dem gewählt wird.</p>
<div class="grid">${recipeSections}</div>
</body></html>`;

await Bun.write(`${out}/index.html`, html);
console.log(`geschrieben: ${out}/index.html`);
console.log(`Rezepte: ${RECIPES.length}, Mixe: ${MIXES.length}, Stile: ${STYLE_ORDER.length}`);
