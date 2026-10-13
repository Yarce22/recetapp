#!/usr/bin/env node
/**
 * Generates every launcher, splash and favicon PNG from a single geometry and
 * palette source, so the mark can never drift between platforms.
 *
 * The SVGs it writes into assets/brand are the editable source of truth; the
 * PNGs in assets/images are build output that the stores consume. Both are
 * committed, because EAS Build never runs this script.
 *
 *   node scripts/generate-brand-assets.mjs
 *
 * Rasterizing needs sharp, which is pulled on demand through npx rather than
 * added as a dependency: it is a native module that only ever runs here.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SVG_DIR = join(MOBILE_ROOT, 'assets', 'brand');
const PNG_DIR = join(MOBILE_ROOT, 'assets', 'images');
const TMP_DIR = join(SVG_DIR, '.rasterized');

/**
 * Node refuses to spawn a .cmd shim directly since CVE-2024-27980, so npx has
 * to go through a shell on Windows, which in turn means quoting paths here:
 * spawn does not do it for shell invocations.
 */
const USE_SHELL = process.platform === 'win32';

function quote(argument) {
  return USE_SHELL && /\s/.test(argument) ? `"${argument}"` : argument;
}

const TERRACOTTA = '#B0462B';
const CREAM = '#F7EFE1';
const SAFFRON = '#E8A33D';

/** Source canvas both stores expect before they downscale it themselves. */
const CANVAS = 1024;

/**
 * Android composes adaptive icons from 108dp layers but only ever guarantees
 * the central 66dp circle survives masking, whatever shape the launcher picks.
 */
const ADAPTIVE_SAFE_RADIUS = (CANVAS * (66 / 108)) / 2;

/** The mark, laid out centred on the 1024 canvas. */
const JAR = {
  lid: { x: 296, y: 224, width: 432, height: 120, radius: 36 },
  wall: { x: 256, y: 344, width: 512, height: 456, radius: 76 },
  glass: { x: 300, y: 388, width: 424, height: 368, radius: 40 },
  contentsTop: 600,
  // Sized so the four points still read, rather than blur into a dot, at 48px.
  spark: { x: 608, y: 486, radius: 88 },
};

