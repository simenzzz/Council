// sound — a tiny WebAudio synth for the council's two ambient cues: a soft
// tick when a round completes, and a two-note chime when the verdict lands.
// No audio assets: both cues are synthesized oscillators, so there's no asset
// pipeline and nothing to fetch. Muted by default (see hooks/useSound) — every
// call is a safe no-op until `setEnabled(true)`, and the AudioContext itself
// is created lazily on first enabled use, never eagerly, so a muted session
// never touches the Web Audio API (and never trips a browser's autoplay
// warning before a user gesture asks for sound).

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

// A short, gently-enveloped sine tone: fade in, exponential fade out, so it
// reads as a soft chime rather than a click.
function playTone(ctx: AudioContext, freq: number, startOffset: number, duration: number, peakGain: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;

  const start = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export type SoundEngine = {
  /** Mutes/unmutes every cue; also gates whether the AudioContext is created. */
  setEnabled: (enabled: boolean) => void;
  /** Resumes a suspended context — call from within the user gesture that enables sound. */
  resume: () => void;
  /** A soft tick — a debate round completed. */
  playRoundCue: () => void;
  /** A short two-note chime — the moderator's verdict landed. */
  playVerdictChime: () => void;
};

export function createSoundEngine(): SoundEngine {
  const Ctor = getAudioContextCtor();
  let enabled = false;
  let ctx: AudioContext | null = null;

  const ensureContext = (): AudioContext | null => {
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  };

  const whenEnabled = (fn: (c: AudioContext) => void): void => {
    if (!enabled) return;
    const c = ensureContext();
    if (c) fn(c);
  };

  return {
    setEnabled: (next) => {
      enabled = next;
      // Symmetric with resume(): muting suspends an already-running context
      // rather than leaving the audio hardware/thread alive indefinitely.
      if (!next && ctx && ctx.state === "running") void ctx.suspend();
    },
    resume: () =>
      whenEnabled((c) => {
        if (c.state === "suspended") void c.resume();
      }),
    playRoundCue: () => whenEnabled((c) => playTone(c, 660, 0, 0.12, 0.05)),
    playVerdictChime: () =>
      whenEnabled((c) => {
        playTone(c, 523.25, 0, 0.35, 0.06); // C5
        playTone(c, 783.99, 0.08, 0.45, 0.06); // G5
      }),
  };
}
