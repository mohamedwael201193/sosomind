// ElevenLabs voice generation for Telegram voice briefings.
// Returns a Buffer (mp3) ready to send via ctx.replyWithVoice.

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'TxGEqnHWrfWFTfGW9XjX'; // "Josh" public preset
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;

export function hasVoice(): boolean {
  return Boolean(ELEVEN_KEY);
}

export async function generateVoiceBrief(text: string, voiceId: string = DEFAULT_VOICE_ID): Promise<Buffer> {
  if (!ELEVEN_KEY) throw new Error('ELEVENLABS_API_KEY not set');
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// Build a short, voice-friendly briefing script from research signal data.
export function briefingScript(opts: {
  asset?: string;
  price?: number;
  change24h?: number;
  etfFlow?: number;
  nextMacro?: string;
  signal?: { direction?: string; confidence?: number; entry?: number; takeProfit?: number; stopLoss?: number };
}): string {
  const parts: string[] = ['Good day. SosoMind market briefing.'];
  if (opts.asset && opts.price != null) {
    const sign = (opts.change24h ?? 0) >= 0 ? 'up' : 'down';
    parts.push(`${spell(opts.asset)} is trading at ${num(opts.price)}, ${sign} ${Math.abs(opts.change24h ?? 0).toFixed(1)} percent over the last twenty four hours.`);
  }
  if (opts.etfFlow != null) {
    const sign = opts.etfFlow >= 0 ? 'inflows' : 'outflows';
    parts.push(`ETF ${sign} of ${num(Math.abs(opts.etfFlow))} dollars.`);
  }
  if (opts.nextMacro) parts.push(`Watch the macro calendar: ${opts.nextMacro}.`);
  if (opts.signal?.direction) {
    parts.push(`Our AI signal is ${opts.signal.direction}, with ${opts.signal.confidence ?? 0} percent confidence.`);
    if (opts.signal.entry) parts.push(`Entry at ${num(opts.signal.entry)}.`);
    if (opts.signal.takeProfit) parts.push(`Take profit at ${num(opts.signal.takeProfit)}.`);
    if (opts.signal.stopLoss) parts.push(`Stop loss at ${num(opts.signal.stopLoss)}.`);
  }
  parts.push('This is not financial advice. Trade carefully.');
  return parts.join(' ');
}

function spell(asset: string): string {
  const m: Record<string, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana' };
  return m[asset.toUpperCase()] || asset;
}

function num(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' billion';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' million';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + ' thousand';
  return n.toFixed(2);
}
