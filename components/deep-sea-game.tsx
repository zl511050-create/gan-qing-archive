"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type PhaserType from "phaser";
import styles from "./deep-sea-game.module.css";

type GamePhase = "ready" | "descending" | "ascending" | "results" | "paused";
type DepthZone = "moonlit" | "twilight" | "trench" | "abyss";

interface FishDefinition {
  id: string;
  name: string;
  note: string;
  frame: number;
  baseScore: number;
  scale: number;
  sourceWidth?: number;
  spriteRatio?: number;
  capturePitch?: number;
  swift?: boolean;
}

interface HudState {
  phase: GamePhase;
  depth: number;
  score: number;
  catches: number;
  combo: number;
  shield: boolean;
  magnet: boolean;
}

interface RunSummary {
  score: number;
  maxDepth: number;
  catches: number;
  maxCombo: number;
  discovered: string[];
  newDiscoveries?: string[];
  reachedBottom: boolean;
}

interface SavedProgress {
  version: 1;
  bestScore: number;
  deepest: number;
  discovered: string[];
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

interface GameRuntime {
  start: () => void;
  pause: (paused: boolean) => void;
  destroy: () => void;
}

const STORAGE_KEY = "weiji-deep-sea-progress-v1";
const WORLD_WIDTH = 390;
const WORLD_HEIGHT = 844;
const MAX_DEPTH = 800;

const fishDefinitions: FishDefinition[] = [
  { id: "bubble", name: "泡泡鱼", note: "总爱结伴经过月光", frame: 0, baseScore: 10, scale: .92, capturePitch: 480 },
  { id: "crescent", name: "月牙鱼", note: "转身时像一弯小月亮", frame: 1, baseScore: 18, scale: .88, capturePitch: 520 },
  { id: "lantern", name: "灯笼鱼", note: "替暮色留一盏灯", frame: 2, baseScore: 28, scale: .9, capturePitch: 560 },
  { id: "ribbon", name: "丝带鳐", note: "把洋流写成柔软的线", frame: 3, baseScore: 36, scale: .98, capturePitch: 430 },
  { id: "glass", name: "玻璃鱼", note: "几乎透明，却仍被看见", frame: 4, baseScore: 48, scale: .9, capturePitch: 610 },
  { id: "starlit", name: "星点鱼", note: "身上藏着微小星群", frame: 5, baseScore: 62, scale: .92, capturePitch: 660 },
  { id: "rose", name: "玫瑰水母鱼", note: "在深处慢慢盛开", frame: 6, baseScore: 78, scale: .94, capturePitch: 700 },
  { id: "dream", name: "未寄之鱼", note: "只在最安静的海沟出现", frame: 7, baseScore: 110, scale: 1, capturePitch: 760 },
  { id: "swift", name: "萤光小银梭", note: "像一道追得上的微光", frame: -1, baseScore: 138, scale: 1, sourceWidth: 512, spriteRatio: .59, capturePitch: 840, swift: true },
];

const defaultProgress: SavedProgress = {
  version: 1,
  bestScore: 0,
  deepest: 0,
  discovered: [],
  soundEnabled: true,
  hapticsEnabled: true,
};

function loadProgress(): SavedProgress {
  if (typeof window === "undefined") return defaultProgress;
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<SavedProgress> | null;
    if (!value || value.version !== 1) return defaultProgress;
    return {
      version: 1,
      bestScore: Number.isFinite(value.bestScore) ? Math.max(0, Number(value.bestScore)) : 0,
      deepest: Number.isFinite(value.deepest) ? Math.min(MAX_DEPTH, Math.max(0, Number(value.deepest))) : 0,
      discovered: Array.isArray(value.discovered) ? value.discovered.filter((id) => fishDefinitions.some((fish) => fish.id === id)) : [],
      soundEnabled: value.soundEnabled !== false,
      hapticsEnabled: value.hapticsEnabled !== false,
    };
  } catch {
    return defaultProgress;
  }
}

class OceanAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientOscillators: OscillatorNode[] = [];
  private ascentActive = false;
  private lastReelTickAt = 0;
  private abyssActive = false;
  private paused = false;
  enabled = true;

  async start() {
    if (!this.enabled) return;
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
    if (this.masterGain) return;
    const master = this.context.createGain();
    const compressor = this.context.createDynamicsCompressor();
    const ambient = this.context.createGain();
    const sfx = this.context.createGain();
    master.gain.value = this.enabled ? .8 : 0;
    ambient.gain.value = .026;
    sfx.gain.value = .7;
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 5;
    ambient.connect(master);
    sfx.connect(master);
    master.connect(compressor).connect(this.context.destination);
    this.masterGain = master;
    this.ambientGain = ambient;
    this.sfxGain = sfx;

    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 240;
    filter.Q.value = .7;
    filter.connect(ambient);
    [54, 81].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      const gain = this.context!.createGain();
      gain.gain.value = index === 0 ? .45 : .14;
      oscillator.connect(gain).connect(filter);
      oscillator.start();
      this.ambientOscillators.push(oscillator);
    });
  }

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType = "sine", delay = 0) {
    if (!this.enabled || !this.context || !this.sfxGain) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 1.16), now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(this.sfxGain);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private noise(duration: number, volume: number, cutoff: number) {
    if (!this.enabled || !this.context || !this.sfxGain) return;
    const frames = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, frames, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / frames);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start();
  }

  catchFish(pitch: number, size: number, isNew: boolean, combo: number) {
    this.noise(.075, .045 + size / 5000, 1100);
    this.tone(pitch + Math.min(combo, 10) * 11, .13, .07, "sine");
    this.tone(pitch * 1.5, .09, .025, "triangle", .025);
    if (isNew) {
      this.tone(pitch * 1.25, .2, .055, "sine", .1);
      this.tone(pitch * 1.5, .25, .045, "sine", .2);
    }
  }

  comboMilestone(combo: number) {
    const base = combo === 3 ? 560 : combo === 6 ? 660 : 760;
    [1, 1.25, 1.5].forEach((ratio, index) => this.tone(base * ratio, .16, .04, "triangle", index * .055));
  }

  obstacle() {
    this.noise(.12, .08, 320);
    this.tone(145, .22, .07, "triangle");
    this.tone(92, .28, .04, "sine", .045);
  }

  power(frequency: number) {
    this.tone(frequency, .2, .05, "sine");
    this.tone(frequency * 1.33, .2, .035, "triangle", .07);
  }

  beginAscent() {
    this.noise(.28, .055, 680);
    this.tone(220, .3, .06, "triangle");
    this.ascentActive = true;
    this.lastReelTickAt = 0;
  }

  endAscent() {
    this.ascentActive = false;
    this.lastReelTickAt = 0;
  }

  setReelSpeed(speed: number) {
    if (!this.enabled || !this.context || !this.sfxGain || !this.ascentActive || this.paused) return;
    const now = this.context.currentTime;
    const interval = .31 - Math.min(speed, 100) * .00045;
    if (now - this.lastReelTickAt < interval) return;
    this.lastReelTickAt = now;
    const pitch = 310 + Math.min(speed, 100) * .65;
    this.tone(pitch, .055, .012, "triangle");
    this.tone(pitch * 1.42, .035, .006, "sine", .018);
  }

  setAbyss(active: boolean) {
    this.abyssActive = active;
    if (!this.context || !this.ambientGain) return;
    this.ambientGain.gain.setTargetAtTime(this.paused ? 0 : active ? .04 : .026, this.context.currentTime, .3);
    this.ambientOscillators.forEach((oscillator, index) => oscillator.frequency.setTargetAtTime(active ? (index === 0 ? 42 : 63) : (index === 0 ? 54 : 81), this.context!.currentTime, .35));
    if (active) {
      this.tone(72, .55, .07, "sine");
      this.noise(.42, .028, 170);
    }
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (this.context && this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(paused ? 0 : this.abyssActive ? .04 : .026, this.context.currentTime, .12);
    }
    if (paused) this.endAscent();
  }

  setMuted(muted: boolean) {
    this.enabled = !muted;
    if (this.masterGain && this.context) this.masterGain.gain.setTargetAtTime(muted ? 0 : .8, this.context.currentTime, .08);
  }

  stop() {
    this.endAscent();
    this.ambientOscillators.forEach((oscillator) => { oscillator.stop(); oscillator.disconnect(); });
    this.ambientOscillators = [];
    this.masterGain = null;
    this.ambientGain = null;
    this.sfxGain = null;
    void this.context?.close();
    this.context = null;
  }
}

