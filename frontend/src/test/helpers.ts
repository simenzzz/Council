// Test helpers — fold a sequence of inputs through the real reducer to produce a
// canned DebateState. Component tests render from these states, so they exercise
// exactly the shapes the live reducer emits (no hand-built state that could drift).

import { debateReducer, initialState, type DebateInput, type DebateState } from "../state/debateReducer";

/** Reduce a sequence of wire events / control inputs into a final state. */
export function buildState(inputs: readonly DebateInput[]): DebateState {
  return inputs.reduce<DebateState>((state, input) => debateReducer(state, input), initialState);
}
