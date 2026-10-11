import { Font } from '@react-pdf/renderer';
import type { FontName } from '../types';

export interface FontSources {
  sans: { 400: string; 600: string; 700: string; 800: string; '400i': string; '700i': string };
  serif: { 400: string; 700: string; 900: string; '400i': string; '700i': string };
  mono: { 400: string; 700: string };
}

let registered = false;

export function registerFonts(src: FontSources) {
  if (registered) return;
  registered = true;
  Font.register({
    family: 'Inter',
    fonts: [
      { src: src.sans[400], fontWeight: 400 },
      { src: src.sans['400i'], fontWeight: 400, fontStyle: 'italic' },
      { src: src.sans[600], fontWeight: 600 },
      { src: src.sans[700], fontWeight: 700 },
      { src: src.sans['700i'], fontWeight: 700, fontStyle: 'italic' },
      { src: src.sans[800], fontWeight: 800 },
    ],
  });
  Font.register({
    family: 'Merriweather',
    fonts: [
      { src: src.serif[400], fontWeight: 400 },
      { src: src.serif['400i'], fontWeight: 400, fontStyle: 'italic' },
      { src: src.serif[700], fontWeight: 600 },
      { src: src.serif[700], fontWeight: 700 },
      { src: src.serif['700i'], fontWeight: 700, fontStyle: 'italic' },
      { src: src.serif[900], fontWeight: 800 },
    ],
  });
  Font.register({
    family: 'JetBrains Mono',
    fonts: [
      { src: src.mono[400], fontWeight: 400 },
      { src: src.mono[400], fontWeight: 400, fontStyle: 'italic' },
      { src: src.mono[700], fontWeight: 600 },
      { src: src.mono[700], fontWeight: 700 },
      { src: src.mono[700], fontWeight: 700, fontStyle: 'italic' },
      { src: src.mono[700], fontWeight: 800 },
    ],
  });
  // Keep words intact — no automatic hyphenation.
  Font.registerHyphenationCallback((word) => [word]);
}

export const FAMILY: Record<FontName, string> = {
  sans: 'Inter',
  serif: 'Merriweather',
  mono: 'JetBrains Mono',
};

export const MONO = 'JetBrains Mono';
