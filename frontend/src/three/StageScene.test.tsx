import { describe, expect, it } from "vitest";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { PERSONA_IDS } from "../design/tokens";
import { buildState } from "../test/helpers";
import { fullDebate } from "../test/fixtures/events";
import { robotVisualState } from "./robotVisualState";
import { StageScene } from "./StageScene";

function robotIds(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  return renderer.scene
    .findAll((node) => node.instance.userData?.personaId !== undefined)
    .map((node) => node.instance.userData.personaId as string)
    .sort();
}

describe("StageScene", () => {
  it("mounts exactly one robot per persona, tagged with the registry ids", async () => {
    const renderer = await ReactThreeTestRenderer.create(<StageScene />);

    const ids = robotIds(renderer);
    expect(ids).toHaveLength(PERSONA_IDS.length);
    expect(ids).toEqual([...PERSONA_IDS].sort());
  });

  it("mounts the full cast and animates without throwing under an active debate", async () => {
    // Mid round 1: all four panelists are talking. Drive a few frames so the
    // useFrame loop actually runs against a live visual state.
    const visuals = robotVisualState(buildState(fullDebate.slice(0, 8)));
    const renderer = await ReactThreeTestRenderer.create(<StageScene visuals={visuals} />);

    await renderer.advanceFrames(3, 1 / 60);

    expect(robotIds(renderer)).toEqual([...PERSONA_IDS].sort());
  });
});
