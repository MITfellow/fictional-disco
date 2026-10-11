import type { ThemeName } from './types';

export interface PdfTheme {
  name: ThemeName;
  label: string;
  primary: string;
  primaryDark: string;
  accent: string;
  soft: string; // light tint of primary for backgrounds
  softer: string;
  text: string;
  muted: string;
  border: string;
  palette: string[]; // diagram/chart colors
  coverBg: string;
  coverText: string;
}

export const THEMES: Record<ThemeName, PdfTheme> = {
  ocean: {
    name: 'ocean',
    label: 'Ocean',
    primary: '#2563eb',
    primaryDark: '#1e3a8a',
    accent: '#06b6d4',
    soft: '#e0ecff',
    softer: '#f3f7ff',
    text: '#0f172a',
    muted: '#64748b',
    border: '#d5deeb',
    palette: ['#2563eb', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'],
    coverBg: '#0b1f4d',
    coverText: '#ffffff',
  },
  emerald: {
    name: 'emerald',
    label: 'Emerald',
    primary: '#059669',
    primaryDark: '#064e3b',
    accent: '#84cc16',
    soft: '#d9f6ea',
    softer: '#f1fbf6',
    text: '#0b1f17',
    muted: '#5b7068',
    border: '#cfe5db',
    palette: ['#059669', '#84cc16', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#eab308'],
    coverBg: '#053b2c',
    coverText: '#ffffff',
  },
  sunset: {
    name: 'sunset',
    label: 'Sunset',
    primary: '#ea580c',
    primaryDark: '#7c2d12',
    accent: '#e11d48',
    soft: '#ffe8d9',
    softer: '#fff6f0',
    text: '#1c1009',
    muted: '#78655a',
    border: '#f0d9cb',
    palette: ['#ea580c', '#e11d48', '#f59e0b', '#7c3aed', '#0891b2', '#16a34a', '#db2777', '#ca8a04'],
    coverBg: '#4a1406',
    coverText: '#ffffff',
  },
  royal: {
    name: 'royal',
    label: 'Royal',
    primary: '#7c3aed',
    primaryDark: '#3b0764',
    accent: '#db2777',
    soft: '#eee5ff',
    softer: '#f8f4ff',
    text: '#150a26',
    muted: '#6b6280',
    border: '#e0d6f2',
    palette: ['#7c3aed', '#db2777', '#2563eb', '#0d9488', '#f59e0b', '#ef4444', '#6366f1', '#22c55e'],
    coverBg: '#2a0a52',
    coverText: '#ffffff',
  },
  graphite: {
    name: 'graphite',
    label: 'Graphite',
    primary: '#334155',
    primaryDark: '#0f172a',
    accent: '#0ea5e9',
    soft: '#e7ebf0',
    softer: '#f6f7f9',
    text: '#0f172a',
    muted: '#64748b',
    border: '#d9dee5',
    palette: ['#334155', '#0ea5e9', '#64748b', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#94a3b8'],
    coverBg: '#111827',
    coverText: '#ffffff',
  },
  rose: {
    name: 'rose',
    label: 'Rose',
    primary: '#e11d48',
    primaryDark: '#881337',
    accent: '#f97316',
    soft: '#ffe4ea',
    softer: '#fff5f7',
    text: '#1f0a10',
    muted: '#7a5b64',
    border: '#f2d4dc',
    palette: ['#e11d48', '#f97316', '#8b5cf6', '#0ea5e9', '#10b981', '#eab308', '#ec4899', '#6366f1'],
    coverBg: '#4c0519',
    coverText: '#ffffff',
  },
  midnight: {
    name: 'midnight',
    label: 'Midnight',
    primary: '#4f46e5',
    primaryDark: '#1e1b4b',
    accent: '#22d3ee',
    soft: '#e4e3ff',
    softer: '#f5f5ff',
    text: '#0c0a24',
    muted: '#5f5d7a',
    border: '#dcdbf0',
    palette: ['#4f46e5', '#22d3ee', '#a855f7', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'],
    coverBg: '#0c0a24',
    coverText: '#ffffff',
  },
};

export const THEME_LIST = Object.values(THEMES);

export const TONES = {
  info: { bg: '#eaf2ff', border: '#3b82f6', title: '#1d4ed8', icon: 'i' },
  success: { bg: '#e8f8ef', border: '#16a34a', title: '#15803d', icon: '✓' },
  warning: { bg: '#fff6e0', border: '#f59e0b', title: '#b45309', icon: '!' },
  danger: { bg: '#ffecec', border: '#ef4444', title: '#b91c1c', icon: '×' },
  note: { bg: '#f3f0ff', border: '#8b5cf6', title: '#6d28d9', icon: '✎' },
} as const;
