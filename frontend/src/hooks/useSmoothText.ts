// useSmoothText — a pure display hook that reveals a growing target string at a
// calm, steady cadence instead of in bursts. The backend streams all personas
// concurrently (bursty token deltas); feeding each column's text through this
// hook de-jitters the four simultaneous streams so they read as a debate rather
// than crowd noise. The reducer remains the single source of truth — this only
// paces *display*, never the data.
//
// While `animate` is true it advances toward `target` on a requestAnimationFrame
// loop, catching up smoothly when the stream runs ahead and easing as it nears
// the end. It snaps to the full target when animation is off, when the user
// prefers reduced motion, or when `target` shrinks (e.g. a new session resets the
// transcript to empty).

import { useEffect, useRef, useState } from "react";

// Per-frame reveal: a fraction of the remaining gap (so it eases near the end),
// floored at a few chars so it never stalls when only slightly behind.
const CATCHUP_FACTOR = 0.18;
const MIN_STEP = 2;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useSmoothText(target: string, animate: boolean): string {
  const [revealed, setRevealed] = useState(target.length);
  // Mirror of `revealed` driven synchronously by the loop, so progression and
  // the terminate-when-caught-up decision never depend on reading state set
  // inside an updater (keeps updaters pure and guarantees the loop stops).
  const revealedRef = useRef(target.length);
  const frame = useRef<number | null>(null);

  const set = (n: number) => {
    revealedRef.current = n;
    setRevealed(n);
  };

  useEffect(() => {
    // Snap immediately when not animating or when the user opts out of motion.
    if (!animate || prefersReducedMotion()) {
      set(target.length);
      return;
    }

    // Clamp first so a shrunk/reset target can't leave a stale longer prefix.
    if (revealedRef.current > target.length) set(target.length);

    // Advance toward the target; stop scheduling once caught up. Any later growth
    // of `target` re-runs this effect (it's a dependency), restarting the loop.
    const tick = () => {
      const r = revealedRef.current;
      if (r >= target.length) {
        frame.current = null;
        return;
      }
      const gap = target.length - r;
      const step = Math.max(MIN_STEP, Math.ceil(gap * CATCHUP_FACTOR));
      set(Math.min(target.length, r + step));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [target, animate]);

  // Guard against `revealed` exceeding a freshly-shortened target between renders.
  return target.slice(0, Math.min(revealed, target.length));
}
