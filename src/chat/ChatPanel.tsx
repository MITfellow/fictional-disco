import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { Button, Caption1, Spinner, Tooltip } from '@fluentui/react-components';
import { ArrowUp20Filled, Attach20Regular, ChevronDown12Regular, Dismiss16Regular, Stop20Filled } from '@fluentui/react-icons';
import type { Asset, ChatMessage } from '../types';
import { Markdown } from './Markdown';
import { fileToAsset } from '../images';

// From the simplest design to the richest one.
const SUGGESTIONS = [
  { label: 'Simple one-page handout on Newton’s laws', prompt: 'Make a simple, clean one-page handout on Newton’s three laws. Minimal style, airy spacing.' },
  { label: 'Electromagnetic induction chapter (5 pages)', prompt: 'Write a detailed 5-page chapter on electromagnetic induction (EMI) with all diagrams, equations, plots and worked examples' },
  { label: 'Projectile motion lecture notes', prompt: 'Create physics lecture notes on projectile motion with equations, a trajectory diagram, a plot and a worked example' },
  { label: 'Ohm’s law with circuit diagram', prompt: "Make notes on DC circuits and Ohm's law with a circuit diagram and I–V graph" },
  { label: 'Lab report: measuring g with a pendulum', prompt: 'Write a lab report on measuring g with a simple pendulum: aim, theory, method, data table, graph of T² against L, error analysis and conclusion' },
  { label: 'Detailed annual report with cover', prompt: 'Create a detailed annual report about renewable energy with a cover page, contents, charts, KPIs and a roadmap' },
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
  aiConnected: boolean;
}

export function ChatPanel({ messages, assets, busy, progress, engineLabel, onSend, onStop, onOpenSettings, aiConnected }: Props) {
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

  const userCount = messages.filter((m) => m.role === 'user').length;

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
        <span className="panel-name">Assistant</span>
        <button className="engine-chip" onClick={onOpenSettings} title="Choose AI model">
          <span className={`dot ${aiConnected ? 'on' : ''}`} />
          <span className="engine-label">{engineLabel}</span>
          <ChevronDown12Regular />
        </button>
      </header>

      <div className="messages" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role} ${m.error ? 'error' : ''}`}>
            <div className="bubble">
              {m.attachments?.length ? (
                <div className="thumbs">
                  {m.attachments.map((id) => (assets[id] ? <img key={id} src={assets[id].dataUrl} alt={assets[id].name} /> : null))}
                </div>
              ) : null}
              <Markdown text={m.text} />
            </div>
            {m.role === 'assistant' && (m.changes?.length || m.engine) ? (
              <div className="meta-row">
                {m.changes?.slice(0, 5).map((c, i) => (
                  <span key={i} className="change-tag">
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {busy ? (
          <div className="msg assistant">
            <div className="bubble thinking">
              {progress?.reply ? <Markdown text={progress.reply} /> : null}
              <div className="row gap8 muted">
                <Spinner size="extra-tiny" />
                <Caption1>{progress && progress.chars > 0 ? `Writing your document… ${(progress.chars / 1000).toFixed(1)}k characters` : 'Thinking…'}</Caption1>
              </div>
            </div>
          </div>
        ) : null}
        {!aiConnected && !busy && userCount <= 3 ? (
          <div className="note-card">
            <div>
              <strong>You are in offline mode.</strong> It can make a few built-in physics notes and templates. To let the AI write and design anything, add a free <b>Gemini</b> or <b>Groq</b> key.
            </div>
            <div className="row gap8">
              <Button size="small" appearance="primary" onClick={onOpenSettings}>
                Add free key
              </Button>
              <Button size="small" appearance="transparent" as="a" href="https://aistudio.google.com/app/apikey" target="_blank">
                Get a Gemini key ↗
              </Button>
            </div>
          </div>
        ) : null}
        {userCount === 0 && !busy ? (
          <div className="suggestions">
            <Caption1 className="muted">Start with an idea, from simple to detailed</Caption1>
            {SUGGESTIONS.map((sg) => (
              <button key={sg.label} className="suggestion" onClick={() => send(sg.prompt)}>
                {sg.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="composer">
        <div className="composer-box">
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
          <textarea
            className="composer-input"
            placeholder="Describe a document, or ask for a change…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            onPaste={onPaste}
            rows={Math.min(8, Math.max(2, text.split('\n').length))}
          />
          <div className="composer-bar">
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
              <Button appearance="subtle" size="small" icon={<Attach20Regular />} onClick={() => fileRef.current?.click()} />
            </Tooltip>
            {busy ? (
              <Tooltip content="Stop" relationship="label">
                <button className="send-btn stop" onClick={onStop} aria-label="Stop">
                  <Stop20Filled />
                </button>
              </Tooltip>
            ) : (
              <Tooltip content="Send (Enter)" relationship="label">
                <button className="send-btn" disabled={!text.trim() && !pending.length} onClick={() => send()} aria-label="Send">
                  <ArrowUp20Filled />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      {drag ? <div className="drop-overlay">Drop images to attach</div> : null}
    </section>
  );
}
