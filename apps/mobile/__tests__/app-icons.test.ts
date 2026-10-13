/**
 * Guards the launcher and splash assets declared in app.json.
 *
 * These files are never imported by the app, so nothing else fails when they
 * are missing, mis-sized, or still the Expo template defaults. Both stores
 * reject on exactly that, which is why it is checked here instead.
 *
 * Runs under tsconfig.node.json: it reads the filesystem, which the app's own
 * TypeScript project deliberately has no types for.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import appJson from '../app.json';

const MOBILE_ROOT = join(__dirname, '..');

/** Canvas both stores expect for the source icon, before platform downscaling. */
const ICON_SIZE = 1024;

/** Brand terracotta. Expo's template shipped #208AEF splash / #E6F4FE icon. */
const BRAND_BACKGROUND = '#B0462B';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Colour types carrying a per-pixel alpha channel: grayscale+A and RGBA. */
const ALPHA_COLOUR_TYPES = [4, 6];

interface PngHeader {
  width: number;
  height: number;
  colourType: number;
  hasTransparencyChunk: boolean;
}

function readPngHeader(relativePath: string): PngHeader {
  const bytes = readFileSync(join(MOBILE_ROOT, relativePath));

  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${relativePath} is not a PNG`);
  }
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error(`${relativePath} has no IHDR chunk where one is required`);
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colourType: bytes[25],
    // tRNS gives palette and truecolour images transparency without an alpha channel.
    hasTransparencyChunk: bytes.includes(Buffer.from('tRNS', 'ascii')),
  };
}

function hasAlpha(header: PngHeader): boolean {
  return ALPHA_COLOUR_TYPES.includes(header.colourType) || header.hasTransparencyChunk;
}

interface SplashOptions {
  backgroundColor: string;
  image: string;
  imageWidth: number;
}

/** app.json carries the splash config as a ["plugin-name", options] pair. */
function splashOptions(): SplashOptions {
  const entry = appJson.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );

  if (!Array.isArray(entry) || typeof entry[1] !== 'object') {
    throw new Error('app.json no longer configures expo-splash-screen');
  }

  return entry[1];
}

describe('app icon assets', () => {
  const { expo } = appJson;

  it('declares the store icon at the full source canvas', () => {
    const header = readPngHeader(expo.icon);

    expect(header.width).toBe(ICON_SIZE);
    expect(header.height).toBe(ICON_SIZE);
  });

  it('keeps the store icon opaque, because App Store Connect rejects alpha', () => {
    expect(hasAlpha(readPngHeader(expo.icon))).toBe(false);
  });

  it('sizes every android adaptive layer to the same canvas', () => {
    const { foregroundImage, backgroundImage, monochromeImage } = expo.android.adaptiveIcon;

    for (const layer of [foregroundImage, backgroundImage, monochromeImage]) {
      const header = readPngHeader(layer);

      expect(header.width).toBe(ICON_SIZE);
      expect(header.height).toBe(ICON_SIZE);
    }
  });

  it('keeps the maskable android layers transparent around the mark', () => {
    const { foregroundImage, monochromeImage } = expo.android.adaptiveIcon;

    expect(hasAlpha(readPngHeader(foregroundImage))).toBe(true);
    expect(hasAlpha(readPngHeader(monochromeImage))).toBe(true);
  });

  it('ships a splash mark and a favicon', () => {
    expect(() => readPngHeader(splashOptions().image)).not.toThrow();
    expect(() => readPngHeader(expo.web.favicon)).not.toThrow();
  });

  it('no longer carries the Expo template icon bundle', () => {
    expect(JSON.stringify(appJson)).not.toContain('expo.icon');
  });

  it('paints both launcher backgrounds in the brand colour', () => {
    expect(expo.android.adaptiveIcon.backgroundColor).toBe(BRAND_BACKGROUND);
    expect(splashOptions().backgroundColor).toBe(BRAND_BACKGROUND);
  });
});
