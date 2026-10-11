import { Fragment, type ReactNode } from 'react';
import { tokenizeInline } from '../inline';

function inline(text: string): ReactNode {
  return tokenizeInline(text).map((t, i) => {
    let n: ReactNode = t.text;
    if (t.code) n = <code>{n}</code>;
    if (t.bold) n = <strong>{n}</strong>;
    if (t.italic) n = <em>{n}</em>;
    if (t.strike) n = <s>{n}</s>;
    if (t.mark) n = <mark>{n}</mark>;
    if (t.href)
      n = (
        <a href={t.href} target="_blank" rel="noreferrer">
          {n}
        </a>
      );
    return <Fragment key={i}>{n}</Fragment>;
  });
}

/** Minimal block markdown for chat bubbles. */
export function Markdown({ text }: { text: string }) {
  const lines = String(text ?? '').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(<pre key={k++}>{buf.join('\n')}</pre>);
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''));
      out.push(
        <ul key={k++}>
          {items.map((t, j) => (
            <li key={j}>{inline(t)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      out.push(
        <ol key={k++}>
          {items.map((t, j) => (
            <li key={j}>{inline(t)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      out.push(<p key={k++} className="md-h">{inline(h[2])}</p>);
      i++;
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|\s*[-*•]\s+|\s*\d+[.)]\s+|#{1,3}\s)/.test(lines[i])) para.push(lines[i++]);
    out.push(<p key={k++}>{inline(para.join(' '))}</p>);
  }
  return <div className="md">{out}</div>;
}
