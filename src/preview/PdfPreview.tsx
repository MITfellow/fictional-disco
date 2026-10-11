import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type Zoom = 'fit' | 'page' | number;

interface Props {
  data: ArrayBuffer | null;
  zoom: Zoom;
  onInfo?: (info: { pages: number; current: number; scale: number }) => void;
  scrollToPage?: { page: number; nonce: number };
}

/** Renders a PDF with pdf.js into crisp canvases. Double-buffers to avoid flicker while recompiling. */
export function PdfPreview({ data, zoom, onInfo, scrollToPage }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const pagesHost = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const renderSeq = useRef(0);
  const info = useRef({ pages: 0, current: 1, scale: 1 });
  const onInfoRef = useRef(onInfo);
  onInfoRef.current = onInfo;

  useLayoutEffect(() => {
    const el = scroller.current!;
    const ro = new ResizeObserver(() => {
      setWidth(el.clientWidth);
      setHeight(el.clientHeight);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // debounce size changes
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const t = setTimeout(() => setSize({ w: width, h: height }), 120);
    return () => clearTimeout(t);
  }, [width, height]);

  useEffect(() => {
    if (!data || !size.w) return;
    const seq = ++renderSeq.current;
    let cancelled = false;
    const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), isEvalSupported: false });
    (async () => {
      const pdf = await task.promise;
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const frag = document.createDocumentFragment();
      let scaleUsed = 1;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        if (cancelled || seq !== renderSeq.current) return;
        const base = page.getViewport({ scale: 1 });
        let scale: number;
        if (zoom === 'fit') scale = Math.min(1.45, Math.max(0.3, (size.w - 56) / base.width));
        else if (zoom === 'page') scale = Math.max(0.2, Math.min((size.w - 56) / base.width, (size.h - 48) / base.height));
        else scale = zoom;
        scaleUsed = scale;
        const vp = page.getViewport({ scale: scale * dpr });
        const wrap = document.createElement('div');
        wrap.className = 'pdf-page';
        wrap.dataset.page = String(i);
        wrap.style.width = `${Math.floor(vp.width / dpr)}px`;
        wrap.style.height = `${Math.floor(vp.height / dpr)}px`;
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        wrap.appendChild(canvas);
        const badge = document.createElement('span');
        badge.className = 'pdf-page-badge';
        badge.textContent = `${i} / ${pdf.numPages}`;
        wrap.appendChild(badge);
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
        frag.appendChild(wrap);
      }
      if (cancelled || seq !== renderSeq.current) return;
      const host = pagesHost.current!;
      const sc = scroller.current!;
      const ratio = sc.scrollHeight > 0 ? sc.scrollTop / Math.max(1, sc.scrollHeight - sc.clientHeight) : 0;
      const prevTop = sc.scrollTop;
      const prevScale = info.current.scale;
      host.replaceChildren(frag);
      // keep reading position stable across recompiles; adapt on zoom change
      if (Math.abs(prevScale - scaleUsed) < 0.001) sc.scrollTop = prevTop;
      else sc.scrollTop = ratio * (sc.scrollHeight - sc.clientHeight);
      info.current = { ...info.current, pages: pdf.numPages, scale: scaleUsed };
      onInfoRef.current?.({ ...info.current });
      pdf.destroy();
    })().catch((e) => {
      if (!cancelled) console.error('pdf.js render failed', e);
    });
    return () => {
      cancelled = true;
      task.destroy().catch(() => {});
    };
  }, [data, zoom, size.w, size.h]);

  // track current page while scrolling
  useEffect(() => {
    const sc = scroller.current!;
    const onScroll = () => {
      const pages = pagesHost.current?.children ?? [];
      const mid = sc.scrollTop + sc.clientHeight * 0.35;
      let cur = 1;
      for (const el of Array.from(pages) as HTMLElement[]) {
        if (el.offsetTop <= mid) cur = Number(el.dataset.page);
      }
      if (cur !== info.current.current) {
        info.current = { ...info.current, current: cur };
        onInfoRef.current?.({ ...info.current });
      }
    };
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => sc.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!scrollToPage) return;
    const el = pagesHost.current?.querySelector<HTMLElement>(`[data-page="${scrollToPage.page}"]`);
    if (el) scroller.current!.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
  }, [scrollToPage]);

  return (
    <div className="pdf-scroller" ref={scroller}>
      <div className="pdf-pages" ref={pagesHost} />
    </div>
  );
}
