import { Font } from '@react-pdf/renderer';
import type { FontName } from '../types';

type Face = [file: string, weight: number, style?: 'italic'];

// Fontsource files (relative to node_modules/@fontsource). Each family is a Unicode subset;
// react-pdf falls back per glyph through the family chains below.
const FACES: Record<string, Face[]> = {
  Inter: [
    ['inter/files/inter-latin-400-normal.woff', 400],
    ['inter/files/inter-latin-400-italic.woff', 400, 'italic'],
    ['inter/files/inter-latin-600-normal.woff', 600],
    ['inter/files/inter-latin-700-normal.woff', 700],
    ['inter/files/inter-latin-700-italic.woff', 700, 'italic'],
    ['inter/files/inter-latin-800-normal.woff', 800],
  ],
  'Inter Greek': [
    ['inter/files/inter-greek-400-normal.woff', 400],
    ['inter/files/inter-greek-400-italic.woff', 400, 'italic'],
    ['inter/files/inter-greek-700-normal.woff', 700],
    ['inter/files/inter-greek-700-italic.woff', 700, 'italic'],
  ],
  'Inter Ext': [
    ['inter/files/inter-latin-ext-400-normal.woff', 400],
    ['inter/files/inter-latin-ext-700-normal.woff', 700],
  ],
  'Source Serif': [
    ['source-serif-4/files/source-serif-4-latin-400-normal.woff', 400],
    ['source-serif-4/files/source-serif-4-latin-400-italic.woff', 400, 'italic'],
    ['source-serif-4/files/source-serif-4-latin-600-normal.woff', 600],
    ['source-serif-4/files/source-serif-4-latin-700-normal.woff', 700],
    ['source-serif-4/files/source-serif-4-latin-700-italic.woff', 700, 'italic'],
  ],
  'Source Serif Greek': [
    ['source-serif-4/files/source-serif-4-greek-400-normal.woff', 400],
    ['source-serif-4/files/source-serif-4-greek-400-italic.woff', 400, 'italic'],
    ['source-serif-4/files/source-serif-4-greek-700-normal.woff', 700],
    ['source-serif-4/files/source-serif-4-greek-700-italic.woff', 700, 'italic'],
  ],
  STIX: [
    ['stix-two-text/files/stix-two-text-latin-400-normal.woff', 400],
    ['stix-two-text/files/stix-two-text-latin-400-italic.woff', 400, 'italic'],
    ['stix-two-text/files/stix-two-text-latin-700-normal.woff', 700],
    ['stix-two-text/files/stix-two-text-latin-700-italic.woff', 700, 'italic'],
  ],
  'STIX Greek': [
    ['stix-two-text/files/stix-two-text-greek-400-normal.woff', 400],
    ['stix-two-text/files/stix-two-text-greek-400-italic.woff', 400, 'italic'],
    ['stix-two-text/files/stix-two-text-greek-700-normal.woff', 700],
    ['stix-two-text/files/stix-two-text-greek-700-italic.woff', 700, 'italic'],
  ],
  'Noto Math': [['noto-sans-math/files/noto-sans-math-latin-400-normal.woff', 400]],
  'JetBrains Mono': [
    ['jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff', 400],
    ['jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff', 700],
  ],
};

export const FONT_FILES = Object.values(FACES).flatMap((f) => f.map((x) => x[0]));

let registered = false;

/** `resolve` maps a fontsource-relative file to a URL (browser) or absolute path (node). */
export function registerFonts(resolve: (file: string) => string) {
  if (registered) return;
  registered = true;
  for (const [family, faces] of Object.entries(FACES)) {
    const fonts: { src: string; fontWeight: number; fontStyle?: 'italic' | 'normal' }[] = [];
    for (const [file, weight, style] of faces) fonts.push({ src: resolve(file), fontWeight: weight, fontStyle: style ?? 'normal' });
    // synthesize missing italic faces from upright ones so every family resolves cleanly
    for (const [file, weight, style] of faces)
      if (!style && !faces.some((f) => f[1] === weight && f[2] === 'italic')) fonts.push({ src: resolve(file), fontWeight: weight, fontStyle: 'italic' });
    Font.register({ family, fonts });
  }
  Font.registerHyphenationCallback((word) => [word]);
}

export const FAMILY: Record<FontName, string[]> = {
  sans: ['Inter', 'Inter Greek', 'Inter Ext', 'Noto Math'],
  serif: ['Source Serif', 'Source Serif Greek', 'Inter Ext', 'Noto Math'],
  mono: ['JetBrains Mono', 'Inter Greek', 'Inter Ext', 'Noto Math'],
};

export const MONO = ['JetBrains Mono', 'Noto Math'];
export const MATH = ['STIX', 'STIX Greek', 'Noto Math'];
