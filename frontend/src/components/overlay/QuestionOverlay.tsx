// QuestionOverlay — the question form as a transparent hero hovering over the
// stage. It is the entry point (centered on an idle stage) and folds away once a
// question is convened, so the stage becomes the focal point. Kept mounted while
// hidden (fade + shrink) so the user's typed draft survives an accidental close;
// `inert` + aria-hidden pull it out of the tab order and the a11y tree when hidden.
//
// Sound and Stop live in StageControls, so the embedded QuestionForm is handed
// neither — while hidden it is never live, and its Stop button never shows.

import type { RefObject } from "react";
import type { DebatePhase } from "../../state/debateReducer";
import { QuestionForm } from "../controls/QuestionForm";

type QuestionOverlayProps = {
  visible: boolean;
  phase: DebatePhase;
  onAsk: (question: string, rounds: number) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
};

export function QuestionOverlay({ visible, phase, onAsk, textareaRef }: QuestionOverlayProps) {
  return (
    <div
      // `inert` is a valid boolean attribute in React 19; omit it entirely when visible.
      {...(visible ? {} : { inert: true })}
      aria-hidden={!visible}
      className={
        "pointer-events-none absolute inset-0 flex items-center justify-center p-4 transition-all duration-300 motion-reduce:transition-none " +
        (visible ? "opacity-100" : "scale-95 opacity-0")
      }
    >
      <div className="pointer-events-auto w-full max-w-xl">
        <div className="rounded-2xl border border-panel-border bg-bg/70 p-1 shadow-2xl backdrop-blur-md">
          <QuestionForm
            phase={phase}
            onAsk={onAsk}
            onStop={() => {}}
            textareaRef={textareaRef}
          />
        </div>
      </div>
    </div>
  );
}
