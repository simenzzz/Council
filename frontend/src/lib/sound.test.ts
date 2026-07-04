import { afterEach, describe, expect, it, vi } from "vitest";
import { createSoundEngine } from "./sound";

class FakeGainNode {
  gain = {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
}

class FakeOscillatorNode {
  type = "sine";
  frequency = { value: 0 };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  state: "running" | "suspended" = "suspended";
  currentTime = 0;
  destination = {};
  createGain = vi.fn(() => new FakeGainNode());
  createOscillator = vi.fn(() => new FakeOscillatorNode());
  resume = vi.fn(async () => {
    this.state = "running";
  });
  suspend = vi.fn(async () => {
    this.state = "suspended";
  });
}

// A real (constructable) class that just records every instance created, so
// tests can assert "AudioContext was/wasn't constructed" without relying on
// `new` semantics on a vi.fn-wrapped arrow function (which isn't constructable).
function trackedAudioContextCtor(instances: FakeAudioContext[]) {
  return class extends FakeAudioContext {
    constructor() {
      super();
      instances.push(this);
    }
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("createSoundEngine", () => {
  it("never touches AudioContext while muted (the default)", () => {
    const instances: FakeAudioContext[] = [];
    vi.stubGlobal("AudioContext", trackedAudioContextCtor(instances));

    const engine = createSoundEngine();
    engine.resume();
    engine.playRoundCue();
    engine.playVerdictChime();

    expect(instances).toHaveLength(0);
  });

  it("schedules an oscillator without throwing once enabled", () => {
    const instances: FakeAudioContext[] = [];
    vi.stubGlobal("AudioContext", trackedAudioContextCtor(instances));

    const engine = createSoundEngine();
    engine.setEnabled(true);
    expect(() => engine.playRoundCue()).not.toThrow();
    expect(instances).toHaveLength(1);
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(1);
  });

  it("plays two tones for the verdict chime", () => {
    const instances: FakeAudioContext[] = [];
    vi.stubGlobal("AudioContext", trackedAudioContextCtor(instances));

    const engine = createSoundEngine();
    engine.setEnabled(true);
    engine.playVerdictChime();

    expect(instances).toHaveLength(1);
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(2);
  });

  it("resumes a suspended context only when enabled", () => {
    const instances: FakeAudioContext[] = [];
    vi.stubGlobal("AudioContext", trackedAudioContextCtor(instances));

    const engine = createSoundEngine();
    engine.resume();
    expect(instances).toHaveLength(0);

    engine.setEnabled(true);
    engine.resume();
    expect(instances).toHaveLength(1);
    expect(instances[0].resume).toHaveBeenCalledOnce();
  });

  it("suspends a running context when muted, symmetric with resume", () => {
    const instances: FakeAudioContext[] = [];
    vi.stubGlobal("AudioContext", trackedAudioContextCtor(instances));

    const engine = createSoundEngine();
    engine.setEnabled(true);
    engine.resume();
    expect(instances[0].state).toBe("running");

    engine.setEnabled(false);
    expect(instances[0].suspend).toHaveBeenCalledOnce();
  });

  it("does not try to suspend before any context has been created", () => {
    const instances: FakeAudioContext[] = [];
    vi.stubGlobal("AudioContext", trackedAudioContextCtor(instances));

    const engine = createSoundEngine();
    expect(() => engine.setEnabled(false)).not.toThrow();
    expect(instances).toHaveLength(0);
  });

  it("is a safe no-op when the Web Audio API is unavailable", () => {
    vi.stubGlobal("AudioContext", undefined);
    const engine = createSoundEngine();
    engine.setEnabled(true);
    expect(() => {
      engine.resume();
      engine.playRoundCue();
      engine.playVerdictChime();
    }).not.toThrow();
  });
});
