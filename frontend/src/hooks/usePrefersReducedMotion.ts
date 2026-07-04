// usePrefersReducedMotion — reactive prefers-reduced-motion query for the 3D
// layer, built on the existing useMediaQuery subscription so a live OS/browser
// preference change (not just initial load) reaches the stage's frame loop.

import { useMediaQuery } from "./useMediaQuery";

const QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(QUERY);
}
