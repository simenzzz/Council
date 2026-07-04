import { describe, expect, it } from "vitest";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { Color, type Group, type Mesh, type MeshStandardMaterial, type PointLight } from "three";
import { accentOf } from "../personas/registry";
import { RobotPersona } from "./RobotPersona";
import type { RobotVisualState } from "./robotVisualState";

const talking: RobotVisualState = {
  id: "skeptic",
  status: "talking",
  speaking: true,
  dimmed: false,
  round: 1,
};

describe("RobotPersona", () => {
  it("tags its root group with the persona id", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RobotPersona id="skeptic" accent={accentOf("skeptic")} position={[0, 0, 0]} rotationY={0} />,
    );

    const group = renderer.scene.findByProps({ name: "skeptic" });
    expect(group.instance.userData.personaId).toBe("skeptic");
  });

  it("applies the persona accent to an emissive material", async () => {
    const accent = accentOf("optimist");
    const renderer = await ReactThreeTestRenderer.create(
      <RobotPersona id="optimist" accent={accent} position={[0, 0, 0]} rotationY={0} />,
    );

    const wanted = new Color(accent).getHexString();
    const meshes = renderer.scene.findAllByType("Mesh");
    const lit = meshes.some((mesh) => {
      const material = (mesh.instance as Mesh).material as MeshStandardMaterial | undefined;
      return material?.emissive?.getHexString() === wanted;
    });

    expect(lit).toBe(true);
  });

  it("honors the scale cue", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RobotPersona
        id="moderator"
        accent={accentOf("moderator")}
        position={[0, 0, 0]}
        rotationY={0}
        scale={1.12}
      />,
    );

    const group = renderer.scene.findByProps({ name: "moderator" });
    expect(group.instance.scale.x).toBeCloseTo(1.12);
  });

  it("renders the moderator's presiding gavel prop and no one else's", async () => {
    const moderatorRenderer = await ReactThreeTestRenderer.create(
      <RobotPersona id="moderator" accent={accentOf("moderator")} position={[0, 0, 0]} rotationY={0} />,
    );
    expect(moderatorRenderer.scene.findAllByProps({ name: "gavel" })).toHaveLength(1);

    const skepticRenderer = await ReactThreeTestRenderer.create(
      <RobotPersona id="skeptic" accent={accentOf("skeptic")} position={[0, 0, 0]} rotationY={0} />,
    );
    expect(skepticRenderer.scene.findAllByProps({ name: "gavel" })).toHaveLength(0);
  });

  it("renders the expert's mortarboard cap and no one else's", async () => {
    const expertRenderer = await ReactThreeTestRenderer.create(
      <RobotPersona id="expert" accent={accentOf("expert")} position={[0, 0, 0]} rotationY={0} />,
    );
    expect(expertRenderer.scene.findAllByProps({ name: "mortarboard" })).toHaveLength(1);

    const moderatorRenderer = await ReactThreeTestRenderer.create(
      <RobotPersona id="moderator" accent={accentOf("moderator")} position={[0, 0, 0]} rotationY={0} />,
    );
    expect(moderatorRenderer.scene.findAllByProps({ name: "mortarboard" })).toHaveLength(0);
  });

  it("renders the expert's extra visor brow, absent on other heads", async () => {
    const expertRenderer = await ReactThreeTestRenderer.create(
      <RobotPersona id="expert" accent={accentOf("expert")} position={[0, 0, 0]} rotationY={0} />,
    );
    const expertMeshes = expertRenderer.scene
      .findByProps({ name: "head" })
      .children.filter((c) => c.type === "Mesh");

    const skepticRenderer = await ReactThreeTestRenderer.create(
      <RobotPersona id="skeptic" accent={accentOf("skeptic")} position={[0, 0, 0]} rotationY={0} />,
    );
    const skepticMeshes = skepticRenderer.scene
      .findByProps({ name: "head" })
      .children.filter((c) => c.type === "Mesh");

    expect(expertMeshes.length).toBe(skepticMeshes.length + 1);
  });

  it("gives the contrarian a permanently tilted head with an offset antenna", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RobotPersona id="contrarian" accent={accentOf("contrarian")} position={[0, 0, 0]} rotationY={0} />,
    );
    const head = renderer.scene.findByProps({ name: "head" });
    expect((head.instance as Group).rotation.y).not.toBe(0);
  });

  it("rolls the contrarian's head box 45° into a diamond, leaving upright heads unrolled", async () => {
    // The roll lives on the box mesh (the head group's rotation.z is owned by
    // the sway animation), so read the first Mesh child of the head.
    const boxRollOf = async (id: Parameters<typeof accentOf>[0]) => {
      const renderer = await ReactThreeTestRenderer.create(
        <RobotPersona id={id} accent={accentOf(id)} position={[0, 0, 0]} rotationY={0} />,
      );
      const box = renderer.scene
        .findByProps({ name: "head" })
        .children.find((c) => c.type === "Mesh");
      return (box!.instance as Mesh).rotation.z;
    };

    expect(await boxRollOf("contrarian")).toBeCloseTo(Math.PI / 4);
    // The moderator's centered box head stays upright.
    expect(await boxRollOf("moderator")).toBe(0);
  });

  it("flashes the moderator's glow the instant the verdict lands", async () => {
    const talking: RobotVisualState = {
      id: "moderator",
      status: "talking",
      speaking: true,
      dimmed: false,
      round: 3,
    };
    const done: RobotVisualState = {
      id: "moderator",
      status: "done",
      speaking: false,
      dimmed: false,
      round: 3,
    };

    const renderer = await ReactThreeTestRenderer.create(
      <RobotPersona
        id="moderator"
        accent={accentOf("moderator")}
        position={[0, 0, 0]}
        rotationY={0}
        visual={talking}
      />,
    );
    await renderer.advanceFrames(5, 1 / 60);

    await renderer.update(
      <RobotPersona
        id="moderator"
        accent={accentOf("moderator")}
        position={[0, 0, 0]}
        rotationY={0}
        visual={done}
      />,
    );

    // The flash target and the spotlight's own easing each have their own time
    // constant, so sample the peak across the transient rather than one frame.
    let peak = 0;
    for (let i = 0; i < 90; i++) {
      await renderer.advanceFrames(1, 1 / 60);
      const light = (renderer.scene.findByType("PointLight").instance as PointLight).intensity;
      peak = Math.max(peak, light);
    }

    // Let the flash fully decay; the settled "done" glow should be dimmer.
    await renderer.advanceFrames(180, 1 / 60);
    const settled = (renderer.scene.findByType("PointLight").instance as PointLight).intensity;

    expect(peak).toBeGreaterThan(settled);
  });

  it("does not flash a panelist arriving at done", async () => {
    const thinking: RobotVisualState = {
      id: "skeptic",
      status: "thinking",
      speaking: false,
      dimmed: false,
      round: 1,
    };
    const done: RobotVisualState = { id: "skeptic", status: "done", speaking: false, dimmed: false, round: 1 };

    const renderer = await ReactThreeTestRenderer.create(
      <RobotPersona
        id="skeptic"
        accent={accentOf("skeptic")}
        position={[0, 0, 0]}
        rotationY={0}
        visual={thinking}
      />,
    );
    await renderer.advanceFrames(5, 1 / 60);
    await renderer.update(
      <RobotPersona
        id="skeptic"
        accent={accentOf("skeptic")}
        position={[0, 0, 0]}
        rotationY={0}
        visual={done}
      />,
    );

    let peak = 0;
    for (let i = 0; i < 90; i++) {
      await renderer.advanceFrames(1, 1 / 60);
      const light = (renderer.scene.findByType("PointLight").instance as PointLight).intensity;
      peak = Math.max(peak, light);
    }

    await renderer.advanceFrames(180, 1 / 60);
    const settled = (renderer.scene.findByType("PointLight").instance as PointLight).intensity;

    // No flash: intensity only rises toward the steady "done" target, never past it.
    expect(peak).toBeLessThanOrEqual(settled + 0.01);
  });

  it("animates a talking robot across frames without throwing", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RobotPersona
        id="skeptic"
        accent={accentOf("skeptic")}
        position={[0, 0, 0]}
        rotationY={0}
        visual={talking}
      />,
    );

    await renderer.advanceFrames(4, 1 / 60);

    // The robot is still there and its accent spotlight has ramped up from 0.
    const group = renderer.scene.findByProps({ name: "skeptic" });
    expect(group.instance.userData.personaId).toBe("skeptic");
    const light = renderer.scene.findByType("PointLight");
    expect((light.instance as PointLight).intensity).toBeGreaterThan(0);
  });
});
