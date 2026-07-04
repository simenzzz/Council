// StageScene — everything that lives *inside* the <Canvas>: the chamber, the five
// seated robots, and each robot's floating <Html> label. It is split out from
// DebateStage so the scene graph can be mounted headlessly by
// @react-three/test-renderer (which is itself the renderer and so cannot mount a
// <Canvas> or <OrbitControls>). The moderator gets a subtle scale cue; each robot
// is handed its reactive visual state (F3) and its bubble model.
//
// Labels are opt-in via the `bubbles` prop: the headless tests pass none (drei's
// <Html> needs a DOM canvas), so the scene-graph smoke tests stay green while the
// live stage renders labels. Bubble content itself is unit-tested in bubbleContent.

import { PERSONA_IDS, type PersonaId } from "../design/tokens";
import { accentOf, MODERATOR_ID } from "../personas/registry";
import type { PersonaBubble } from "./bubbleContent";
import { Chamber } from "./Chamber";
import { PersonaLabel } from "./PersonaLabel";
import { RobotPersona } from "./RobotPersona";
import type { RobotVisualState } from "./robotVisualState";
import { HEAD_LABEL_HEIGHT, SEATING } from "./seating";

const MODERATOR_SCALE = 1.12;
// The moderator sits a touch larger, so lift its label to clear the taller head.
const MODERATOR_LABEL_LIFT = 0.25;

type StageSceneProps = {
  /** Per-persona reactive state; defaults to none (all robots rest idle). */
  visuals?: readonly RobotVisualState[];
  /** Per-persona bubble models; defaults to none (no <Html> labels — headless tests). */
  bubbles?: readonly PersonaBubble[];
  /** Freezes every robot's bob/sway/pulse when the user prefers reduced motion. */
  reducedMotion?: boolean;
};

function labelPosition(id: PersonaId): [number, number, number] {
  const [x, , z] = SEATING[id].position;
  const y = HEAD_LABEL_HEIGHT + (id === MODERATOR_ID ? MODERATOR_LABEL_LIFT : 0);
  return [x, y, z];
}

export function StageScene({ visuals = [], bubbles = [], reducedMotion = false }: StageSceneProps) {
  const byId = new Map<PersonaId, RobotVisualState>(visuals.map((v) => [v.id, v]));
  const bubbleById = new Map<PersonaId, PersonaBubble>(bubbles.map((b) => [b.id, b]));
  return (
    <>
      <Chamber />
      {PERSONA_IDS.map((id) => {
        const seat = SEATING[id];
        const bubble = bubbleById.get(id);
        return (
          <group key={id}>
            <RobotPersona
              id={id}
              accent={accentOf(id)}
              position={seat.position}
              rotationY={seat.rotationY}
              scale={id === MODERATOR_ID ? MODERATOR_SCALE : 1}
              visual={byId.get(id)}
              reducedMotion={reducedMotion}
            />
            {bubble && (
              <PersonaLabel bubble={bubble} position={labelPosition(id)} accent={accentOf(id)} />
            )}
          </group>
        );
      })}
    </>
  );
}
