export type SoundKind = "shot" | "impact" | "boom" | "fanfare";

export interface SoundEvent {
  tick: number;
  kind: SoundKind;
  gain?: number;
}

export const SOUND_KINDS: readonly SoundKind[] = [
  "shot",
  "impact",
  "boom",
  "fanfare",
];

export function pushSound(
  events: SoundEvent[],
  tick: number,
  kind: SoundKind,
  gain?: number,
): void {
  const last = events[events.length - 1];
  if (last && last.tick === tick && last.kind === kind && last.gain === gain) {
    return;
  }
  events.push({ tick, kind, gain });
}
