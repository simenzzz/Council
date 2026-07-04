// useMediaQuery — subscribe to a CSS media query and re-render when it changes.
// SSR/jsdom-safe: when `window.matchMedia` is unavailable it reports `false`, so
// consumers degrade to their narrow-screen branch rather than throwing. Used by
// App to pick the stage-first StageLayout at md+ vs. the 2D MobileLayout below it
// (the latter never mounts the 3D canvas, so no R3F bundle is downloaded).

import { useEffect, useState } from "react";

function matchMediaSafe(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(query);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMediaSafe(query)?.matches ?? false);

  useEffect(() => {
    const mql = matchMediaSafe(query);
    if (!mql) return;

    const onChange = () => setMatches(mql.matches);
    onChange(); // Sync in case the query changed or matched before subscribing.
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
