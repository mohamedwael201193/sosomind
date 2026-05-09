/**
 * Multi-provider AI client with automatic fallback.
 * Priority: Cerebras → SambaNova → Together → OpenRouter → Groq → Gemini
 * - 429 with daily/TPD limit keyword → 6h cooldown (provider exhausted for the day)
 * - 429 rate limit (per-minute) → 30s cooldown, try next immediately
 * - 5xx server error → 30s cooldown, try next
 * - All providers unavailable → returns null (never throws, callers handle gracefully)
 * - Responses cached in Redis 5 min (SHA-256 of prompt) to reduce provider calls
 */
import axios from 'axios';
import { createHash } from 'crypto';
import { redis } from './redis';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface AIResponse { provider: string; content: string }

// ─── provider configs ────────────────────────────────────────────────────────

interface Provider {
  name: string;
  envKey: string;
  call: (apiKey: string, messages: ChatMessage[], temperature: number) => Promise<string>;
}

/** OpenAI-compatible helper (used by Cerebras, SambaNova, Together, OpenRouter, Groq) */
function openaiCompat(
  baseUrl: string,
  model: string,
  extraHeaders: Record<string, string> = {},
  jsonMode = true,
) {
  return async (apiKey: string, messages: ChatMessage[], temperature: number): Promise<string> => {
    const body: any = { model, messages, temperature, max_tokens: 1000 };
    if (jsonMode) body.response_format = { type: 'json_object' };
    const r = await axios.post(baseUrl, body, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      timeout: 30000,
    });
    return r.data.choices[0]?.message?.content || '';
  };
}

const providers: Provider[] = [
  // 1. Cerebras — fastest inference (900 tok/s), generous free tier, no daily cap
  {
    name: 'cerebras',
    envKey: 'CEREBRAS_API_KEY',
    call: openaiCompat(
      'https://api.cerebras.ai/v1/chat/completions',
      process.env.CEREBRAS_MODEL || 'llama3.3-70b',
    ),
  },
  // 2. SambaNova — free, 60 RPM, high throughput Llama-3.3-70B
  {
    name: 'sambanova',
    envKey: 'SAMBANOVA_API_KEY',
    call: openaiCompat(
      'https://api.sambanova.ai/v1/chat/completions',
      process.env.SAMBANOVA_MODEL || 'Meta-Llama-3.3-70B-Instruct',
    ),
  },
  // 3. Together AI — free model (Llama-3.3-70B-Turbo-Free), no credit card
  {
    name: 'together',
    envKey: 'TOGETHER_API_KEY',
    call: openaiCompat(
      'https://api.together.xyz/v1/chat/completions',
      process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
    ),
  },
  // 4. OpenRouter — free llama model, good daily limits
  {
    name: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    call: openaiCompat(
      'https://openrouter.ai/api/v1/chat/completions',
      process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
      { 'HTTP-Referer': 'https://sosomind.app', 'X-Title': 'SosoMind' },
    ),
  },
  // 5. Groq — very fast, but lower daily token limit (100k TPD on free tier)
  {
    name: 'groq',
    envKey: 'GROQ_API_KEY',
    call: openaiCompat(
      'https://api.groq.com/openai/v1/chat/completions',
      process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    ),
  },
  // 6. Gemini — fallback; different API structure
  {
    name: 'gemini',
    envKey: 'GEMINI_API_KEY',
    call: async (apiKey, messages, temperature) => {
      const systemMsg = messages.find((m) => m.role === 'system');
      const userMsgs = messages.filter((m) => m.role !== 'system');
      const contents = userMsgs.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const body: any = {
        contents,
        generationConfig: {
          temperature,
          responseMimeType: 'application/json',
          maxOutputTokens: 1000,
        },
      };
      if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const r = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        body,
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 },
      );
      return r.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },
  },
];

// ─── cooldown tracking ───────────────────────────────────────────────────────

const cooldowns = new Map<string, number>(); // provider → cooldown-until ms
const RATE_LIMIT_COOLDOWN_MS = 30_000;   // 30 s for per-minute 429s
const DAILY_LIMIT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 h for daily quota exhaustion

