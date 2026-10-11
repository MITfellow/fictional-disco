/// <reference lib="webworker" />
import { registerBrowserFonts } from './fonts.browser';
import { compilePdf } from './compile';

registerBrowserFonts();

self.onmessage = async (e: MessageEvent) => {
  const { id, doc, assets } = e.data;
  try {
    const blob = await compilePdf(doc, assets);
    const buf = await blob.arrayBuffer();
    (self as unknown as Worker).postMessage({ id, buf }, [buf]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
