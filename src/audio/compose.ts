import { BGM_PATH, SFX_PATHS } from "./assets.js";
import { SOUND_KINDS, type SoundEvent, type SoundKind } from "./events.js";

export interface MuxPlan {
  inputs: string[];
  filterComplex: string;
  audioLabel: string;
}

const AUDIO_INPUT_OFFSET = 1;

const KIND_GAIN: Record<SoundKind, number> = {
  shot: 0.95,
  impact: 0.85,
  boom: 1.0,
  fanfare: 1.0,
};

const BGM_GAIN = 0.22;

export function planAudioMux(
  events: SoundEvent[],
  fps: number,
  durationSeconds: number,
): MuxPlan {
  const byKind = new Map<SoundKind, SoundEvent[]>();
  for (const kind of SOUND_KINDS) byKind.set(kind, []);
  for (const ev of events) {
    if (ev.tick / fps > durationSeconds) continue;
    byKind.get(ev.kind)?.push(ev);
  }

  const inputs: string[] = [BGM_PATH];
  const kindInputIndex = new Map<SoundKind, number>();
  for (const kind of SOUND_KINDS) {
    if ((byKind.get(kind)?.length ?? 0) > 0) {
      kindInputIndex.set(kind, inputs.length);
      inputs.push(SFX_PATHS[kind]);
    }
  }

  const bgmInputIdx = AUDIO_INPUT_OFFSET;
  const segments: string[] = [];
  const mixLabels: string[] = [];

  segments.push(
    `[${bgmInputIdx}:a]atrim=0:${durationSeconds.toFixed(3)},asetpts=N/SR/TB,volume=${BGM_GAIN}[bgm]`,
  );
  mixLabels.push("[bgm]");

  for (const kind of SOUND_KINDS) {
    const list = byKind.get(kind) ?? [];
    if (list.length === 0) continue;
    const inputIdx = kindInputIndex.get(kind)! + AUDIO_INPUT_OFFSET;
    const gain = KIND_GAIN[kind];
    const splitLabel = `k${kind}`;
    const splitTargets = list.map((_, i) => `[${splitLabel}${i}]`).join("");
    segments.push(`[${inputIdx}:a]asplit=${list.length}${splitTargets}`);
    const delayLabels: string[] = [];
    list.forEach((ev, i) => {
      const delayMs = Math.max(0, Math.round((ev.tick / fps) * 1000));
      const evGain = (ev.gain ?? 1) * gain;
      const outLabel = `${splitLabel}d${i}`;
      segments.push(
        `[${splitLabel}${i}]adelay=${delayMs}:all=1,volume=${evGain.toFixed(3)}[${outLabel}]`,
      );
      delayLabels.push(`[${outLabel}]`);
    });
    const kindOutLabel = `${splitLabel}mix`;
    segments.push(
      `${delayLabels.join("")}amix=inputs=${list.length}:normalize=0:dropout_transition=0[${kindOutLabel}]`,
    );
    mixLabels.push(`[${kindOutLabel}]`);
  }

  const finalLabel = "aout";
  segments.push(
    `${mixLabels.join("")}amix=inputs=${mixLabels.length}:normalize=0:dropout_transition=0,alimiter=limit=0.95,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[${finalLabel}]`,
  );

  return {
    inputs,
    filterComplex: segments.join(";"),
    audioLabel: `[${finalLabel}]`,
  };
}
