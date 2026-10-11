import { registerFonts } from './fonts';
import i400 from '@fontsource/inter/files/inter-latin-400-normal.woff?url';
import i400i from '@fontsource/inter/files/inter-latin-400-italic.woff?url';
import i600 from '@fontsource/inter/files/inter-latin-600-normal.woff?url';
import i700 from '@fontsource/inter/files/inter-latin-700-normal.woff?url';
import i700i from '@fontsource/inter/files/inter-latin-700-italic.woff?url';
import i800 from '@fontsource/inter/files/inter-latin-800-normal.woff?url';
import m400 from '@fontsource/merriweather/files/merriweather-latin-400-normal.woff?url';
import m400i from '@fontsource/merriweather/files/merriweather-latin-400-italic.woff?url';
import m700 from '@fontsource/merriweather/files/merriweather-latin-700-normal.woff?url';
import m700i from '@fontsource/merriweather/files/merriweather-latin-700-italic.woff?url';
import m900 from '@fontsource/merriweather/files/merriweather-latin-900-normal.woff?url';
import j400 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff?url';
import j700 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff?url';

const abs = (u: string) => new URL(u, self.location.href).href;

export function registerBrowserFonts() {
  registerFonts({
    sans: { 400: abs(i400), '400i': abs(i400i), 600: abs(i600), 700: abs(i700), '700i': abs(i700i), 800: abs(i800) },
    serif: { 400: abs(m400), '400i': abs(m400i), 700: abs(m700), '700i': abs(m700i), 900: abs(m900) },
    mono: { 400: abs(j400), 700: abs(j700) },
  });
}
