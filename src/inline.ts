// Tiny inline-markdown tokenizer shared by the PDF compiler and the chat UI.
// Supports **bold**, *italic* / _italic_, `code`, ~~strike~~, ==highlight== and [text](url).

export interface InlineToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  mark?: boolean;
  href?: string;
  math?: boolean; // inline TeX between $...$
}

const RE = /(\$[^\s$](?:[^$]*?[^\s$\\])?\$(?!\d)|\\\([\s\S]+?\\\)|\*\*[^*]+?\*\*|__[^_]+?__|\*[^*\s][^*]*?\*|_[^_\s][^_]*?_|`[^`]+?`|~~[^~]+?~~|==[^=]+?==|\[[^\]]+?\]\([^)]+?\))/g;

export function tokenizeInline(src: string, base: Omit<InlineToken, 'text'> = {}): InlineToken[] {
  const out: InlineToken[] = [];
  if (!src) return out;
  let last = 0;
  for (const m of src.matchAll(RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ ...base, text: src.slice(last, idx) });
    const t = m[0];
    if (t.startsWith('$')) out.push({ ...base, text: t.slice(1, -1), math: true });
    else if (t.startsWith('\\(')) out.push({ ...base, text: t.slice(2, -2), math: true });
    else if (t.startsWith('**') || t.startsWith('__')) out.push(...tokenizeInline(t.slice(2, -2), { ...base, bold: true }));
    else if (t.startsWith('`')) out.push({ ...base, text: t.slice(1, -1), code: true });
    else if (t.startsWith('~~')) out.push(...tokenizeInline(t.slice(2, -2), { ...base, strike: true }));
    else if (t.startsWith('==')) out.push(...tokenizeInline(t.slice(2, -2), { ...base, mark: true }));
    else if (t.startsWith('[')) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t);
      if (mm) out.push(...tokenizeInline(mm[1], { ...base, href: mm[2] }));
      else out.push({ ...base, text: t });
    } else out.push(...tokenizeInline(t.slice(1, -1), { ...base, italic: true }));
    last = idx + t.length;
  }
  if (last < src.length) out.push({ ...base, text: src.slice(last) });
  return out;
}

export function stripInline(src: string): string {
  return tokenizeInline(src)
    .map((t) => (t.math ? t.text.replace(/\\([A-Za-z]+)/g, '$1').replace(/[{}]/g, '') : t.text))
    .join('');
}
