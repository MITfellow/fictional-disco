import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Caption1,
  FluentProvider,
  MessageBar,
  MessageBarBody,
  Spinner,
  Toolbar,
  ToolbarButton,
  Tooltip,
  createDarkTheme,
  createLightTheme,
  type BrandVariants,
  type Theme,
} from '@fluentui/react-components';
import {
  ArrowDownload20Regular,
  ArrowRedo20Regular,
  ArrowUndo20Regular,
  DocumentAdd20Regular,
  ArrowFit20Regular,
  Settings20Regular,
  WeatherMoon20Regular,
  WeatherSunny20Regular,
  ZoomIn20Regular,
  ZoomOut20Regular,
} from '@fluentui/react-icons';
import type { Asset } from './types';
import { removeUnsafeComponents, useDarkMode, useSettings, useStudio } from './store';
import { ChatPanel } from './chat/ChatPanel';
import { PdfPreview, type Zoom } from './preview/PdfPreview';
import { compiler } from './pdf/client';
import { runAssistant } from './ai/engine';
import { PROVIDERS } from './ai/providers';
import { uid } from './normalize';
import { SettingsDialog } from './components/SettingsDialog';
import { buildWelcome } from './ai/templates';

// A quiet ink-slate brand ramp and warm, paper-like neutrals.
const brand: BrandVariants = {
  10: '#0f1418', 20: '#172028', 30: '#1e2a34', 40: '#253440', 50: '#2c3e4c', 60: '#334858', 70: '#3a5263', 80: '#435d6f',
  90: '#55697a', 100: '#677686', 110: '#7a8592', 120: '#8e979f', 130: '#a3aab0', 140: '#b9bdc1', 150: '#d0d2d3', 160: '#e7e7e6',
};
const FONT = "Inter, 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif";
const lightTheme: Theme = {
  ...createLightTheme(brand),
  fontFamilyBase: FONT,
  colorNeutralBackground1: '#fcfbf8',
  colorNeutralBackground1Hover: '#f4f2ed',
  colorNeutralBackground2: '#f6f4ef',
  colorNeutralBackground3: '#efece6',
  colorNeutralBackground4: '#ebe8e1',
  colorSubtleBackgroundHover: '#efece6',
  colorSubtleBackgroundPressed: '#e7e3dc',
  colorNeutralForeground1: '#2c2b28',
  colorNeutralForeground2: '#4d4a45',
  colorNeutralForeground3: '#7c776f',
  colorNeutralForeground4: '#9a958d',
  colorNeutralStroke1: '#dcd7ce',
  colorNeutralStroke2: '#e8e4dc',
  colorNeutralStroke3: '#efebe4',
  colorNeutralStrokeAccessible: '#8d877e',
};
const darkTheme: Theme = {
  ...createDarkTheme(brand),
  fontFamilyBase: FONT,
  colorBrandForeground1: '#a9b9c6',
  colorBrandForeground2: '#c2cfd9',
  colorBrandBackground: '#4c6577',
  colorBrandBackgroundHover: '#56707f',
  colorBrandBackgroundPressed: '#435a6b',
  colorNeutralBackground1: '#242320',
  colorNeutralBackground1Hover: '#2c2b28',
  colorNeutralBackground2: '#201f1c',
  colorNeutralBackground3: '#1b1a18',
  colorNeutralBackground4: '#181715',
  colorSubtleBackgroundHover: '#2e2c29',
  colorSubtleBackgroundPressed: '#353330',
  colorNeutralForeground1: '#e9e5dd',
  colorNeutralForeground2: '#cfcac1',
  colorNeutralForeground3: '#9c968c',
  colorNeutralStroke1: '#3d3a35',
  colorNeutralStroke2: '#33312d',
  colorNeutralStroke3: '#2c2a27',
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'document';
const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2];

