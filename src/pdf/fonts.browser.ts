import { registerFonts } from './fonts';

// Explicit list so only the fonts we use are emitted as assets.
const urls = import.meta.glob(
  [
    '/node_modules/@fontsource/inter/files/inter-latin-400-normal.woff',
    '/node_modules/@fontsource/inter/files/inter-latin-400-italic.woff',
    '/node_modules/@fontsource/inter/files/inter-latin-600-normal.woff',
    '/node_modules/@fontsource/inter/files/inter-latin-700-normal.woff',
    '/node_modules/@fontsource/inter/files/inter-latin-700-italic.woff',
    '/node_modules/@fontsource/inter/files/inter-latin-800-normal.woff',
    '/node_modules/@fontsource/inter/files/inter-greek-400-normal.woff',
    '/node_modules/@fontsource/inter/files/inter-greek-400-italic.woff',
    '/node_modules/@fontsource/inter/files/inter-greek-700-normal.woff',
    '/node_modules/@fontsource/inter/files/inter-greek-700-italic.woff',
    '/node_modules/@fontsource/inter/files/inter-latin-ext-400-normal.woff',
    '/node_modules/@fontsource/inter/files/inter-latin-ext-700-normal.woff',
    '/node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff',
    '/node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-italic.woff',
    '/node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff',
    '/node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff',
    '/node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-700-italic.woff',
    '/node_modules/@fontsource/source-serif-4/files/source-serif-4-greek-400-normal.woff',
    '/node_modules/@fontsource/source-serif-4/files/source-serif-4-greek-400-italic.woff',
    '/node_modules/@fontsource/source-serif-4/files/source-serif-4-greek-700-normal.woff',
    '/node_modules/@fontsource/source-serif-4/files/source-serif-4-greek-700-italic.woff',
    '/node_modules/@fontsource/stix-two-text/files/stix-two-text-latin-400-normal.woff',
    '/node_modules/@fontsource/stix-two-text/files/stix-two-text-latin-400-italic.woff',
    '/node_modules/@fontsource/stix-two-text/files/stix-two-text-latin-700-normal.woff',
    '/node_modules/@fontsource/stix-two-text/files/stix-two-text-latin-700-italic.woff',
    '/node_modules/@fontsource/stix-two-text/files/stix-two-text-greek-400-normal.woff',
    '/node_modules/@fontsource/stix-two-text/files/stix-two-text-greek-400-italic.woff',
    '/node_modules/@fontsource/stix-two-text/files/stix-two-text-greek-700-normal.woff',
    '/node_modules/@fontsource/stix-two-text/files/stix-two-text-greek-700-italic.woff',
    '/node_modules/@fontsource/noto-sans-math/files/noto-sans-math-latin-400-normal.woff',
    '/node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff',
    '/node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff',
  ],
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>;

export function registerBrowserFonts() {
  registerFonts((file) => {
    const u = urls[`/node_modules/@fontsource/${file}`];
    if (!u) throw new Error(`Font not bundled: ${file}`);
    return new URL(u, self.location.href).href;
  });
}
