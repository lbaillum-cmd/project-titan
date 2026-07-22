"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL, api } from "./api";

export type RealtimeStatus = "connecting" | "live" | "offline";
export function useRealtime(onEvent: (event: { type: string }) => void) {
  const callback = useRef(onEvent);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  callback.current = onEvent;
  useEffect(() => {
    let socket: WebSocket | undefined;
    let disposed = false;
    async function connect() {
      try {
        const { ticket } = await api<{ ticket: string }>("/realtime/ticket", { method: "POST" });
        if (disposed) return;
        const url = new URL(API_URL);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.pathname = "/realtime";
        url.search = new URLSearchParams({ ticket }).toString();
        socket = new WebSocket(url);
        socket.onopen = () => setStatus("live");
        socket.onmessage = (message) => { const event = JSON.parse(String(message.data)) as { type: string }; if (event.type !== "connection.ready") callback.current(event); };
        socket.onerror = () => setStatus("offline");
        socket.onclose = () => { if (!disposed) setStatus("offline"); };
      } catch { if (!disposed) setStatus("offline"); }
    }
    void connect();
    return () => { disposed = true; socket?.close(); };
  }, []);
  return status;
}