function roundedRect({ x, y, width, height, radius: r }) {
  return [
    `M${x + r},${y}`,
    `H${x + width - r}`,
    `A${r},${r} 0 0 1 ${x + width},${y + r}`,
    `V${y + height - r}`,
    `A${r},${r} 0 0 1 ${x + width - r},${y + height}`,
    `H${x + r}`,
    `A${r},${r} 0 0 1 ${x},${y + height - r}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    'Z',
  ].join(' ');
}

/** Four-point sparkle with concave sides, drawn from its centre outwards. */
function sparkle({ x, y, radius: r }) {
  return [
    `M${x},${y - r}`,
    `Q${x},${y} ${x + r},${y}`,
    `Q${x},${y} ${x},${y + r}`,
    `Q${x},${y} ${x - r},${y}`,
    `Q${x},${y} ${x},${y - r}`,
    'Z',
  ].join(' ');
}

/**
 * The jar. The wall is one even-odd path so the glass reads as empty rather
 * than as a lighter fill, which is what survives a 48px launcher grid.
 */
function mark({ figure, contents, id }) {
  const glassBottom = JAR.glass.y + JAR.glass.height;

  return `
    <defs>
      <clipPath id="${id}">
        <path d="${roundedRect(JAR.glass)}" />
      </clipPath>
    </defs>
    <path d="${roundedRect(JAR.lid)}" fill="${figure}" />
    <path
      d="${roundedRect(JAR.wall)} ${roundedRect(JAR.glass)}"
      fill="${figure}"
      fill-rule="evenodd"
    />
    ${
      contents
        ? `<g clip-path="url(#${id})">
      <rect
        x="${JAR.glass.x}"
        y="${JAR.contentsTop}"
        width="${JAR.glass.width}"
        height="${glassBottom - JAR.contentsTop}"
        fill="${contents}"
      />
    </g>`
        : ''
    }
    <path d="${sparkle(JAR.spark)}" fill="${figure}" />`;
}

/**
 * How far the shape reaches from the centre of the canvas. For a rounded rect
 * that is always on a corner arc: the arc's centre plus its radius.
 */
function reach({ x, y, width, height, radius: r }) {
  const middle = CANVAS / 2;
  const arcCentres = [
    [x + r, y + r],
    [x + width - r, y + r],
    [x + r, y + height - r],
    [x + width - r, y + height - r],
  ];

  return Math.max(...arcCentres.map(([cx, cy]) => Math.hypot(cx - middle, cy - middle) + r));
}

const MARK_REACH = Math.max(reach(JAR.lid), reach(JAR.wall));

/** Shrink to clear the mask, keeping a margin rather than landing on the edge. */
const ADAPTIVE_SAFE_SCALE = (ADAPTIVE_SAFE_RADIUS / MARK_REACH) * 0.95;

function svg({ body, width = CANVAS, height = CANVAS, viewBox = `0 0 ${CANVAS} ${CANVAS}` }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${body}</svg>\n`;
}

function centred(body, scale) {
  const offset = CANVAS / 2;
  return `<g transform="translate(${offset},${offset}) scale(${scale}) translate(${-offset},${-offset})">${body}</g>`;
}

const fullBleed = `<rect width="${CANVAS}" height="${CANVAS}" fill="${TERRACOTTA}" />`;

/**
 * `flatten` is what drops the alpha channel App Store Connect rejects; the
 * maskable and splash layers deliberately keep theirs.
 */
const ASSETS = [
  {
    name: 'icon',
    opaque: true,
    svg: svg({ body: fullBleed + mark({ figure: CREAM, contents: SAFFRON, id: 'glass' }) }),
  },
  {
    name: 'android-icon-background',
    opaque: true,
    svg: svg({ body: fullBleed }),
  },
  {
    name: 'android-icon-foreground',
    svg: svg({
      body: centred(mark({ figure: CREAM, contents: SAFFRON, id: 'glass' }), ADAPTIVE_SAFE_SCALE),
    }),
  },
  {
    // Android tints this one flat, so contents would merge into the wall.
    name: 'android-icon-monochrome',
    svg: svg({
      body: centred(mark({ figure: '#000000', id: 'glass' }), ADAPTIVE_SAFE_SCALE),
    }),
  },
  {
    // Cropped to the mark so app.json's imageWidth sizes the jar, not padding.
    name: 'splash-icon',
    width: JAR.wall.width,
    height: JAR.wall.y + JAR.wall.height - JAR.lid.y,
    svg: svg({
      body: mark({ figure: CREAM, contents: SAFFRON, id: 'glass' }),
      width: JAR.wall.width,
      height: JAR.wall.y + JAR.wall.height - JAR.lid.y,
      viewBox: `${JAR.wall.x} ${JAR.lid.y} ${JAR.wall.width} ${JAR.wall.y + JAR.wall.height - JAR.lid.y}`,
    }),
  },
  {
    name: 'favicon',
    width: 48,
    height: 48,
    opaque: true,
    svg: svg({ body: fullBleed + mark({ figure: CREAM, contents: SAFFRON, id: 'glass' }) }),
  },
];

/** sharp-cli takes one command per run and names output after the input file. */
function sharp(args, label) {
  const result = spawnSync('npx', ['--yes', 'sharp-cli', '--format', 'png', ...args].map(quote), {
    stdio: 'inherit',
    shell: USE_SHELL,
  });

  if (result.status !== 0) {
    console.error(`\nFailed to rasterize ${label}`);
    process.exit(result.status ?? 1);
  }
}

mkdirSync(SVG_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

for (const asset of ASSETS) {
  const source = join(SVG_DIR, `${asset.name}.svg`);
  writeFileSync(source, asset.svg);

  // Opaque assets take a second pass, because resize and flatten cannot share a run.
  const resizeInto = asset.opaque ? TMP_DIR : PNG_DIR;
  sharp(
    [
      '--input',
      source,
      '--output',
      resizeInto,
      'resize',
      String(asset.width ?? CANVAS),
      String(asset.height ?? CANVAS),
    ],
    asset.name,
  );

  if (asset.opaque) {
    sharp(
      ['--input', join(TMP_DIR, `${asset.name}.png`), '--output', PNG_DIR, 'flatten', TERRACOTTA],
      asset.name,
    );
  }

  console.log(`${asset.name}.svg -> ${asset.name}.png`);
}

rmSync(TMP_DIR, { recursive: true, force: true });

console.log(`\nadaptive layers scaled to ${ADAPTIVE_SAFE_SCALE.toFixed(3)} to clear the mask`);
