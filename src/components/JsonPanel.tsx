import { useEffect, useState } from 'react';
import { Button, Caption1, MessageBar, MessageBarBody } from '@fluentui/react-components';
import type { DocSpec } from '../types';
import { normalizeDoc } from '../normalize';

export function JsonPanel({ doc, onChange }: { doc: DocSpec; onChange: (d: DocSpec) => void }) {
  const pretty = JSON.stringify(doc, (k, v) => (k === 'src' && typeof v === 'string' && v.startsWith('data:') ? v.slice(0, 48) + '…' : v), 2);
  const [text, setText] = useState(pretty);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setText(pretty);
  }, [pretty, dirty]);
  const apply = () => {
    try {
      const parsed = JSON.parse(text);
      // restore truncated data URLs
      const next = normalizeDoc(parsed, doc);
      next.blocks = next.blocks.map((b) => {
        if (b.type === 'image' && b.src.endsWith('…')) {
          const o = doc.blocks.find((x) => x.id === b.id);
          if (o && o.type === 'image') return { ...b, src: o.src };
        }
        return b;
      });
      onChange(next);
      setDirty(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="json-panel">
      <div className="outline-head">
        <Caption1 className="muted">The document spec the AI writes. Edit it directly and apply.</Caption1>
        <div className="row gap4">
          <Button
            size="small"
            disabled={!dirty}
            onClick={() => {
              setDirty(false);
              setText(pretty);
              setError(null);
            }}
          >
            Revert
          </Button>
          <Button size="small" appearance="primary" disabled={!dirty} onClick={apply}>
            Apply
          </Button>
        </div>
      </div>
      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}
      <textarea
        className="json-editor"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            apply();
          }
        }}
      />
    </div>
  );
}
