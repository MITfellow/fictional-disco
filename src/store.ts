import { useCallback, useEffect, useReducer, useState } from 'react';
import type { AiSettings, Asset, Block, ChatMessage, DocSpec } from './types';
import { buildWelcome } from './ai/templates';
import { normalizeDoc, uid } from './normalize';

const STATE_KEY = 'fluent-pdf-studio.state.v2'; // fresh production workspace; v1 drafts are intentionally retired
const SETTINGS_KEY = 'fluent-pdf-studio.settings.v1';

export interface StudioState {
  doc: DocSpec;
  assets: Record<string, Asset>;
  messages: ChatMessage[];
  past: DocSpec[];
  future: DocSpec[];
}

type Action =
  | { type: 'setDoc'; doc: DocSpec; record?: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'addMessage'; msg: ChatMessage }
  | { type: 'patchMessage'; id: string; patch: Partial<ChatMessage> }
  | { type: 'addAssets'; assets: Asset[] }
  | { type: 'loadProject'; state: Pick<StudioState, 'doc' | 'assets' | 'messages'> }
  | { type: 'clearChat' };

const HISTORY = 60;
const SAFE_NUMBER = 1_000_000_000;

function hasUnsafeNumber(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value) || Math.abs(value) > SAFE_NUMBER;
  if (Array.isArray(value)) return value.some(hasUnsafeNumber);
  if (!value || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).some(hasUnsafeNumber);
}

/** Remove a single malformed generated component instead of allowing it to
 * poison the saved document and every subsequent compile. */
export function removeUnsafeComponents(doc: DocSpec): DocSpec {
  let changed = false;
  const blocks: Block[] = [];
  for (const block of doc.blocks) {
    if (block.type === 'figure') {
      const elements = block.elements.filter((element) => !hasUnsafeNumber(element));
      if (elements.length !== block.elements.length) changed = true;
      if (!elements.length) {
        changed = true;
        continue;
      }
      blocks.push(elements.length === block.elements.length ? block : { ...block, elements });
    } else if (hasUnsafeNumber(block)) {
      changed = true;
    } else {
      blocks.push(block);
    }
  }
  return changed ? { ...doc, blocks } : doc;
}

function reducer(s: StudioState, a: Action): StudioState {
  switch (a.type) {
    case 'setDoc':
      if (a.record === false) return { ...s, doc: a.doc };
      return { ...s, doc: a.doc, past: [...s.past, s.doc].slice(-HISTORY), future: [] };
    case 'undo': {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { ...s, doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future] };
    }
    case 'redo': {
      if (!s.future.length) return s;
      const [next, ...rest] = s.future;
      return { ...s, doc: next, past: [...s.past, s.doc], future: rest };
    }
    case 'addMessage':
      return { ...s, messages: [...s.messages, a.msg] };
    case 'patchMessage':
      return { ...s, messages: s.messages.map((m) => (m.id === a.id ? { ...m, ...a.patch } : m)) };
    case 'addAssets': {
      const assets = { ...s.assets };
      a.assets.forEach((x) => (assets[x.id] = x));
      return { ...s, assets };
    }
    case 'loadProject':
      return {
        doc: removeUnsafeComponents(normalizeDoc(a.state.doc)),
        assets: a.state.assets ?? {},
        messages: Array.isArray(a.state.messages) && a.state.messages.length ? a.state.messages : [welcomeMessage()],
        past: [...s.past, s.doc].slice(-HISTORY),
        future: [],
      };
    case 'clearChat':
      return { ...s, messages: [welcomeMessage()] };
  }
}

export function welcomeMessage(): ChatMessage {
  return {
    id: uid('m'),
    role: 'assistant',
    time: Date.now(),
    engine: 'Fluent PDF Studio',
    text: "Welcome to a fresh **PDF Studio** workspace. Describe a document and I’ll write, draw and typeset it on the right. Then keep refining it in plain words—edits preserve the rest of your work.\n\nTry: *create an EMI study guide with diagrams and worked examples*. You can also [open the sample EMI PDF](/sample-electromagnetic-induction.pdf).",
  };
}

function load(): StudioState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      return {
        doc: removeUnsafeComponents(normalizeDoc(j.doc)),
        assets: j.assets ?? {},
        messages: Array.isArray(j.messages) && j.messages.length ? j.messages : [welcomeMessage()],
        past: [],
        future: [],
      };
    }
  } catch {
    /* ignore corrupt state */
  }
  return { doc: buildWelcome(), assets: {}, messages: [welcomeMessage()], past: [], future: [] };
}

export function useStudio() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    const persist = () => {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify({ doc: state.doc, assets: state.assets, messages: state.messages.slice(-80) }));
      } catch {
        // quota exceeded (large images) — preserve the document and chat even
        // when embedded image data is too large for localStorage.
        try {
          localStorage.setItem(STATE_KEY, JSON.stringify({ doc: state.doc, assets: {}, messages: state.messages.slice(-80) }));
        } catch {
          /* storage unavailable */
        }
      }
    };
    const t = setTimeout(persist, 400);
    window.addEventListener('pagehide', persist);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pagehide', persist);
    };
  }, [state.doc, state.assets, state.messages]);

  const setDoc = useCallback((doc: DocSpec, record = true) => dispatch({ type: 'setDoc', doc, record }), []);
  return { state, dispatch, setDoc };
}

export const DEFAULT_SETTINGS: AiSettings = { provider: 'local', apiKey: '', model: '', baseUrl: '', temperature: 0.6 };

export function useSettings() {
  const [settings, setSettings] = useState<AiSettings>(() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);
  return [settings, setSettings] as const;
}

export function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const v = localStorage.getItem('fluent-pdf-studio.dark');
    if (v != null) return v === '1';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  useEffect(() => {
    localStorage.setItem('fluent-pdf-studio.dark', dark ? '1' : '0');
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);
  return [dark, setDark] as const;
}
