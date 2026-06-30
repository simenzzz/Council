// useDebate — React glue between the pure reducer and the stateless wsClient.
// Components call `ask()` / `stop()` and read `state`; all debate logic lives in
// the reducer, all transport in the client. The hook owns only the wiring.

import { useCallback, useEffect, useReducer, useRef } from "react";
import { createWsClient, type WsClient } from "../lib/wsClient";
import { debateReducer, initialState, type DebateState } from "./debateReducer";

export type UseDebate = {
  state: DebateState;
  ask: (question: string, rounds?: number) => void;
  stop: () => void;
};

export function useDebate(): UseDebate {
  const [state, dispatch] = useReducer(debateReducer, initialState);
  const clientRef = useRef<WsClient | null>(null);

  const ask = useCallback((question: string, rounds?: number) => {
    // Detach the previous client synchronously so its late onclose can't
    // dispatch into the new session.
    clientRef.current?.dispose();
    const client = createWsClient({
      onEvent: (event) => dispatch(event),
      onStatus: (status) => dispatch({ kind: "status", status }),
      // Transport/boundary failures are advisory — recorded, not session-fatal.
      onError: (message) => dispatch({ kind: "transport", message }),
    });
    clientRef.current = client;
    client.ask(question, rounds);
  }, []);

  const stop = useCallback(() => {
    dispatch({ kind: "cancel" });
    clientRef.current?.dispose();
    clientRef.current = null;
  }, []);

  // Tear down any open socket when the consumer unmounts.
  useEffect(() => () => clientRef.current?.dispose(), []);

  return { state, ask, stop };
}