export default function App() {
  const { state, dispatch, setDoc } = useStudio();
  const [settings, setSettings] = useSettings();
  const [dark, setDark] = useDarkMode();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ chars: number; reply: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [info, setInfo] = useState({ pages: 0, current: 1, scale: 1 });
  const [chatW, setChatW] = useState(() => Number(localStorage.getItem('fluent-pdf-studio.chatW')) || 440);
  const abortRef = useRef<AbortController | null>(null);
  const lastBlob = useRef<Blob | null>(null);

  const { doc, assets, messages, past, future } = state;

  // Remove a malformed AI-generated primitive from both current and persisted
  // state before it can repeatedly poison the preview.
  useEffect(() => {
    const repaired = removeUnsafeComponents(doc);
    if (repaired !== doc) setDoc(repaired);
  }, [doc, setDoc]);

  // ------------------------------------------------------------ compile
  useEffect(() => {
    let cancelled = false;
    setCompiling(true);
    const t = setTimeout(async () => {
      try {
        const buf = await compiler.compile(doc, assets);
        if (cancelled) return;
        lastBlob.current = new Blob([buf.slice(0)], { type: 'application/pdf' });
        setPdfData(buf);
        setCompileError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled && msg !== '__stale__') setCompileError(msg);
      } finally {
        if (!cancelled) setCompiling(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [doc, assets]);

  // ------------------------------------------------------------ actions
  const newDoc = useCallback(() => {
    setDoc(buildWelcome());
    dispatch({ type: 'clearChat' });
  }, [setDoc, dispatch]);

  const download = useCallback(() => {
    if (!lastBlob.current) return;
    const url = URL.createObjectURL(lastBlob.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(doc.meta.title)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, [doc.meta.title]);

  const send = useCallback(
    async (text: string, attachments: Asset[]) => {
      if (attachments.length) dispatch({ type: 'addAssets', assets: attachments });
      const userMsg = { id: uid('m'), role: 'user' as const, text, time: Date.now(), attachments: attachments.map((a) => a.id) };
      dispatch({ type: 'addMessage', msg: userMsg });
      setBusy(true);
      setProgress(null);
      const ac = new AbortController();
      abortRef.current = ac;
      const isFresh = doc.meta.title === 'Welcome to Fluent PDF Studio' || doc.blocks.length === 0;
      try {
        const res = await runAssistant({
          prompt: text,
          doc,
          assets: { ...assets, ...Object.fromEntries(attachments.map((a) => [a.id, a])) },
          attachments,
          history: messages.slice(1),
          settings,
          isFresh,
          onProgress: setProgress,
          signal: ac.signal,
        });
        if (JSON.stringify(res.doc) !== JSON.stringify(doc)) setDoc(res.doc);
        dispatch({ type: 'addMessage', msg: { id: uid('m'), role: 'assistant', text: res.reply, time: Date.now(), engine: res.engine, changes: res.changes } });
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === 'AbortError';
        dispatch({
          type: 'addMessage',
          msg: {
            id: uid('m'),
            role: 'assistant',
            error: !aborted,
            time: Date.now(),
            engine: PROVIDERS[settings.provider].label,
            text: aborted
              ? 'Stopped.'
              : `**Something went wrong:** ${e instanceof Error ? e.message : String(e)}\n\nCheck your provider settings, or switch to the offline engine in settings.${
                  e instanceof TypeError ? '\n\n(A network/CORS error usually means the endpoint is unreachable from the browser or the key is invalid.)' : ''
                }`,
          },
        });
      } finally {
        setBusy(false);
        setProgress(null);
        abortRef.current = null;
      }
    },
    [doc, assets, messages, settings, dispatch, setDoc],
  );

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = /input|textarea/i.test(target.tagName) || target.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        download();
      } else if (!typing && mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (!typing && mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, download]);

  // splitter
  const dragging = useRef(false);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      const w = Math.max(340, Math.min(window.innerWidth - 420, e.clientX - 8));
      setChatW(w);
    };
    const up = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.classList.remove('resizing');
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);
  useEffect(() => localStorage.setItem('fluent-pdf-studio.chatW', String(chatW)), [chatW]);

  const engineLabel = useMemo(() => {
    const p = PROVIDERS[settings.provider];
    if (settings.provider === 'local' || (!settings.apiKey && settings.provider !== 'custom')) return settings.provider === 'local' ? 'Offline engine' : `${p.label.replace(/ —.*/, '')} · add key`;
    return `${p.label.replace(/ —.*/, '')} · ${settings.model || p.defaultModel}`;
  }, [settings]);

  const zoomStep = (d: number) => {
    const cur = typeof zoom === 'number' ? zoom : info.scale;
    const next = d > 0 ? ZOOMS.find((z) => z > cur + 0.01) ?? ZOOMS[ZOOMS.length - 1] : [...ZOOMS].reverse().find((z) => z < cur - 0.01) ?? ZOOMS[0];
    setZoom(next);
  };

  return (
    <FluentProvider theme={dark ? darkTheme : lightTheme} className={`app ${dark ? 'dark' : 'light'}`}>
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={22} height={22} />
          <span className="brand-name">PDF Studio</span>
        </div>
        <input className="doc-title" value={doc.meta.title} onChange={(e) => setDoc({ ...doc, meta: { ...doc.meta, title: e.target.value } }, false)} aria-label="Document title" spellCheck={false} />
        <Toolbar className="top-tools" size="small">
          <Tooltip content="New document" relationship="label">
            <ToolbarButton icon={<DocumentAdd20Regular />} onClick={newDoc} />
          </Tooltip>
          <Tooltip content="Undo (Ctrl+Z)" relationship="label">
            <ToolbarButton icon={<ArrowUndo20Regular />} disabled={!past.length} onClick={() => dispatch({ type: 'undo' })} />
          </Tooltip>
          <Tooltip content="Redo (Ctrl+Shift+Z)" relationship="label">
            <ToolbarButton icon={<ArrowRedo20Regular />} disabled={!future.length} onClick={() => dispatch({ type: 'redo' })} />
          </Tooltip>
          <Tooltip content={dark ? 'Light mode' : 'Dark mode'} relationship="label">
            <ToolbarButton icon={dark ? <WeatherSunny20Regular /> : <WeatherMoon20Regular />} onClick={() => setDark(!dark)} />
          </Tooltip>
          <Tooltip content="AI settings" relationship="label">
            <ToolbarButton icon={<Settings20Regular />} onClick={() => setSettingsOpen(true)} />
          </Tooltip>
          <Button appearance="primary" icon={<ArrowDownload20Regular />} onClick={download} disabled={!pdfData} className="download-btn">
            Download
          </Button>
        </Toolbar>
      </header>

      <main className="workspace">
        <div style={{ width: chatW, minWidth: 340 }} className="chat-col">
          <ChatPanel
            messages={messages}
            assets={assets}
            busy={busy}
            progress={progress}
            engineLabel={engineLabel}
            onSend={send}
            onStop={() => abortRef.current?.abort()}
            onOpenSettings={() => setSettingsOpen(true)}
            aiConnected={settings.provider !== 'local' && (!!settings.apiKey || settings.provider === 'custom')}
          />
        </div>
        <div
          className="splitter"
          onPointerDown={(e) => {
            e.preventDefault();
            dragging.current = true;
            document.body.classList.add('resizing');
          }}
          onDoubleClick={() => setChatW(440)}
          role="separator"
          aria-orientation="vertical"
        />
        <section className="panel preview">
          <header className="panel-head">
            <span className="panel-name">
              Preview
              {compiling ? (
                <Spinner size="extra-tiny" className="head-spin" />
              ) : compileError ? (
                <Badge color="danger" appearance="tint" size="small">
                  error
                </Badge>
              ) : info.pages ? (
                <Caption1 className="muted">
                  {' '}
                  · {info.pages} page{info.pages === 1 ? '' : 's'}
                </Caption1>
              ) : null}
            </span>
            <div className="row gap4 preview-tools">
              <Tooltip content="Zoom out" relationship="label">
                <Button size="small" appearance="subtle" icon={<ZoomOut20Regular />} onClick={() => zoomStep(-1)} />
              </Tooltip>
              <Caption1 className="zoom-label">{Math.round(info.scale * 100)}%</Caption1>
              <Tooltip content="Zoom in" relationship="label">
                <Button size="small" appearance="subtle" icon={<ZoomIn20Regular />} onClick={() => zoomStep(1)} />
              </Tooltip>
              <Tooltip content="Fit to width" relationship="label">
                <Button size="small" appearance={zoom === 'fit' ? 'secondary' : 'subtle'} icon={<ArrowFit20Regular />} onClick={() => setZoom('fit')} />
              </Tooltip>
            </div>
          </header>
          {compileError ? (
            <MessageBar intent="error" className="compile-error">
              <MessageBarBody>PDF compile error: {compileError}</MessageBarBody>
            </MessageBar>
          ) : null}
          <div className="preview-body">
            <div className="tab-pane active">
              {pdfData ? null : (
                <div className="preview-loading">
                  <Spinner label="Compiling your first PDF…" />
                </div>
              )}
              <PdfPreview data={pdfData} zoom={zoom} onInfo={setInfo} />
              {info.pages > 0 ? (
                <div className="page-pill">
                  Page {info.current} of {info.pages}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
      <SettingsDialog open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onSave={setSettings} />
    </FluentProvider>
  );
}

