// wsClient — a thin, framework-agnostic wrapper over a single WebSocket to the
// Council backend. It connects, sends exactly one `ask` message, then validates
// and emits every inbound frame as a typed event. It holds NO application
// state: callers own state (see state/debateReducer.ts). The backend closes the
// socket via CloseNow() with no status code on both success and failure, so a
// `closed` status alone can't tell done from error — that's the reducer's job
// (it keys off the `verdict` event).

import { buildAsk, parseEvent, type DebateEvent } from "./protocol";

export type WsStatus = "idle" | "connecting" | "open" | "closed" | "error";

/** Minimal constructor shape so tests can inject a fake WebSocket. */
export type WebSocketLike = {
  readonly OPEN: number;
  readonly CONNECTING: number;
  readonly CLOSING: number;
  readonly CLOSED: number;
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
};

export type WebSocketCtor = new (url: string) => WebSocketLike;

export type WsClientOptions = {
  /** Defaults to VITE_WS_URL, then ws://localhost:8080/ws for dev. */
  url?: string;
  onEvent: (event: DebateEvent) => void;
  onStatus: (status: WsStatus) => void;
  /** Boundary/transport failures (bad frame, socket error). Non-fatal per call. */
  onError: (message: string) => void;
  /** Injectable WebSocket implementation; defaults to the global. */
  WebSocketImpl?: WebSocketCtor;
};

export type WsClient = {
  /** Open the socket and send one `ask`. Validates inputs before connecting. */
  ask(question: string, rounds?: number): void;
  /** Gracefully close the socket (fires `closed`); the backend cancels the session. */
  close(): void;
  /**
   * Detach all handlers and close immediately. Use when superseding or
   * discarding a client so its late `onclose` can't dispatch into a new session.
   */
  dispose(): void;
};

// The backend caps inbound frames at 8 KiB, but server→client frames are
// unbounded; reject oversized frames before JSON.parse to protect the main
// thread. Generous vs. a real verdict, tight vs. a hostile flood.
const MAX_FRAME_CHARS = 256 * 1024;

function defaultUrl(): string {
  const fromEnv =
    typeof import.meta !== "undefined" ? import.meta.env?.VITE_WS_URL : undefined;
  return fromEnv ?? "ws://localhost:8080/ws";
}

export function createWsClient(opts: WsClientOptions): WsClient {
  const Impl = opts.WebSocketImpl ?? (globalThis.WebSocket as unknown as WebSocketCtor);
  const url = opts.url ?? defaultUrl();
  let socket: WebSocketLike | null = null;

  function detach(sock: WebSocketLike) {
    sock.onopen = null;
    sock.onmessage = null;
    sock.onclose = null;
    sock.onerror = null;
  }

  return {
    ask(question: string, rounds?: number) {
      const built = buildAsk(question, rounds);
      if (!built.ok) {
        opts.onError(built.error);
        return;
      }
      if (socket) {
        opts.onError("a debate is already in progress");
        return;
      }

      opts.onStatus("connecting");
      socket = new Impl(url);

      socket.onopen = () => {
        opts.onStatus("open");
        socket?.send(JSON.stringify(built.message));
      };

      socket.onmessage = (ev) => {
        if (typeof ev.data !== "string") {
          opts.onError("received a non-text frame");
          return;
        }
        if (ev.data.length > MAX_FRAME_CHARS) {
          opts.onError("frame too large");
          return;
        }
        const result = parseEvent(ev.data);
        if (!result.ok) {
          opts.onError(result.error);
          return;
        }
        opts.onEvent(result.event);
      };

      // Advisory only: the browser fires `error` immediately before every
      // abnormal close (which the backend always performs, success included),
      // so this must not change debate state. `onclose` is the termination
      // signal; the reducer infers done vs. disconnect from the `verdict` event.
      socket.onerror = () => {
        opts.onStatus("error");
      };

      socket.onclose = () => {
        opts.onStatus("closed");
        if (socket) detach(socket);
        socket = null;
      };
    },

    close() {
      if (!socket) return;
      socket.close();
    },

    dispose() {
      if (!socket) return;
      const dead = socket;
      socket = null;
      detach(dead);
      try {
        dead.close();
      } catch {
        // closing an already-closing socket is a no-op we can ignore
      }
    },
  };
}
