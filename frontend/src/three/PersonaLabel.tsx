// PersonaLabel — a persona's floating identity + speech bubble, anchored above
// its robot's head via drei's <Html> (real DOM positioned in the 3D scene, so the
// text is crisp, styleable, and uses the app's fonts). Always shows a compact
// nameplate; when the persona is contributing it adds a bubble of its latest text,
// revealed at a calm cadence with useSmoothText. The full transcript lives in the
// drawer, so the bubble is height-capped.
//
// The bubble is aria-hidden and pointer-events:none: it is a decorative visual
// echo, so it must never intercept OrbitControls drags nor be read by assistive
// tech. The readable transcript lives in the on-demand TranscriptDrawer, and live
// phase/round progress is announced by ConnectionStatus in the Docket. Content is
// derived purely upstream (bubbleContent); this component is visual only (drei
// <Html> needs a DOM canvas, so it is exercised by visual QA, not headless tests).

import { Html } from "@react-three/drei";
import type { CSSProperties } from "react";
import { useSmoothText } from "../hooks/useSmoothText";
import type { PersonaBubble } from "./bubbleContent";
import { TypingIndicator } from "../components/transcript/TypingIndicator";

type AccentStyle = CSSProperties & { "--accent": string };

// How far the bubble billboard scales with camera distance (larger = smaller text
// far away). Tuned so text stays readable across the constrained zoom range.
const DISTANCE_FACTOR = 7;

type PersonaLabelProps = {
  bubble: PersonaBubble;
  /** World anchor for the bubble (already lifted to head/label height). */
  position: readonly [number, number, number];
  accent: string;
};

export function PersonaLabel({ bubble, position, accent }: PersonaLabelProps) {
  // Calm reveal while streaming; snaps to full text otherwise (and on reduced motion).
  const revealed = useSmoothText(bubble.text, bubble.streaming);
  const style: AccentStyle = { "--accent": accent };
  const hasText = bubble.mode !== "nameplate";
  // The verdict bubble runs a touch wider so the synthesis reads comfortably;
  // panelist bubbles stay narrow so four abreast don't collide at the wide shot.
  const width = bubble.mode === "verdict" ? "w-64" : "w-52";

  return (
    <Html
      position={position as [number, number, number]}
      center
      distanceFactor={DISTANCE_FACTOR}
      zIndexRange={[20, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        aria-hidden
        style={style}
        className={
          `${width} select-none text-center transition-opacity duration-500 ` +
          (bubble.dimmed ? "opacity-40" : "opacity-100")
        }
      >
        {/* Nameplate — always visible identity. */}
        <div className="inline-flex flex-col items-center gap-0.5 rounded-md border border-[var(--accent)]/40 bg-panel/85 px-3 py-1 backdrop-blur-sm shadow-[0_0_18px_-6px_var(--accent)]">
          <span className="font-display text-sm font-semibold leading-none text-[var(--accent)]">
            {bubble.displayName}
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] leading-none text-muted">
            {bubble.role}
          </span>
        </div>

        {/* Speech bubble — the persona's latest contribution. flex-col-reverse +
            overflow-hidden pins the single <p> to the bottom and clips the top,
            so the bubble follows the newest streamed tokens (tail) instead of
            freezing on the opening lines. The typing indicator rides the tail. */}
        {hasText && revealed.length > 0 && (
          <div className="mt-1.5 flex max-h-32 flex-col-reverse overflow-hidden rounded-lg border border-[var(--accent)]/30 bg-bg/85 px-3 py-2 backdrop-blur-sm">
            <p className="whitespace-pre-wrap break-words text-left font-mono text-xs leading-relaxed text-ink/90">
              {revealed}
              {bubble.streaming && (
                <span className="ml-1 inline-block align-middle">
                  <TypingIndicator label={`${bubble.displayName} speaking`} />
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </Html>
  );
}
