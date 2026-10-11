import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { Avatar, Badge, Button, Caption1, Spinner, Text, Textarea, Tooltip } from '@fluentui/react-components';
import {
  Attach20Regular,
  Book20Regular,
  Building20Regular,
  CalendarLtr20Regular,
  ChartMultiple20Regular,
  Delete20Regular,
  Dismiss16Regular,
  Flowchart20Regular,
  Person24Filled,
  Receipt20Regular,
  Send24Filled,
  Sparkle20Filled,
  Stop24Filled,
} from '@fluentui/react-icons';
import type { Asset, ChatMessage } from '../types';
import { Markdown } from './Markdown';
import { fileToAsset } from '../images';

const SUGGESTIONS = [
  { icon: <ChartMultiple20Regular />, title: 'Annual report', prompt: 'Create an annual report about renewable energy with charts, KPIs and a roadmap' },
  { icon: <Building20Regular />, title: 'Business proposal', prompt: 'Write a proposal for a website redesign with pricing and timeline' },
  { icon: <Book20Regular />, title: 'Study guide', prompt: 'Make a study guide about photosynthesis with a mind map' },
  { icon: <Flowchart20Regular />, title: 'Flowchart', prompt: 'Add flowchart: Idea -> Research -> Prototype -> Works? -> [Yes] Launch; Works? -> [No] Research' },
  { icon: <Receipt20Regular />, title: 'Invoice', prompt: 'Create an invoice for Contoso Ltd' },
  { icon: <CalendarLtr20Regular />, title: 'Project plan', prompt: 'Build a project plan for a CRM migration in the midnight theme' },
];

interface Props {
  messages: ChatMessage[];
  assets: Record<string, Asset>;
  busy: boolean;
  progress: { chars: number; reply: string } | null;
  engineLabel: string;
  onSend: (text: string, attachments: Asset[]) => void;
  onStop: () => void;
  onOpenSettings: () => void;
  onClear: () => void;
}

export function ChatPanel({ messages, assets, busy, progress, engineLabel, onSend, onStop, onOpenSettings, onClear }: Props) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Asset[]>([]);
  const [drag, setDrag] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy, progress?.reply]);

  const addFiles = async (files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const out: Asset[] = [];
    for (const f of imgs) {
      try {
        out.push(await fileToAsset(f));
      } catch (e) {
        console.warn(e);
      }
    }
    if (out.length) setPending((p) => [...p, ...out]);
  };

  const send = (value = text) => {
    const v = value.trim();
    if ((!v && !pending.length) || busy) return;
    onSend(v || 'Add the attached image(s) to the document', pending);
    setText('');
    setPending([]);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };
  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      addFiles(files);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const showSuggestions = messages.filter((m) => m.role === 'user').length === 0;

  return (
    <section
      className={`panel chat ${drag ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDrag(false);
      }}
      onDrop={onDrop}
    >
      <header className="panel-head">
        <div className="panel-title">
          <span className="ai-orb">
            <Sparkle20Filled />
          </span>
          <div className="stack">
            <Text weight="semibold">AI Designer</Text>
            <Caption1 className="muted">{engineLabel}</Caption1>
          </div>
        </div>
        <div className="row gap4">
          <Tooltip content="AI provider & model" relationship="label">
            <Button size="small" appearance="subtle" onClick={onOpenSettings}>
              Model
            </Button>
          </Tooltip>
          <Tooltip content="Clear conversation" relationship="label">
            <Button size="small" appearance="subtle" icon={<Delete20Regular />} onClick={onClear} />
          </Tooltip>
        </div>
      </header>

      <div className="messages" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role} ${m.error ? 'error' : ''}`}>
            {m.role === 'assistant' ? (
              <span className="ai-orb small">
                <Sparkle20Filled />
              </span>
            ) : (
              <Avatar size={28} icon={<Person24Filled />} color="brand" />
            )}
            <div className="bubble-wrap">
              <div className="bubble">
                {m.attachments?.length ? (
                  <div className="thumbs">
                    {m.attachments.map((id) => (assets[id] ? <img key={id} src={assets[id].dataUrl} alt={assets[id].name} /> : null))}
                  </div>
                ) : null}
                <Markdown text={m.text} />
              </div>
              {m.changes?.length || m.engine ? (
                <div className="meta-row">
                  {m.changes?.slice(0, 6).map((c, i) => (
                    <Badge key={i} appearance="tint" size="small" color={m.error ? 'danger' : 'brand'} shape="rounded">
                      {c}
                    </Badge>
                  ))}
                  {m.engine && m.role === 'assistant' ? <Caption1 className="muted">{m.engine}</Caption1> : null}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {busy ? (
          <div className="msg assistant">
            <span className="ai-orb small pulse">
              <Sparkle20Filled />
            </span>
            <div className="bubble-wrap">
              <div className="bubble thinking">
                {progress?.reply ? <Markdown text={progress.reply} /> : null}
                <div className="row gap8">
                  <Spinner size="extra-tiny" />
                  <Caption1>{progress && progress.chars > 0 ? `Designing your document… ${(progress.chars / 1000).toFixed(1)}k chars` : 'Thinking…'}</Caption1>
                </div>
                <div className="shimmer" />
              </div>
            </div>
          </div>
        ) : null}
        {showSuggestions && !busy ? (
          <div className="suggestions">
            <Caption1 className="muted">Try one of these</Caption1>
            <div className="suggestion-grid">
              {SUGGESTIONS.map((s) => (
                <button key={s.title} className="suggestion" onClick={() => send(s.prompt)}>
                  <span className="s-icon">{s.icon}</span>
                  <span>
                    <strong>{s.title}</strong>
                    <span className="s-prompt">{s.prompt}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="composer">
        {pending.length ? (
          <div className="pending">
            {pending.map((a) => (
              <div key={a.id} className="pending-item">
                <img src={a.dataUrl} alt={a.name} />
                <button aria-label="Remove" onClick={() => setPending((p) => p.filter((x) => x.id !== a.id))}>
                  <Dismiss16Regular />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <Textarea
          className="composer-input"
          appearance="filled-lighter"
          resize="none"
          placeholder="Describe a document, or ask for a change…  (Shift+Enter for a new line)"
          value={text}
          onChange={(_, d) => setText(d.value)}
          onKeyDown={onKey}
          onPaste={onPaste}
          rows={Math.min(8, Math.max(2, text.split('\n').length))}
        />
        <div className="composer-bar">
          <div className="row gap4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Tooltip content="Attach images (or paste / drop them)" relationship="label">
              <Button appearance="subtle" icon={<Attach20Regular />} onClick={() => fileRef.current?.click()} />
            </Tooltip>
            <Caption1 className="muted hint">Enter to send</Caption1>
          </div>
          {busy ? (
            <Button appearance="secondary" icon={<Stop24Filled />} onClick={onStop}>
              Stop
            </Button>
          ) : (
            <Button appearance="primary" icon={<Send24Filled />} disabled={!text.trim() && !pending.length} onClick={() => send()}>
              Send
            </Button>
          )}
        </div>
      </div>
      {drag ? <div className="drop-overlay">Drop images to attach</div> : null}
    </section>
  );
}
