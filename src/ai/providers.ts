import type { AiSettings, ProviderId } from '../types';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  defaultModel: string;
  models: string[];
  baseUrl: string;
  keyHint: string;
  keyUrl?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  local: { id: 'local', label: 'Built-in engine (offline)', defaultModel: 'fluent-local', models: ['fluent-local'], baseUrl: '', keyHint: 'No key needed' },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4.1-mini',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'gpt-5', 'gpt-5-mini', 'o4-mini'],
    baseUrl: 'https://api.openai.com/v1',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    defaultModel: 'claude-sonnet-4-5',
    models: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5', 'claude-3-7-sonnet-latest'],
    baseUrl: 'https://api.anthropic.com/v1',
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyHint: 'AIza…',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'openai/gpt-4.1-mini',
    models: ['openai/gpt-4.1-mini', 'anthropic/claude-sonnet-4.5', 'google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct', 'qwen/qwen-2.5-72b-instruct', 'x-ai/grok-4'],
    baseUrl: 'https://openrouter.ai/api/v1',
    keyHint: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
  },
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    defaultModel: 'llama3.1',
    models: ['llama3.1', 'qwen2.5', 'mistral'],
    baseUrl: 'http://localhost:11434/v1',
    keyHint: 'optional',
  },
};

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Reads a Server-Sent-Events stream and yields each `data:` payload. */
async function* sse(res: Response, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, '');
      buf = buf.slice(idx + 1);
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (data && data !== '[DONE]') yield data;
      }
    }
  }
}

async function errorText(res: Response) {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const j = await res.json();
    msg = j?.error?.message ?? j?.message ?? JSON.stringify(j).slice(0, 300);
  } catch {
    /* ignore */
  }
  if (res.status === 401 || res.status === 403) msg = `Authentication failed — check your API key. (${msg})`;
  return msg;
}

/**
 * Streams a completion from the configured provider directly from the browser.
 * `onDelta` receives the accumulated text so far.
 */
export async function streamCompletion(settings: AiSettings, system: string, turns: ChatTurn[], onDelta: (full: string) => void, signal?: AbortSignal): Promise<string> {
  const p = PROVIDERS[settings.provider];
  const model = settings.model || p.defaultModel;
  const base = (settings.baseUrl || p.baseUrl).replace(/\/+$/, '');
  let full = '';
  const push = (t?: string) => {
    if (!t) return;
    full += t;
    onDelta(full);
  };

  if (settings.provider === 'anthropic') {
    const res = await fetch(`${base}/messages`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, system, max_tokens: 16000, temperature: settings.temperature, stream: true, messages: turns }),
    });
    if (!res.ok) throw new Error(await errorText(res));
    for await (const data of sse(res, signal)) {
      try {
        const j = JSON.parse(data);
        if (j.type === 'content_block_delta') push(j.delta?.text);
        if (j.type === 'error') throw new Error(j.error?.message ?? 'Anthropic error');
      } catch (e) {
        if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
      }
    }
    return full;
  }

  if (settings.provider === 'gemini') {
    const url = `${base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(settings.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
        generationConfig: { temperature: settings.temperature, responseMimeType: 'application/json', maxOutputTokens: 32000 },
      }),
    });
    if (!res.ok) throw new Error(await errorText(res));
    for await (const data of sse(res, signal)) {
      try {
        const j = JSON.parse(data);
        const parts = j.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) if (!part.thought) push(part.text);
      } catch {
        /* ignore partial */
      }
    }
    return full;
  }

  // OpenAI-compatible (OpenAI, OpenRouter, custom / local servers)
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`;
  if (settings.provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'Fluent PDF Studio';
  }
  const isReasoning = /^(o\d|gpt-5)/.test(model);
  const body: Record<string, unknown> = {
    model,
    stream: true,
    messages: [{ role: 'system', content: system }, ...turns],
  };
  if (!isReasoning) body.temperature = settings.temperature;
  if (settings.provider === 'openai') body.response_format = { type: 'json_object' };
  const res = await fetch(`${base}/chat/completions`, { method: 'POST', signal, headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await errorText(res));
  for await (const data of sse(res, signal)) {
    try {
      const j = JSON.parse(data);
      if (j.error) throw new Error(j.error.message ?? 'Provider error');
      push(j.choices?.[0]?.delta?.content);
    } catch (e) {
      if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
    }
  }
  return full;
}

/** Pull the (possibly incomplete) "reply" string out of a streaming JSON response for live display. */
export function partialReply(raw: string): string {
  const m = /"reply"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(raw);
  if (!m) return '';
  try {
    return JSON.parse(`"${m[1].replace(/\\$/, '')}"`);
  } catch {
    return m[1];
  }
}
