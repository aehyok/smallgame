import type { SoundEvent, SoundKind } from "../src/audio/events.js";

const SFX_URLS: Record<SoundKind, string> = {
  shot: "/sfx/shot.wav",
  impact: "/sfx/impact.wav",
  boom: "/sfx/boom.wav",
  fanfare: "/sfx/fanfare.wav",
};

const BGM_URL = "/bgm/bgm.wav";

const KIND_GAIN: Record<SoundKind, number> = {
  shot: 0.55,
  impact: 0.7,
  boom: 0.9,
  fanfare: 1.0,
};

const BGM_GAIN = 0.35;

export interface AudioPlayer {
  readonly loaded: Promise<void>;
  play(event: SoundEvent): void;
  startBgm(): void;
  stopBgm(): void;
  setMuted(muted: boolean): void;
  resume(): Promise<void>;
}

export function createAudioPlayer(): AudioPlayer {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new Ctor();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(ctx.destination);

  const sfxBuffers: Partial<Record<SoundKind, AudioBuffer>> = {};
  let bgmBuffer: AudioBuffer | null = null;
  let bgmSource: AudioBufferSourceNode | null = null;
  let bgmGainNode: GainNode | null = null;

  const loadBuffer = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  };

  const loaded = (async () => {
    const [shot, impact, boom, fanfare, bgm] = await Promise.all([
      loadBuffer(SFX_URLS.shot),
      loadBuffer(SFX_URLS.impact),
      loadBuffer(SFX_URLS.boom),
      loadBuffer(SFX_URLS.fanfare),
      loadBuffer(BGM_URL),
    ]);
    sfxBuffers.shot = shot;
    sfxBuffers.impact = impact;
    sfxBuffers.boom = boom;
    sfxBuffers.fanfare = fanfare;
    bgmBuffer = bgm;
  })().catch((err) => {
    console.warn("[audio] failed to load assets:", err);
  });

  const stopBgm = () => {
    if (bgmSource) {
      try {
        bgmSource.stop();
      } catch {}
      bgmSource.disconnect();
      bgmSource = null;
    }
    if (bgmGainNode) {
      bgmGainNode.disconnect();
      bgmGainNode = null;
    }
  };

  return {
    loaded,
    play(event) {
      const buf = sfxBuffers[event.kind];
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = (event.gain ?? 1) * KIND_GAIN[event.kind];
      src.connect(gain).connect(masterGain);
      src.start();
    },
    startBgm() {
      if (!bgmBuffer) return;
      stopBgm();
      const src = ctx.createBufferSource();
      src.buffer = bgmBuffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = BGM_GAIN;
      src.connect(gain).connect(masterGain);
      src.start();
      bgmSource = src;
      bgmGainNode = gain;
    },
    stopBgm,
    setMuted(muted) {
      masterGain.gain.value = muted ? 0 : 1;
    },
    async resume() {
      if (ctx.state === "suspended") await ctx.resume();
    },
  };
}
