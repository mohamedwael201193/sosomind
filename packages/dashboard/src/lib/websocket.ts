"use client";

import { useEffect, useRef, useState } from "react";

function resolveWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const api = process.env.NEXT_PUBLIC_API_URL || "";
  if (api.includes("onrender.com")) {
    return api.replace(/^http/, "ws").replace(/\/$/, "") + ":10001";
  }
  return "ws://localhost:10001";
}

const WS_URL = resolveWsUrl();

interface WSMessage {
  channel: string;
  data: any;
}

const sockets: Map<string, WebSocket> = new Map();
const listeners: Map<string, Set<(msg: WSMessage) => void>> = new Map();

function getSocket(): WebSocket | null {
  if (typeof window === "undefined") return null;
  if (sockets.has("main")) {
    const existing = sockets.get("main")!;
    if (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING) {
      return existing;
    }
  }
  const ws = new WebSocket(WS_URL);
  sockets.set("main", ws);

  ws.onmessage = (event) => {
    try {
      const msg: WSMessage = JSON.parse(event.data);
      const channelListeners = listeners.get(msg.channel);
      if (channelListeners) {
        channelListeners.forEach((cb) => cb(msg));
      }
      // Also dispatch to "all" listeners
      const allListeners = listeners.get("*");
      if (allListeners) {
        allListeners.forEach((cb) => cb(msg));
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = () => {
    sockets.delete("main");
  };

  return ws;
}

export function useWebSocket(channel: string) {
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ws = getSocket();
    if (!ws) return;

    const onOpen = () => setIsConnected(true);
    const onClose = () => setIsConnected(false);

    ws.addEventListener("open", onOpen);
    ws.addEventListener("close", onClose);

    if (ws.readyState === WebSocket.OPEN) setIsConnected(true);

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
