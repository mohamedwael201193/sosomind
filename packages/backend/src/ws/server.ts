import { WebSocketServer, WebSocket } from 'ws';
import { sosovalue } from '../clients/sosovalue';
import { sodex } from '../clients/sodex';
import { supabase, subscribeToSignals } from '../db/supabase';

export type WsChannel = 'prices' | 'orderbook' | 'trades' | 'signals' | 'alerts';

const WS_PORT = parseInt(process.env.WS_PORT || '10001', 10);

const channelClients = new Map<WsChannel, Set<WebSocket>>();
const ALL_CHANNELS: WsChannel[] = ['prices', 'orderbook', 'trades', 'signals', 'alerts'];
for (const ch of ALL_CHANNELS) channelClients.set(ch, new Set());

let wssRef: WebSocketServer | null = null;

export function broadcast(channel: WsChannel, data: unknown): number {
  const msg = JSON.stringify({ channel, ts: Date.now(), data });
  const clients = channelClients.get(channel);
  if (!clients) return 0;
  let sent = 0;
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) { ws.send(msg); sent++; }
  }
  return sent;
}

export function getWsStats(): { running: boolean; port: number; connections: number; channels: Record<string, number> } {
  const channels: Record<string, number> = {};
  let total = 0;
  for (const ch of ALL_CHANNELS) {
    const n = channelClients.get(ch)?.size ?? 0;
    channels[ch] = n;
    total += n;
  }
  return { running: !!wssRef, port: WS_PORT, connections: total, channels };
}

function subscribe(ws: WebSocket, channel: WsChannel) {
  for (const clients of channelClients.values()) clients.delete(ws);
  channelClients.get(channel)?.add(ws);
}

export function startWebSocketServer(): WebSocketServer {
  const wss = new WebSocketServer({ port: WS_PORT });
  wssRef = wss;

  // Supabase realtime: push new signals instantly
  try {
    subscribeToSignals((signal) => broadcast('signals', signal));
  } catch (e) {
    console.warn('[ws] supabase realtime hookup failed:', (e as Error).message);
  }

  wss.on('connection', (ws) => {
    // Default: subscribe to prices
    subscribe(ws, 'prices');
    ws.send(JSON.stringify({ channel: 'meta', data: { message: 'Connected to SosoMind WS. Send {"subscribe":"prices|orderbook|trades|signals|alerts"}' } }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.subscribe && ALL_CHANNELS.includes(msg.subscribe)) {
          subscribe(ws, msg.subscribe as WsChannel);
          ws.send(JSON.stringify({ channel: 'meta', data: { subscribed: msg.subscribe } }));
        }
      } catch {}
    });

    ws.on('close', () => {
      for (const clients of channelClients.values()) clients.delete(ws);
    });
  });

  console.log(`🔌 WebSocket server on ws://localhost:${WS_PORT}`);

  // Push prices every 15s for BTC/ETH/SOL
  setInterval(async () => {
    try {
      const assets = ['BTC', 'ETH', 'SOL'];
      const snapshots = await Promise.allSettled(
        assets.map((a) => sosovalue.getMarketSnapshot(a).then((d) => ({ asset: a, ...d })))
      );
      const prices = snapshots
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<any>).value);
      broadcast('prices', prices);
    } catch {}
  }, 15_000);

  // Push orderbook every 10s for BTC_vUSDC
  setInterval(async () => {
    try {
      const ob = await sodex.getSpotOrderbook('BTC_vUSDC', 10);
      broadcast('orderbook', ob);
    } catch {}
  }, 10_000);

  // Push recent signals every 30s
  setInterval(async () => {
    try {
      const { data } = await supabase.from('signals').select('*').order('created_at', { ascending: false }).limit(5);
      if (data) broadcast('signals', data);
    } catch {}
  }, 30_000);

  // Push recent alerts every 60s
  setInterval(async () => {
    try {
      const { data } = await supabase.from('alerts').select('*').eq('triggered', true).order('triggered_at', { ascending: false }).limit(5);
      if (data) broadcast('alerts', data);
    } catch {}
  }, 60_000);

  return wss;
}