function phaseLabel(phase: GamePhase) {
  if (phase === "descending") return "正在下潜";
  if (phase === "ascending") return "带着微光返航";
  if (phase === "paused") return "海面暂静";
  return "等待出发";
}

function resultMessage(summary: RunSummary) {
  if (summary.reachedBottom) return "你去过很深的地方，也带着微光平安回来了。";
  if (summary.maxDepth >= 120) return "深海听见了你，海面也一直在等你。";
  if (summary.catches >= 8) return "沿途的每一次相遇，都让返航更明亮。";
  return "不必抵达最深处，这次相遇已经足够温柔。";
}

export function DeepSeaGame() {
  const stageRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const audioRef = useRef(new OceanAudio());
  const hapticsRef = useRef(true);
  const knownAtRunStartRef = useRef<Set<string>>(new Set());
  const [progress, setProgress] = useState<SavedProgress>(defaultProgress);
  const [hud, setHud] = useState<HudState>({ phase: "ready", depth: 0, score: 0, catches: 0, combo: 0, shield: false, magnet: false });
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);

  useEffect(() => {
    const saved = loadProgress();
    setProgress(saved);
    audioRef.current.enabled = saved.soundEnabled;
    hapticsRef.current = saved.hapticsEnabled;
  }, []);

  const discoverFish = useCallback((fishId: string) => {
    setProgress((current) => {
      if (current.discovered.includes(fishId)) return current;
      const next = { ...current, discovered: [...current.discovered, fishId] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const finishRun = useCallback((result: RunSummary) => {
    setHud((current) => ({ ...current, phase: "results", depth: 0 }));
    setProgress((current) => {
      setSummary({
        ...result,
        newDiscoveries: result.discovered.filter((id) => !knownAtRunStartRef.current.has(id)),
      });
      const next: SavedProgress = {
        ...current,
        bestScore: Math.max(current.bestScore, result.score),
        deepest: Math.max(current.deepest, result.maxDepth),
        discovered: Array.from(new Set([...current.discovered, ...result.discovered])),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    let runtime: GameRuntime | null = null;
    const gameAudio = audioRef.current;

    const mount = async () => {
      if (!stageRef.current) return;
      const PhaserModule = await import("phaser");
      if (disposed || !stageRef.current) return;
      const Phaser = PhaserModule.default;

      type FishEntity = {
        kind: "fish";
        oceanDepth: number;
        definition: FishDefinition;
        sprite: PhaserType.GameObjects.Image;
        direction: -1 | 1;
        speed: number;
        wave: number;
        phase: number;
        visualSize: number;
        caught: boolean;
        turnTime: number;
        nextTurnAt: number;
      };
      type ObstacleEntity = {
        kind: "obstacle";
        oceanDepth: number;
        object: PhaserType.GameObjects.Container;
        radius: number;
        hitCooldown: number;
      };
      type PowerEntity = {
        kind: "power";
        power: "shield" | "magnet";
        oceanDepth: number;
        object: PhaserType.GameObjects.Container;
        collected: boolean;
      };

      class DeepSeaScene extends Phaser.Scene {
        private phase: GamePhase = "ready";
        private previousPhase: GamePhase = "ready";
        private depthValue = 0;
        private maxDepthValue = 0;
        private scoreValue = 0;
        private catchesValue = 0;
        private comboValue = 0;
        private maxComboValue = 0;
        private comboExpiresAt = 0;
        private reachedBottom = false;
        private shield = false;
        private magnetUntil = 0;
        private targetX = WORLD_WIDTH / 2;
        private hookX = WORLD_WIDTH / 2;
        private background!: PhaserType.GameObjects.Graphics;
        private particles!: PhaserType.GameObjects.Container;
        private line!: PhaserType.GameObjects.Graphics;
        private hook!: PhaserType.GameObjects.Container;
        private darkness!: PhaserType.GameObjects.Image;
        private abyssWasActive = false;
        private fish: FishEntity[] = [];
        private obstacles: ObstacleEntity[] = [];
        private powers: PowerEntity[] = [];
        private trophyFish: PhaserType.GameObjects.Image[] = [];
        private trophySpecies = new Set<string>();
        private discovered = new Set<string>();
        private lastHudAt = 0;
        private externalPause = false;
        private hitStopUntil = 0;

        constructor() {
          super("deep-sea");
        }

        preload() {
          this.load.image("fish-atlas", "/game/fish-atlas-v2.png");
          this.load.image("swift-fish", "/game/swift-fish.png");
          this.load.image("prop-atlas", "/game/prop-atlas.png");
          this.load.image("cute-hook", "/game/hook.png");
        }

        create() {
          const texture = this.textures.get("fish-atlas");
          const xs = [0, 444, 887, 1331];
          const widths = [444, 443, 444, 443];
          for (let row = 0; row < 2; row += 1) {
            for (let column = 0; column < 4; column += 1) {
              const frame = row * 4 + column;
              texture.add(`fish-${frame}`, 0, xs[column], row === 0 ? 0 : 444, widths[column], row === 0 ? 444 : 443);
            }
          }

          const propTexture = this.textures.get("prop-atlas");
          for (let row = 0; row < 2; row += 1) {
            for (let column = 0; column < 4; column += 1) {
              const frame = row * 4 + column;
              propTexture.add(`prop-${frame}`, 0, column * 384, row * 512, 384, 512);
            }
          }

          this.background = this.add.graphics().setDepth(-20);
          this.particles = this.add.container(0, 0).setDepth(-10);
          for (let index = 0; index < 34; index += 1) {
            const bubble = this.add.circle(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT, 1 + Math.random() * 2, 0xcdfcff, .12 + Math.random() * .22);
            bubble.setData("speed", 6 + Math.random() * 15);
            this.particles.add(bubble);
          }

          this.line = this.add.graphics().setDepth(20);
          const hookGlow = this.add.circle(0, 18, 46, 0x91f6ef, .07);
          const hookBody = this.add.image(0, 18, "cute-hook").setDisplaySize(68, 102);
          this.hook = this.add.container(this.hookX, 348, [hookGlow, hookBody]).setDepth(22);
          this.createDarknessTexture();
          this.drawBackground();
          this.emitHud(true);
        }

        private zoneForDepth(depth: number): DepthZone {
          if (depth < 140) return "moonlit";
          if (depth < 310) return "twilight";
          if (depth < 500) return "trench";
          return "abyss";
        }

        private descentSpeed() {
          const zone = this.zoneForDepth(this.depthValue);
          return zone === "moonlit" ? 20 : zone === "twilight" ? 25 : 30;
        }

        private speedRange(depth: number): [number, number] {
          const zone = this.zoneForDepth(depth);
          if (zone === "moonlit") return [WORLD_WIDTH * .12, WORLD_WIDTH * .18];
          if (zone === "twilight") return [WORLD_WIDTH * .18, WORLD_WIDTH * .28];
          if (zone === "trench") return [WORLD_WIDTH * .28, WORLD_WIDTH * .42];
          const progress = Phaser.Math.Clamp((depth - 500) / 300, 0, 1);
          return [WORLD_WIDTH * (.38 + progress * .04), WORLD_WIDTH * (.48 + progress * .04)];
        }

        private fishTexture(definition: FishDefinition) {
          return definition.swift ? "swift-fish" : "fish-atlas";
        }

        private fishFrame(definition: FishDefinition) {
          return definition.swift ? undefined : `fish-${definition.frame}`;
        }

        private createDarknessTexture() {
          const textureWidth = 1170;
          const textureHeight = 1700;
          const texture = this.textures.createCanvas("abyss-darkness", textureWidth, textureHeight);
          if (!texture) return;
          const context = texture.context;
          const centerX = textureWidth / 2;
          const centerY = textureHeight / 2;
          const gradient = context.createRadialGradient(centerX, centerY, 76, centerX, centerY, 138);
          gradient.addColorStop(0, "rgba(1, 5, 13, 0)");
          gradient.addColorStop(.62, "rgba(1, 5, 13, 0.08)");
          gradient.addColorStop(.84, "rgba(1, 5, 13, 0.82)");
          gradient.addColorStop(1, "rgba(1, 5, 13, 1)");
          context.fillStyle = gradient;
          context.fillRect(0, 0, textureWidth, textureHeight);
          texture.refresh();
          this.darkness = this.add.image(this.hookX, 348, "abyss-darkness").setDepth(18).setVisible(false);
        }

        private seededRandom(seed: number) {
          let value = seed >>> 0;
          return () => {
            value += 0x6D2B79F5;
            let result = value;
            result = Math.imul(result ^ result >>> 15, result | 1);
            result ^= result + Math.imul(result ^ result >>> 7, result | 61);
            return ((result ^ result >>> 14) >>> 0) / 4294967296;
          };
        }

        private buildWorld() {
          this.fish.forEach((entity) => entity.sprite.destroy());
          this.obstacles.forEach((entity) => entity.object.destroy());
          this.powers.forEach((entity) => entity.object.destroy());
          this.trophyFish.forEach((sprite) => sprite.destroy());
          this.fish = [];
          this.obstacles = [];
          this.powers = [];
          this.trophyFish = [];
          this.trophySpecies.clear();

          const querySeed = Number(new URLSearchParams(window.location.search).get("seed"));
          const random = this.seededRandom(Number.isFinite(querySeed) && querySeed > 0 ? querySeed : Date.now());
          let fishDepth = 2 + random() * 2;
          while (fishDepth < MAX_DEPTH) {
            const zone = this.zoneForDepth(fishDepth);
            const choices = zone === "moonlit"
              ? [0, 0, 1, 2]
              : zone === "twilight"
                ? [1, 2, 3, 4, 5]
                : zone === "trench"
                  ? [3, 4, 5, 6, 7, 8]
                  : [4, 5, 6, 7, 8, 8];
            const definition = fishDefinitions[choices[Math.floor(random() * choices.length)]];
            const direction = (random() > .5 ? 1 : -1) as -1 | 1;
            const [minSpeed, maxSpeed] = this.speedRange(fishDepth);
            const visualSize = definition.swift ? 42 + random() * 20 : 72 + random() * 58;
            const speedVariation = .58 + random() * .84;
            const sourceWidth = definition.sourceWidth ?? 443;
            const speed = definition.swift
              ? WORLD_WIDTH * (.55 + random() * .15)
              : (minSpeed + random() * (maxSpeed - minSpeed)) * speedVariation;
            const sprite = this.add.image(direction === 1 ? -52 : WORLD_WIDTH + 52, 0, this.fishTexture(definition), this.fishFrame(definition))
              .setScale(direction * spriteScale(visualSize * definition.scale, sourceWidth), spriteScale(visualSize * definition.scale, sourceWidth))
              .setDepth(8)
              .setVisible(false);
            this.fish.push({
              kind: "fish", oceanDepth: fishDepth, definition, sprite, direction,
              speed,
              wave: definition.swift ? 2 + random() * 4 : 4 + random() * 9, phase: random() * Math.PI * 2, visualSize,
              caught: false, turnTime: 0,
              nextTurnAt: 1800 + random() * 3600,
            });
            fishDepth += zone === "moonlit"
              ? 16 + random() * 9
              : zone === "twilight"
                ? 15 + random() * 8
                : zone === "trench"
                  ? 14 + random() * 7
                  : 18 + random() * 9;
          }

          let obstacleDepth = 7 + random() * 7;
          let obstacleIndex = 0;
          while (obstacleDepth < MAX_DEPTH - 4) {
            if (obstacleDepth >= 500 && this.fish.some((entity) => Math.abs(entity.oceanDepth - obstacleDepth) < 5.5)) {
              obstacleDepth += 6;
            }
            const kind = obstacleIndex % 5;
            const x = 54 + random() * (WORLD_WIDTH - 108);
            const container = this.makeObstacle(kind, x);
            this.obstacles.push({ kind: "obstacle", oceanDepth: obstacleDepth, object: container, radius: kind === 4 ? 30 : 24, hitCooldown: 0 });
            obstacleDepth += obstacleDepth >= 500 ? 30 + random() * 16 : 22 + random() * 12;
            obstacleIndex += 1;
          }

          this.powers.push(this.makePower("shield", 112 + random() * 30, random));
          this.powers.push(this.makePower("magnet", 326 + random() * 44, random));
          this.powers.push(this.makePower("shield", 590 + random() * 95, random));
        }

        private makeObstacle(kind: number, x: number) {
          const frames = [1, 2, 3, 4, 6];
          const sizes = [68, 76, 72, 82, 78];
          const prop = this.add.image(0, 0, "prop-atlas", `prop-${frames[kind]}`).setDisplaySize(sizes[kind], sizes[kind] * 1.05);
          return this.add.container(x, -100, [prop]).setDepth(7).setVisible(false);
        }

        private makePower(power: "shield" | "magnet", oceanDepth: number, random: () => number): PowerEntity {
          const glow = this.add.circle(0, 0, 22, power === "shield" ? 0xa6f4ef : 0xffdf9a, .14);
          const frame = power === "shield" ? 7 : 5;
          const icon = this.add.image(0, 0, "prop-atlas", `prop-${frame}`).setDisplaySize(45, 52);
          const object = this.add.container(48 + random() * (WORLD_WIDTH - 96), -100, [glow, icon]).setDepth(12).setVisible(false);
          return { kind: "power", power, oceanDepth, object, collected: false };
        }

        startRun() {
          this.depthValue = 0;
          this.maxDepthValue = 0;
          this.scoreValue = 0;
          this.catchesValue = 0;
          this.comboValue = 0;
          this.maxComboValue = 0;
          this.comboExpiresAt = 0;
          this.reachedBottom = false;
          this.abyssWasActive = false;
          this.shield = false;
          this.magnetUntil = 0;
          this.discovered.clear();
          this.hookX = WORLD_WIDTH / 2;
          this.targetX = this.hookX;
          this.buildWorld();
          this.phase = "descending";
          this.previousPhase = "descending";
          this.externalPause = false;
          this.darkness?.setVisible(false);
          this.line.setDepth(20);
          this.runFeedback(() => {
            audioRef.current.setAbyss(false);
            audioRef.current.setPaused(false);
            audioRef.current.endAscent();
          });
          this.emitHud(true);
        }

        setPaused(paused: boolean) {
          this.externalPause = paused;
          this.runFeedback(() => audioRef.current.setPaused(paused));
          if (paused && this.phase !== "ready" && this.phase !== "results") {
            this.previousPhase = this.phase;
            this.phase = "paused";
            this.runFeedback(() => audioRef.current.endAscent());
          } else if (!paused && this.phase === "paused") {
            this.phase = this.previousPhase;
            if (this.phase === "ascending") this.runFeedback(() => audioRef.current.beginAscent());
          }
          this.emitHud(true);
        }

        setTargetX(x: number, immediate = false) {
          this.targetX = Phaser.Math.Clamp(x, 28, WORLD_WIDTH - 28);
          if (immediate) this.hookX = this.targetX;
        }

        private beginAscent() {
          if (this.phase !== "descending") return;
          this.phase = "ascending";
          this.previousPhase = "ascending";
          this.emitHud(true);
          this.runFeedback(() => {
            audioRef.current.beginAscent();
            this.contactFeedback("ascent");
          });
        }

        private runFeedback(effect: () => void) {
          try {
            effect();
          } catch {
            // Device feedback is optional and must never interrupt the game loop.
          }
        }

        private vibrate(pattern: number | number[]) {
          if (!hapticsRef.current || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
          try {
            navigator.vibrate(pattern);
          } catch {
            // Some embedded mobile browsers expose vibrate but reject calls.
          }
        }

        private contactFeedback(kind: "catch" | "new" | "obstacle" | "ascent") {
          if (kind === "catch" || kind === "new") {
            this.hitStopUntil = this.time.now + (kind === "new" ? 80 : 62);
            this.cameras.main.shake(kind === "new" ? 90 : 55, kind === "new" ? .0022 : .0012);
            this.tweens.add({ targets: this.hook, scaleX: 1.1, scaleY: .9, duration: 70, yoyo: true, ease: "Sine.Out" });
            this.vibrate(kind === "new" ? [18, 20, 24] : 12);
          } else if (kind === "obstacle") {
            this.cameras.main.shake(105, .0035);
            this.tweens.add({ targets: this.hook, angle: { from: -5, to: 5 }, duration: 48, repeat: 2, yoyo: true, onComplete: () => this.hook.setAngle(0) });
            this.vibrate(28);
          } else {
            this.tweens.add({ targets: this.hook, scaleX: 1.06, scaleY: .94, duration: 100, yoyo: true });
            this.vibrate(10);
          }
        }

        private showCatchLabel(label: string, color: string, yOffset = -74) {
          const text = this.add.text(this.hookX, this.hook.y + yOffset, label, {
            fontFamily: "system-ui, sans-serif",
            fontSize: "14px",
            fontStyle: "bold",
            color,
            stroke: "#03111f",
            strokeThickness: 4,
          }).setOrigin(.5).setDepth(30).setAlpha(0).setScale(.84);
          this.tweens.add({
            targets: text,
            alpha: 1,
            scale: 1,
            y: text.y - 16,
            duration: 180,
            hold: 390,
            yoyo: true,
            onComplete: () => text.destroy(),
          });
        }

        private catchFish(entity: FishEntity) {
          if (entity.caught) return;
          entity.caught = true;
          entity.sprite.setVisible(false);
          const now = this.time.now;
          this.comboValue = now <= this.comboExpiresAt ? this.comboValue + 1 : 1;
          this.comboExpiresAt = now + 1200;
          this.maxComboValue = Math.max(this.maxComboValue, this.comboValue);
          const multiplier = this.comboValue >= 10 ? 3 : this.comboValue >= 6 ? 2 : this.comboValue >= 3 ? 1.5 : 1;
          const bottomBonus = this.reachedBottom ? 1.25 : 1;
          const points = Math.round(entity.definition.baseScore * (1 + entity.oceanDepth / 100) * multiplier * bottomBonus);
          this.scoreValue += points;
          this.catchesValue += 1;
          const isNewSpecies = !this.discovered.has(entity.definition.id);
          this.discovered.add(entity.definition.id);
          discoverFish(entity.definition.id);
          this.emitHud(true);
          this.runFeedback(() => {
            if (this.phase === "ascending" && isNewSpecies) this.addTrophyFish(entity.definition);
            this.createCatchBurst(entity.sprite.x, this.hook.y);
            this.showCatchLabel(`+${points}`, isNewSpecies ? "#ffe7a8" : "#d5fff5", -66);
            this.contactFeedback(isNewSpecies ? "new" : "catch");
            audioRef.current.catchFish(entity.definition.capturePitch ?? 520, entity.visualSize, isNewSpecies, this.comboValue);
            if ([3, 6, 10].includes(this.comboValue)) {
              audioRef.current.comboMilestone(this.comboValue);
              this.showCatchLabel(`${this.comboValue} 连击`, "#a8f6ff", -120);
            }
          });
        }

        private addTrophyFish(definition: FishDefinition) {
          if (this.trophySpecies.has(definition.id)) return;
          this.trophySpecies.add(definition.id);
          const sprite = this.add.image(0, 0, this.fishTexture(definition), this.fishFrame(definition))
            .setAlpha(.94);
          sprite.setData("definition", definition);
          this.hook.add(sprite);
          this.trophyFish.push(sprite);
          const size = this.trophyFish.length > 6 ? 31 : 37;
          this.trophyFish.forEach((trophy, trophyIndex) => {
            const trophyDefinition = trophy.getData("definition") as FishDefinition;
            const row = Math.floor(trophyIndex / 2);
            const side = trophyIndex % 2 === 0 ? -1 : 1;
            trophy.setPosition(side * (size * .48), 58 + row * (size * .66));
            trophy.setDisplaySize(size, size * (trophyDefinition.spriteRatio ?? 1));
            trophy.setFlipX(side === 1);
          });
          this.tweens.add({ targets: sprite, scaleX: sprite.scaleX * 1.16, scaleY: sprite.scaleY * 1.16, duration: 150, yoyo: true });
        }

        private createCatchBurst(x: number, y: number) {
          const ring = this.add.circle(x, y, 18, 0xd5fff5, 0).setStrokeStyle(2, 0xbafff7, .72).setDepth(25);
          this.tweens.add({ targets: ring, scale: 2.15, alpha: 0, duration: 360, onComplete: () => ring.destroy() });
          for (let index = 0; index < 9; index += 1) {
            const dot = this.add.circle(x, y, 2 + Math.random() * 2.5, index % 3 === 0 ? 0xffe6a6 : 0xd5fff5, .86).setDepth(25);
            this.tweens.add({ targets: dot, x: x + (Math.random() - .5) * 70, y: y - 22 - Math.random() * 52, alpha: 0, scale: .2, duration: 460, onComplete: () => dot.destroy() });
          }
        }

        private collectPower(entity: PowerEntity) {
          if (entity.collected) return;
          entity.collected = true;
          entity.object.setVisible(false);
          if (entity.power === "shield") this.shield = true;
          else this.magnetUntil = this.time.now + 5000;
          this.emitHud(true);
          this.runFeedback(() => audioRef.current.power(entity.power === "shield" ? 690 : 820));
        }

        private finishRun() {
          this.phase = "results";
          this.runFeedback(() => {
            audioRef.current.endAscent();
            audioRef.current.setAbyss(false);
            audioRef.current.setPaused(true);
          });
          const result: RunSummary = {
            score: this.scoreValue,
            maxDepth: Math.round(this.maxDepthValue),
            catches: this.catchesValue,
            maxCombo: this.maxComboValue,
            discovered: [...this.discovered],
            reachedBottom: this.reachedBottom,
          };
          finishRun(result);
          this.emitHud(true);
        }

        private drawBackground() {
          const depth = this.depthValue;
          let top = 0x4babc0;
          let bottom = 0x15506e;
          if (depth >= 140 && depth < 310) { top = 0x194d6d; bottom = 0x102d4d; }
          if (depth >= 310 && depth < 500) { top = 0x102b4a; bottom = 0x040b18; }
          if (depth >= 500) { top = 0x06101f; bottom = 0x01040a; }
          this.background.clear();
          this.background.fillGradientStyle(top, top, bottom, bottom, 1);
          this.background.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
          this.background.fillStyle(0x99e8e8, Math.max(.015, .14 - depth / 1150));
          this.background.fillEllipse(WORLD_WIDTH * .2, -30, 330, 300);
          this.background.fillStyle(0xbceff0, Math.max(.015, .13 - depth / 900));
          this.background.fillTriangle(18, -30, 124, -30, 238, WORLD_HEIGHT);
          this.background.fillTriangle(210, -30, 290, -30, 340, WORLD_HEIGHT);
          this.background.fillStyle(0x03111f, .12 + depth / 2300);
          this.background.fillEllipse(-42, WORLD_HEIGHT * .78, 220, 390);
          this.background.fillEllipse(WORLD_WIDTH + 48, WORLD_HEIGHT * .82, 190, 350);
        }

        private updateAbyssVisuals() {
          const abyssActive = this.depthValue >= 500;
          this.darkness?.setVisible(abyssActive).setPosition(this.hookX, this.hook.y);
          this.line.setDepth(abyssActive ? 16 : 20);
          this.particles.setAlpha(abyssActive ? .34 : 1);
          if (abyssActive === this.abyssWasActive) return;
          this.abyssWasActive = abyssActive;
          this.runFeedback(() => audioRef.current.setAbyss(abyssActive));
          if (abyssActive && this.phase === "descending") {
            const title = this.add.text(WORLD_WIDTH / 2, 178, "幽光深渊\n500–800m", {
              align: "center",
              fontFamily: "system-ui, sans-serif",
              fontSize: "18px",
              fontStyle: "bold",
              color: "#c4fbff",
              stroke: "#010711",
              strokeThickness: 5,
            }).setOrigin(.5).setDepth(30).setAlpha(0);
            this.tweens.add({ targets: title, alpha: 1, y: 164, duration: 300, hold: 950, yoyo: true, onComplete: () => title.destroy() });
          }
        }

        private emitHud(force = false) {
          if (!force && this.time.now - this.lastHudAt < 100) return;
          this.lastHudAt = this.time.now;
          setHud({
            phase: this.phase,
            depth: Math.round(this.depthValue),
            score: this.scoreValue,
            catches: this.catchesValue,
            combo: this.comboValue,
            shield: this.shield,
            magnet: this.time.now < this.magnetUntil,
          });
        }

        update(_time: number, delta: number) {
          const rawSeconds = Math.min(delta, 40) / 1000;
          const seconds = rawSeconds * (this.time.now < this.hitStopUntil ? .28 : 1);
          this.drawBackground();
          this.particles.each((child: PhaserType.GameObjects.GameObject) => {
            const bubble = child as PhaserType.GameObjects.Arc;
            bubble.y -= Number(bubble.getData("speed")) * seconds;
            if (bubble.y < -8) { bubble.y = WORLD_HEIGHT + 8; bubble.x = Math.random() * WORLD_WIDTH; }
          });

          this.hookX = Phaser.Math.Linear(this.hookX, this.targetX, 1 - Math.pow(.0008, seconds));
          this.hook.setPosition(this.hookX, 348);
          this.line.clear();
          this.line.lineStyle(1, 0xd7f5fa, .62);
          this.line.lineBetween(this.hookX, -4, this.hookX, 312);
          this.updateAbyssVisuals();

          if (this.externalPause || (this.phase !== "descending" && this.phase !== "ascending")) return;

          if (this.phase === "descending") {
            this.depthValue = Math.min(MAX_DEPTH, this.depthValue + this.descentSpeed() * seconds);
            this.maxDepthValue = Math.max(this.maxDepthValue, this.depthValue);
            if (this.depthValue >= MAX_DEPTH) {
              this.reachedBottom = true;
              this.beginAscent();
            }
          } else {
            const ascentSpeed = this.descentSpeed() * 2.5;
            this.depthValue = Math.max(0, this.depthValue - ascentSpeed * seconds);
            this.runFeedback(() => audioRef.current.setReelSpeed(ascentSpeed));
            if (this.depthValue <= 0) this.finishRun();
          }
          this.updateAbyssVisuals();

          if (this.comboValue > 0 && this.time.now > this.comboExpiresAt) this.comboValue = 0;
          const pixelsPerMeter = 10;
          const hookY = this.hook.y;
          const magnetActive = this.phase === "ascending" && this.time.now < this.magnetUntil;

          this.fish.forEach((entity) => {
            if (entity.caught) return;
            const baseY = hookY + (entity.oceanDepth - this.depthValue) * pixelsPerMeter;
            const visible = baseY > -90 && baseY < WORLD_HEIGHT + 90;
            entity.sprite.setVisible(visible);
            if (!visible) return;

            entity.turnTime = Math.max(0, entity.turnTime - seconds);
            const edgeDistance = entity.direction === 1 ? WORLD_WIDTH - 34 - entity.sprite.x : entity.sprite.x - 34;
            const turnFactor = Phaser.Math.Clamp(edgeDistance / 34, .22, 1);
            const swimPulse = entity.definition.swift
              ? .93 + Math.sin(this.time.now / 210 + entity.phase) * .09
              : .78 + Math.sin(this.time.now / 820 + entity.phase) * .15 + Math.sin(this.time.now / 310 + entity.phase * 1.7) * .07;
            entity.sprite.x += entity.direction * entity.speed * swimPulse * turnFactor * seconds;
            const wanderingTurn = this.time.now >= entity.nextTurnAt && entity.sprite.x > 82 && entity.sprite.x < WORLD_WIDTH - 82;
            if (entity.turnTime <= 0 && (wanderingTurn || entity.sprite.x <= 34 || entity.sprite.x >= WORLD_WIDTH - 34)) {
              entity.sprite.x = Phaser.Math.Clamp(entity.sprite.x, 34, WORLD_WIDTH - 34);
              entity.direction = entity.direction === 1 ? -1 : 1;
              entity.turnTime = .24;
              entity.nextTurnAt = this.time.now + 1900 + Math.random() * 3900;
            }
            const frameScale = spriteScale(entity.visualSize * entity.definition.scale, entity.definition.sourceWidth ?? 443);
            const turnSquash = entity.turnTime > 0 ? .38 + (.24 - entity.turnTime) / .24 * .62 : 1;
            entity.sprite.setScale(entity.direction * frameScale * turnSquash, frameScale);
            entity.sprite.y = baseY
              + Math.sin(this.time.now / (entity.definition.swift ? 230 : 540) + entity.phase) * entity.wave
              + Math.sin(this.time.now / 1270 + entity.phase * 1.6) * entity.wave * .72;
            entity.sprite.rotation = Math.sin(this.time.now / (entity.definition.swift ? 260 : 610) + entity.phase) * (entity.definition.swift ? .035 : .065);

            if (magnetActive && Math.abs(entity.sprite.y - hookY) < 110) {
              entity.sprite.x = Phaser.Math.Linear(entity.sprite.x, this.hookX, seconds * 2.2);
            }
            const collisionY = 16 + entity.visualSize * .09;
            const collisionX = 20 + entity.visualSize * .14;
            if (Math.abs(entity.sprite.y - hookY) < collisionY && Math.abs(entity.sprite.x - this.hookX) < collisionX) {
              if (this.phase === "descending") {
                this.beginAscent();
                this.catchFish(entity);
              } else {
                this.catchFish(entity);
              }
            }
          });

          this.obstacles.forEach((entity) => {
            const y = hookY + (entity.oceanDepth - this.depthValue) * pixelsPerMeter;
            const visible = y > -70 && y < WORLD_HEIGHT + 70;
            entity.object.setVisible(visible).setY(y);
            if (!visible) return;
            entity.hitCooldown = Math.max(0, entity.hitCooldown - seconds);
            entity.object.rotation = Math.sin(this.time.now / 900 + entity.oceanDepth) * .055;
            if (entity.hitCooldown <= 0 && Math.abs(y - hookY) < entity.radius && Math.abs(entity.object.x - this.hookX) < entity.radius) {
              entity.hitCooldown = 1;
              const shieldAbsorbed = this.phase === "ascending" && this.shield;
              if (this.phase === "descending") {
                this.beginAscent();
              } else if (shieldAbsorbed) {
                this.shield = false;
              } else {
                this.comboValue = 0;
                this.comboExpiresAt = 0;
              }
              this.emitHud(true);
              this.runFeedback(() => {
                this.contactFeedback("obstacle");
                if (shieldAbsorbed) audioRef.current.power(720);
                else audioRef.current.obstacle();
              });
            }
          });

          this.powers.forEach((entity) => {
            if (entity.collected) return;
            const y = hookY + (entity.oceanDepth - this.depthValue) * pixelsPerMeter;
            const visible = y > -50 && y < WORLD_HEIGHT + 50;
            entity.object.setVisible(visible).setY(y);
            if (!visible) return;
            entity.object.rotation += seconds * .7;
            if (Math.abs(y - hookY) < 28 && Math.abs(entity.object.x - this.hookX) < 28) this.collectPower(entity);
          });

          this.emitHud();
        }
      }

      const scene = new DeepSeaScene();
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        parent: stageRef.current,
        transparent: true,
        scene,
        render: { antialias: true, roundPixels: false, powerPreference: "low-power" },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: WORLD_WIDTH, height: WORLD_HEIGHT },
        input: { activePointers: 1 },
      });

      const canvas = game.canvas;
      let activePointer: number | null = null;
      const setPointer = (event: PointerEvent) => {
        if (event.pointerType !== "mouse" && activePointer !== event.pointerId) return;
        const rect = canvas.getBoundingClientRect();
        scene.setTargetX((event.clientX - rect.left) / rect.width * WORLD_WIDTH, event.pointerType === "mouse");
      };
      const pointerDown = (event: PointerEvent) => {
        if (activePointer !== null) return;
        activePointer = event.pointerId;
        canvas.setPointerCapture?.(event.pointerId);
        setPointer(event);
      };
      const pointerUp = (event: PointerEvent) => {
        if (activePointer !== event.pointerId) return;
        if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        activePointer = null;
      };
      canvas.addEventListener("pointerdown", pointerDown);
      canvas.addEventListener("pointermove", setPointer);
      canvas.addEventListener("pointerup", pointerUp);
      canvas.addEventListener("pointercancel", pointerUp);

      runtime = {
        start: () => scene.startRun(),
        pause: (paused) => scene.setPaused(paused),
        destroy: () => {
          canvas.removeEventListener("pointerdown", pointerDown);
          canvas.removeEventListener("pointermove", setPointer);
          canvas.removeEventListener("pointerup", pointerUp);
          canvas.removeEventListener("pointercancel", pointerUp);
          game.destroy(true);
        },
      };
      runtimeRef.current = runtime;
    };

    void mount();
    return () => {
      disposed = true;
      runtime?.destroy();
      runtimeRef.current = null;
      gameAudio.stop();
    };
  }, [discoverFish, finishRun]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && hud.phase !== "ready" && hud.phase !== "results") {
        setManuallyPaused(true);
        runtimeRef.current?.pause(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [hud.phase]);

  const startGame = async () => {
    setSummary(null);
    setCatalogOpen(false);
    setManuallyPaused(false);
    knownAtRunStartRef.current = new Set(progress.discovered);
    try {
      await audioRef.current.start();
    } catch {
      audioRef.current.enabled = false;
    }
    runtimeRef.current?.start();
  };

  const togglePause = () => {
    const next = !manuallyPaused;
    setManuallyPaused(next);
    runtimeRef.current?.pause(next);
  };

  const toggleSound = () => {
    setProgress((current) => {
      const next = { ...current, soundEnabled: !current.soundEnabled };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      audioRef.current.setMuted(!next.soundEnabled);
      if (next.soundEnabled) void audioRef.current.start();
      return next;
    });
  };

  const toggleHaptics = () => {
    setProgress((current) => {
      const next = { ...current, hapticsEnabled: !current.hapticsEnabled };
      hapticsRef.current = next.hapticsEnabled;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (next.hapticsEnabled && typeof navigator.vibrate === "function") {
        try { navigator.vibrate(12); } catch { /* Optional on embedded browsers. */ }
      }
      return next;
    });
  };

  const activeRun = hud.phase === "descending" || hud.phase === "ascending" || hud.phase === "paused";
  const newFish = summary?.newDiscoveries ?? [];

  return (
    <main className={styles.page} aria-label="深海垂钓小游戏">
      <section className={styles.phone}>
        <div className={styles.stage} ref={stageRef} aria-hidden="true" />

        <div className={styles.hud} aria-live="polite">
          <div className={styles.metric}><span>深度</span><strong>{hud.depth}m</strong></div>
          <div className={styles.phase}>{phaseLabel(hud.phase)}</div>
          <div className={styles.metric}><span>微光 · {hud.catches}</span><strong>{hud.score}</strong></div>
        </div>

        <div className={styles.topActions}>
          <Link href="/" className={styles.iconButton} aria-label="返回未寄首页" title="返回首页">‹</Link>
          <div className={styles.actionGroup}>
            {activeRun && <button className={styles.iconButton} type="button" onClick={togglePause} aria-label={manuallyPaused ? "继续" : "暂停"}>{manuallyPaused ? "▶" : "Ⅱ"}</button>}
            <button className={styles.iconButton} type="button" onClick={toggleSound} aria-label={progress.soundEnabled ? "关闭音效" : "开启音效"}>{progress.soundEnabled ? "♪" : "×"}</button>
          </div>
        </div>

        {hud.phase === "ready" && !catalogOpen && (
          <div className={styles.overlay}>
            <p className={styles.kicker}>MIDNIGHT FISHING · 800M</p>
            <h1>深海垂钓</h1>
            <p className={styles.lead}>避开来回游动的鱼群，尽可能潜得更深。返航时，再把沿途的微光带回海面。</p>
            <div className={styles.records}>
              <div><span>最深抵达</span><strong>{Math.round(progress.deepest)}m</strong></div>
              <div><span>最高微光</span><strong>{progress.bestScore}</strong></div>
            </div>
            <div className={styles.buttonRow}>
              <button className={styles.primary} type="button" onClick={() => void startGame()}>开始下潜</button>
              <button className={styles.secondary} type="button" onClick={() => setCatalogOpen(true)}>鱼类图鉴 {progress.discovered.length}/9</button>
            </div>
          </div>
        )}

        {manuallyPaused && activeRun && (
          <div className={styles.overlay}>
            <p className={styles.kicker}>PAUSED</p>
            <h2>海面暂静</h2>
            <p className={styles.lead}>鱼群在水光里等你回来。</p>
            <div className={styles.pauseSettings} aria-label="反馈设置">
              <button className={styles.settingButton} type="button" onClick={toggleSound} aria-pressed={progress.soundEnabled}>音效 {progress.soundEnabled ? "开" : "关"}</button>
              <button className={styles.settingButton} type="button" onClick={toggleHaptics} aria-pressed={progress.hapticsEnabled}>触感 {progress.hapticsEnabled ? "开" : "关"}</button>
            </div>
            <button className={styles.primary} type="button" onClick={togglePause}>继续下潜</button>
          </div>
        )}

        {hud.phase === "results" && summary && !catalogOpen && (
          <div className={styles.overlay}>
            <p className={styles.kicker}>{summary.reachedBottom ? "DEEP SEA ECHO" : "BACK TO THE SURFACE"}</p>
            <h2>平安返航</h2>
            <p className={styles.resultLine}>本次带回的微光</p>
            <p className={styles.resultScore}>{summary.score}</p>
            <div className={styles.records}>
              <div><span>最深抵达</span><strong>{summary.maxDepth}m</strong></div>
              <div><span>最高连击</span><strong>{summary.maxCombo}</strong></div>
            </div>
            {summary.discovered.length > 0 && (
              <div className={styles.resultSpecies} aria-label={`本局遇见 ${summary.discovered.length} 种鱼`}>
                {summary.discovered.map((id) => {
                  const fish = fishDefinitions.find((item) => item.id === id);
                  if (!fish) return null;
                  const isSwift = fish.swift === true;
                  const previewStyle = isSwift ? undefined : {
                    "--fish-x": `${(fish.frame % 4) * 33.333}%`,
                    "--fish-y": `${Math.floor(fish.frame / 4) * 100}%`,
                  } as CSSProperties;
                  const newlyDiscovered = newFish.includes(fish.id);
                  return <span className={`${styles.resultFish}${isSwift ? ` ${styles.swiftPreview}` : ""}${newlyDiscovered ? ` ${styles.resultFishNew}` : ""}`} style={previewStyle} title={`${fish.name}${newlyDiscovered ? " · 新相遇" : ""}`} key={fish.id} />;
                })}
              </div>
            )}
            {newFish.length > 0 && <p className={styles.newFish}>新遇见 {newFish.length} 种深海朋友</p>}
            <p className={styles.lead}>{resultMessage(summary)}</p>
            <div className={styles.buttonRow}>
              <button className={styles.primary} type="button" onClick={() => void startGame()}>再潜一次</button>
              <button className={styles.secondary} type="button" onClick={() => setCatalogOpen(true)}>看看图鉴</button>
            </div>
          </div>
        )}

        {catalogOpen && (
          <div className={`${styles.overlay} ${styles.catalog}`}>
            <p className={styles.kicker}>DEEP SEA FRIENDS</p>
            <h2>鱼类图鉴</h2>
            <p className={styles.catalogPromise}>收集所有的鱼，你将不再需要感情。</p>
            <div className={styles.catalogProgress} aria-label={`已捕获 ${progress.discovered.length} 种，共 ${fishDefinitions.length} 种`}>
              <span style={{ width: `${progress.discovered.length / fishDefinitions.length * 100}%` }} />
              <b>{progress.discovered.length} / {fishDefinitions.length}</b>
            </div>
            <div className={styles.catalogGrid}>
              {fishDefinitions.map((fish) => {
                const unlocked = progress.discovered.includes(fish.id);
                const isSwift = fish.swift === true;
                const column = fish.frame % 4;
                const row = Math.floor(fish.frame / 4);
                const previewStyle = isSwift ? undefined : { "--fish-x": `${column * 33.333}%`, "--fish-y": `${row * 100}%` } as CSSProperties;
                return (
                  <article className={`${styles.fishCard}${unlocked ? "" : ` ${styles.locked}`}`} key={fish.id}>
                    <span className={`${styles.fishPreview}${isSwift ? ` ${styles.swiftPreview}` : ""}`} style={previewStyle} aria-hidden="true" />
                    <div className={styles.fishDetails}>
                      <div className={styles.fishTitle}><b>{fish.name}</b><em>{unlocked ? "已捕获" : "未捕获"}</em></div>
                      <span>{unlocked ? fish.note : "它还藏在更深的海里"}</span>
                    </div>
                  </article>
                );
              })}
            </div>
            <button className={styles.secondary} type="button" onClick={() => setCatalogOpen(false)}>返回</button>
          </div>
        )}

        {activeRun && !manuallyPaused && <p className={styles.guide}>{hud.phase === "descending" ? "左右滑动 · 避开相遇" : `左右滑动 · 收集微光${hud.combo > 1 ? ` · 连击 ${hud.combo}` : ""}${hud.shield ? " · 月光泡" : ""}${hud.magnet ? " · 回声珍珠" : ""}`}</p>}

        <div className={styles.rotate}><div><strong>请把手机转回来</strong><span>竖屏的海，会更适合安静地下潜。</span></div></div>
      </section>
    </main>
  );
}

function spriteScale(displaySize: number, sourceSize: number) {
  return displaySize / sourceSize;
}
