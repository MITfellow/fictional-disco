import { useCallback, useEffect, useReducer, useState } from 'react';
import type { AiSettings, Asset, ChatMessage, DocSpec } from './types';
import { buildWelcome } from './ai/templates';
import { normalizeDoc, uid } from './normalize';

const STATE_KEY = 'fluent-pdf-studio.state.v1';
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
  | { type: 'clearChat' };

const HISTORY = 60;

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
    text: "Hi! I'm your **AI document designer**. Tell me what to make and I'll write, draw and typeset it as a real PDF on the right: physics or maths notes with equations, plots and diagrams, lab reports, worksheets, reports, proposals and more.\n\nKeep refining in plain words, e.g. *add a worked example*, *add a graph of $v$ against $t$*, *make it landscape*, *add a cover page*. Attach images with the paperclip button, or paste or drop them here.",
  };
}

function load(): StudioState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      return {
        doc: normalizeDoc(j.doc),
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
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify({ doc: state.doc, assets: state.assets, messages: state.messages.slice(-80) }));
      } catch {
        // quota exceeded (large images) — persist without assets
        try {
          localStorage.setItem(STATE_KEY, JSON.stringify({ doc: state.doc, assets: {}, messages: state.messages.slice(-80) }));
        } catch {
          /* give up */
        }
      }
    }, 400);
    return () => clearTimeout(t);
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
