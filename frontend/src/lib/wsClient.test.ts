import { describe, expect, it, vi } from "vitest";
import { createWsClient, type WebSocketLike } from "./wsClient";
import type { DebateEvent } from "./protocol";

// A minimal controllable WebSocket double. Tests drive lifecycle by calling the
// trigger* helpers, which fire the handlers the client registered.
class FakeWebSocket implements WebSocketLike {
  static last: FakeWebSocket | null = null;
  readonly OPEN = 1;
  readonly CONNECTING = 0;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readyState = 0;
  sent: string[] = [];
  closed = false;
  url: string;

  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.last = this;
  }

  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = this.CLOSED;
    this.onclose?.({});
  }

  triggerOpen() {
    this.readyState = this.OPEN;
    this.onopen?.({});
  }
  triggerMessage(data: unknown) {
    this.onmessage?.({ data });
  }
  triggerError() {
    this.onerror?.({});
  }
}

function harness() {
  const onEvent = vi.fn<(e: DebateEvent) => void>();
  const onStatus = vi.fn<(s: string) => void>();
  const onError = vi.fn<(m: string) => void>();
  const client = createWsClient({
    url: "ws://test/ws",
    onEvent,
    onStatus,
    onError,
    WebSocketImpl: FakeWebSocket,
  });
  return { client, onEvent, onStatus, onError };
}

describe("createWsClient", () => {
  it("sends exactly one ask message on open", () => {
    const { client } = harness();
    client.ask("Should we ship?", 4);
    FakeWebSocket.last!.triggerOpen();
    expect(FakeWebSocket.last!.sent).toEqual([
      JSON.stringify({ type: "ask", question: "Should we ship?", rounds: 4 }),
    ]);
  });

  it("transitions status connecting → open → closed", () => {
    const { client, onStatus } = harness();
    client.ask("hi");
    expect(onStatus).toHaveBeenCalledWith("connecting");
    FakeWebSocket.last!.triggerOpen();
    expect(onStatus).toHaveBeenCalledWith("open");
    FakeWebSocket.last!.close();
    expect(onStatus).toHaveBeenCalledWith("closed");
  });

  it("emits validated events from inbound frames", () => {
    const { client, onEvent } = harness();
    client.ask("hi");
    FakeWebSocket.last!.triggerOpen();
    FakeWebSocket.last!.triggerMessage(
      JSON.stringify({ type: "token", persona: "skeptic", round: 1, delta: "x" }),
    );
    expect(onEvent).toHaveBeenCalledWith({
      type: "token",
      persona: "skeptic",
      round: 1,
      delta: "x",
    });
  });

  it("routes a malformed frame to onError without throwing or emitting", () => {
    const { client, onEvent, onError } = harness();
    client.ask("hi");
    FakeWebSocket.last!.triggerOpen();
    expect(() => FakeWebSocket.last!.triggerMessage("{ broken")).not.toThrow();
    expect(onError).toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("rejects an invalid question before opening a socket", () => {
    const { client, onError, onStatus } = harness();
    const before = FakeWebSocket.last;
    client.ask("   ");
    expect(onError).toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalledWith("connecting");
    expect(FakeWebSocket.last).toBe(before); // no new socket constructed
  });

  it("treats onerror as advisory: status only, no abort", () => {
    // The browser fires `error` before every abnormal close (which the backend
    // always performs, success included), so onerror must not be a fatal onError.
    const { client, onStatus, onError } = harness();
    client.ask("hi");
    FakeWebSocket.last!.triggerError();
    expect(onStatus).toHaveBeenCalledWith("error");
    expect(onError).not.toHaveBeenCalled();
  });

  it("rejects an oversized frame before parsing", () => {
    const { client, onEvent, onError } = harness();
    client.ask("hi");
    FakeWebSocket.last!.triggerOpen();
    FakeWebSocket.last!.triggerMessage("x".repeat(256 * 1024 + 1));
    expect(onError).toHaveBeenCalledWith("frame too large");
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("dispose() detaches handlers so a late close can't dispatch", () => {
    const { client, onStatus } = harness();
    client.ask("hi");
    const sock = FakeWebSocket.last!;
    client.dispose();
    expect(sock.closed).toBe(true);
    onStatus.mockClear();
    sock.onclose?.({}); // a late event from the now-dead socket
    expect(onStatus).not.toHaveBeenCalled();
  });

  it("routes a non-text frame to onError", () => {
    const { client, onEvent, onError } = harness();
    client.ask("hi");
    FakeWebSocket.last!.triggerOpen();
    FakeWebSocket.last!.triggerMessage(new ArrayBuffer(4));
    expect(onError).toHaveBeenCalledWith("received a non-text frame");
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("refuses a second concurrent ask", () => {
    const { client, onError } = harness();
    client.ask("first");
    const sock = FakeWebSocket.last;
    client.ask("second");
    expect(onError).toHaveBeenCalledWith("a debate is already in progress");
    expect(FakeWebSocket.last).toBe(sock); // no second socket
  });

  it("close() closes the underlying socket", () => {
    const { client } = harness();
    client.ask("hi");
    const sock = FakeWebSocket.last!;
    client.close();
    expect(sock.closed).toBe(true);
  });
});
