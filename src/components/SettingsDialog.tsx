import { useEffect, useState } from 'react';
import {
  Button,
  Caption1,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Link,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Slider,
} from '@fluentui/react-components';
import type { AiSettings, ProviderId } from '../types';
import { PROVIDERS } from '../ai/providers';

interface Props {
  open: boolean;
  settings: AiSettings;
  onClose: () => void;
  onSave: (s: AiSettings) => void;
}

export function SettingsDialog({ open, settings, onClose, onSave }: Props) {
  const [s, setS] = useState(settings);
  useEffect(() => {
    if (open) setS(settings);
  }, [open, settings]);
  const p = PROVIDERS[s.provider];
  const isLocal = s.provider === 'local';
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className="settings-dialog">
        <DialogBody>
          <DialogTitle>AI engine</DialogTitle>
          <DialogContent className="settings-content">
            <Field label="Provider">
              <RadioGroup value={s.provider} onChange={(_, d) => setS({ ...s, provider: d.value as ProviderId, model: '', baseUrl: '' })} layout="vertical">
                {Object.values(PROVIDERS).map((pr) => (
                  <Radio key={pr.id} value={pr.id} label={pr.label} />
                ))}
              </RadioGroup>
            </Field>
            {isLocal ? (
              <MessageBar intent="info">
                <MessageBarBody>
                  The built-in engine works offline and knows a fixed set of documents and commands, including physics notes on projectiles, forces, oscillations, circuits, optics and electromagnetic induction. To let the AI
                  write, draw and typeset <b>anything</b>, pick <b>Google Gemini</b> or <b>Groq</b>. Both give you a free API key in about a minute.
                </MessageBarBody>
              </MessageBar>
            ) : (
              <>
                <Field
                  label="API key"
                  hint={
                    p.keyUrl ? (
                      <>
                        Get one at{' '}
                        <Link href={p.keyUrl} target="_blank" inline>
                          {new URL(p.keyUrl).host}
                        </Link>
                      </>
                    ) : undefined
                  }
                >
                  <Input type="password" value={s.apiKey} placeholder={p.keyHint} onChange={(_, d) => setS({ ...s, apiKey: d.value.trim() })} />
                </Field>
                <Field label="Model">
                  <Combobox
                    freeform
                    value={s.model || p.defaultModel}
                    selectedOptions={[s.model || p.defaultModel]}
                    onOptionSelect={(_, d) => setS({ ...s, model: d.optionValue ?? '' })}
                    onChange={(e) => setS({ ...s, model: e.target.value })}
                  >
                    {p.models.map((m) => (
                      <Option key={m} value={m}>
                        {m}
                      </Option>
                    ))}
                  </Combobox>
                </Field>
                {s.provider === 'custom' || s.provider === 'openai' || s.provider === 'openrouter' ? (
                  <Field label="Base URL" hint="Any OpenAI-compatible endpoint (Ollama, LM Studio, Azure proxy, vLLM…)">
                    <Input value={s.baseUrl || p.baseUrl} onChange={(_, d) => setS({ ...s, baseUrl: d.value })} />
                  </Field>
                ) : null}
                <Field label={`Creativity (temperature ${s.temperature.toFixed(1)})`}>
                  <Slider min={0} max={1.2} step={0.1} value={s.temperature} onChange={(_, d) => setS({ ...s, temperature: d.value })} />
                </Field>
                <Caption1 className="muted">
                  Your key is stored only in this browser (localStorage) and requests go directly from your browser to {p.label}. Without a key, the built-in engine is used.
                </Caption1>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              onClick={() => {
                onSave(s);
                onClose();
              }}
            >
              Save
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
