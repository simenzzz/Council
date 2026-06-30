// useVerdictSpotlight — owns whether the moderator verdict spotlight is open.
// It opens once, on the *edge* into the moderator flow (… → moderating/done), so
// a within-session phase change (moderating → done) never re-opens a panel the
// user has already dismissed. Dismissal is therefore sticky for the session;
// `dismiss()` is also called by the host on a fresh ask to reset for next time.

import { useCallback, useEffect, useRef, useState } from "react";
import type { DebatePhase } from "./debateReducer";

const MODERATOR_PHASES: ReadonlySet<DebatePhase> = new Set(["moderating", "done"]);

export type VerdictSpotlight = {
  open: boolean;
  dismiss: () => void;
};

export function useVerdictSpotlight(phase: DebatePhase): VerdictSpotlight {
  const [open, setOpen] = useState(false);
  const prevPhase = useRef<DebatePhase>(phase);

  useEffect(() => {
    const enteredModeratorFlow =
      !MODERATOR_PHASES.has(prevPhase.current) && MODERATOR_PHASES.has(phase);
    if (enteredModeratorFlow) setOpen(true);
    prevPhase.current = phase;
  }, [phase]);

  const dismiss = useCallback(() => setOpen(false), []);

  return { open, dismiss };
}
