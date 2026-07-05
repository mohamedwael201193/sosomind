"use client";

import { useEffect, useRef, useState } from "react";

import { API_URL, WS_URL as ENV_WS_URL } from './env';

function resolveWsUrl(): string {
  if (ENV_WS_URL) return ENV_WS_URL;
  try {
    const u = new URL(API_URL);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = '/ws';
    u.search = '';
    u.hash = '';
    u.port = '';
    return u.toString();
  } catch {
    return 'ws://localhost:10001';
  }
}

const WS_URL = resolveWsUrl();
const RECONNECT_MS = 4_000;
const MAX_RECONNECT_ATTEMPTS = 12;

interface WSMessage {
  channel: string;
  data: unknown;
}

let mainSocket: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners: Map<string, Set<(msg: WSMessage) => void>> = new Map();

function dispatchMessage(msg: WSMessage) {
  listeners.get(msg.channel)?.forEach((cb) => cb(msg));
  listeners.get("*")?.forEach((cb) => cb(msg));
}

function scheduleReconnect() {
  if (reconnectTimer || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempts += 1;
    connectSocket();
  }, RECONNECT_MS);
}

function connectSocket(): WebSocket | null {
  if (typeof window === "undefined") return null;
  if (mainSocket && (mainSocket.readyState === WebSocket.OPEN || mainSocket.readyState === WebSocket.CONNECTING)) {
    return mainSocket;
  }

  try {
    const ws = new WebSocket(WS_URL);
    mainSocket = ws;

    ws.onopen = () => {
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        dispatchMessage(msg);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      if (mainSocket === ws) mainSocket = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };

    return ws;
  } catch {
    scheduleReconnect();
    return null;
  }
}

export function useWebSocket(channel: string) {
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ws = connectSocket();
    if (!ws) return;

    const syncConnected = () => setIsConnected(mainSocket?.readyState === WebSocket.OPEN);
    const onOpen = () => syncConnected();
    const onClose = () => syncConnected();

    ws.addEventListener("open", onOpen);
    ws.addEventListener("close", onClose);
    syncConnected();

    const handler = (msg: WSMessage) => {
      setLastMessage(msg);
    };

    if (!listeners.has(channel)) {
      listeners.set(channel, new Set());
    }
    listeners.get(channel)!.add(handler);

    return () => {
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("close", onClose);
      listeners.get(channel)?.delete(handler);
    };
  }, [channel]);

  return { lastMessage, isConnected };
}