function isAvailable(name: string) {
  const until = cooldowns.get(name) ?? 0;
  return Date.now() >= until;
}

/** Returns true if the error message indicates a daily/total quota is exhausted */
function isDailyLimit(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('per day') ||
    lower.includes('tpd') ||
    lower.includes('daily') ||
    lower.includes('tokens per day') ||
    lower.includes('quota') ||
    lower.includes('exceeded your current') ||
    lower.includes('upgrade') // "upgrade to dev tier" etc.
  );
}

function setCooldown(name: string, msg: string) {
  const ms = isDailyLimit(msg) ? DAILY_LIMIT_COOLDOWN_MS : RATE_LIMIT_COOLDOWN_MS;
  cooldowns.set(name, Date.now() + ms);
  const label = ms >= 3600_000 ? `${ms / 3600_000}h (daily limit)` : `${ms / 1000}s`;
  console.warn(`[ai] provider "${name}" on cooldown for ${label}`);
}

// ─── response cache (Redis, 5 min TTL) ───────────────────────────────────────

const AI_CACHE_TTL = 300;

function promptHash(messages: ChatMessage[], temperature: number): string {
  const raw = JSON.stringify({ messages, temperature });
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

async function getCachedResponse(hash: string): Promise<AIResponse | null> {
  try {
    const cached = await redis.get<AIResponse>(`ai:resp:${hash}`);
    if (cached) return cached;
  } catch {}
  return null;
}

async function setCachedResponse(hash: string, response: AIResponse): Promise<void> {
  try {
    await redis.set(`ai:resp:${hash}`, response, { ex: AI_CACHE_TTL });
  } catch {}
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Send a chat-completion request across 6 providers with auto-fallback.
 * Returns null (never throws) if every provider is exhausted or on cooldown —
 * callers must handle null gracefully (price-based fallback, friendly UI message).
 * Responses cached in Redis 5 min to prevent redundant calls.
 */
export async function chatComplete(
  messages: ChatMessage[],
  temperature = 0.4,
): Promise<AIResponse | null> {
  // Return cached result — no provider call needed
  const hash = promptHash(messages, temperature);
  const cached = await getCachedResponse(hash);
  if (cached) {
    console.info(`[ai] cache hit (${hash.slice(0, 8)})`);
    return cached;
  }

  for (const provider of providers) {
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;
    if (!isAvailable(provider.name)) continue; // silently skip — no error log spam

    try {
      const content = await provider.call(apiKey, messages, temperature);
      console.info(`[ai] used provider: ${provider.name}`);
      const response: AIResponse = { provider: provider.name, content };
      await setCachedResponse(hash, response);
      return response;
    } catch (e: any) {
      const status = e?.response?.status;
      const msg: string =
        e?.response?.data?.error?.message ||
        JSON.stringify(e?.response?.data) ||
        e?.message ||
        String(e);

      if (status === 429 || (status >= 500 && status < 600)) {
        setCooldown(provider.name, msg);
      } else if (status === 404 || status === 401 || status === 403) {
        // Model not found / auth error — cooldown 5 min, don't retry every request
        cooldowns.set(provider.name, Date.now() + 5 * 60 * 1000);
        console.warn(`[ai] "${provider.name}" error ${status}: ${msg.slice(0, 120)} — cooldown 5min`);
      } else {
        // other errors — log but don't cooldown
        console.warn(`[ai] "${provider.name}" error ${status ?? '?'}: ${msg.slice(0, 120)}`);
      }
      // always try next provider
    }
  }

  console.warn('[ai] all providers unavailable — returning null');
  return null;
}

/**
 * Returns true if at least one provider has a key configured.
 */
export function hasAI(): boolean {
  return providers.some((p) => Boolean(process.env[p.envKey]));
}

/**
 * Status of each provider (for health endpoint / logging).
 */
export function aiProviderStatus() {
  return providers.map((p) => ({
    name: p.name,
    configured: Boolean(process.env[p.envKey]),
    available: isAvailable(p.name),
    cooldownUntil: cooldowns.get(p.name) ?? null,
  }));
}
