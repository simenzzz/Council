// useDebate — React glue between the pure reducer and the stateless wsClient.
// Components call `ask()` / `stop()` and read `state`; all debate logic lives in
// the reducer, all transport in the client. The hook owns only the wiring.

import { useCallback, useEffect, useReducer, useRef } from "react";
import { createWsClient, type WsClient } from "../lib/wsClient";
import { DebatePlayer } from "./debatePlayer";
import { debateReducer, initialState, type DebateState } from "./debateReducer";

export type UseDebate = {
  state: DebateState;
  ask: (question: string, rounds?: number) => void;
  stop: () => void;
};

export function useDebate(): UseDebate {
  const [state, dispatch] = useReducer(debateReducer, initialState);
  const clientRef = useRef<WsClient | null>(null);
  // The player buffers the fast concurrent stream and re-dispatches it into the
  // reducer one persona at a time at a readable pace (see debatePlayer). `dispatch`
  // is stable, so a single player instance lives for the hook's lifetime.
  const playerRef = useRef<DebatePlayer | null>(null);
  if (playerRef.current === null) {
    playerRef.current = new DebatePlayer({ dispatch });
  }

  const ask = useCallback((question: string, rounds?: number) => {
    // Detach the previous client synchronously so its late onclose can't
    // dispatch into the new session, and reset the player's buffer/timers.
    clientRef.current?.dispose();
    playerRef.current?.reset();
    const client = createWsClient({
      onEvent: (event) => playerRef.current?.feed(event),
      onStatus: (status) => playerRef.current?.feedStatus(status),
      // Transport/boundary failures are advisory — recorded, not session-fatal.
      onError: (message) => playerRef.current?.feedTransport(message),
    });
    clientRef.current = client;
    client.ask(question, rounds);
  }, []);

  const stop = useCallback(() => {
    // Cancel paced playback first so no buffered turn dispatches after the stop.
    playerRef.current?.reset();
    dispatch({ kind: "cancel" });
    clientRef.current?.dispose();
    clientRef.current = null;
  }, []);

  // Tear down any open socket and cancel playback when the consumer unmounts.
  useEffect(
    () => () => {
      playerRef.current?.reset();
      clientRef.current?.dispose();
    },
    [],
  );

  return { state, ask, stop };
}
