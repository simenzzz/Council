// StageEffects — a perf-guarded bloom pass over the chamber's emissive accents.
// Only the toneMapped:false accent meshes (visor, chest light, ring, antenna
// tip, gavel head, spotlights) sit above the luminance threshold, so the matte
// chassis stays untouched — the neon signals bloom, the robots don't glow all
// over. Mounted only inside the Canvas (which App gates to md+ screens via the
// stage-first StageLayout), so mobile/low-end never pays for it; the caller
// additionally skips mounting this when the user prefers reduced motion, since
// bloom is a purely atmospheric effect that conveys no state.

import { Bloom, EffectComposer } from "@react-three/postprocessing";

const LUMINANCE_THRESHOLD = 1;
const LUMINANCE_SMOOTHING = 0.15;
const INTENSITY = 0.6;
const RADIUS = 0.55;

export function StageEffects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        mipmapBlur
        luminanceThreshold={LUMINANCE_THRESHOLD}
        luminanceSmoothing={LUMINANCE_SMOOTHING}
        intensity={INTENSITY}
        radius={RADIUS}
      />
    </EffectComposer>
  );
}
