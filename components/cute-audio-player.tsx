"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

const playlist = [
  { title: "スパークル (火花)", artist: "RADWIMPS", src: "/music/sparkle.mp3" },
  { title: "愛にできることはまだあるかい", artist: "RADWIMPS", src: "/music/sparkle1.mp3" },
] as const;

const FADE_STEP_MS = 24;

export function CuteAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const pendingPlayRef = useRef(true);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const track = playlist[currentIndex];

  const stopFade = useCallback(() => {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const fadeTo = useCallback((target: number, duration: number, onDone?: () => void) => {
    const audio = audioRef.current;
    if (!audio) return;
    stopFade();
    const start = audio.volume;
    const steps = Math.max(1, Math.round(duration / FADE_STEP_MS));
    let step = 0;
    fadeTimerRef.current = window.setInterval(() => {
      step += 1;
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * (step / steps)));
      if (step >= steps) {
        stopFade();
        onDone?.();
      }
    }, FADE_STEP_MS);
  }, [stopFade]);

  const startCurrentTrack = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    stopFade();
    try {
      await audio.play();
      setAutoplayBlocked(false);
      setIsPlaying(true);
      fadeTo(1, 320, () => setIsSwitching(false));
    } catch {
      audio.volume = 1;
      setAutoplayBlocked(true);
      setIsPlaying(false);
      setIsSwitching(false);
    }
  }, [fadeTo, stopFade]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    setProgress(0);
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false;
      audio.volume = 0;
      void startCurrentTrack();
    } else {
      audio.volume = 1;
      setIsSwitching(false);
    }
  }, [currentIndex, startCurrentTrack]);

  useEffect(() => {
    if (!autoplayBlocked) return;

    const resumeAfterInteraction = () => {
      if (audioRef.current?.paused) void startCurrentTrack();
    };

    // Desktop and mobile browsers can reject audible autoplay until the first
    // user gesture. Retry inside that gesture so visitors need not find the
    // small player control before the music can begin.
    document.addEventListener("pointerdown", resumeAfterInteraction, { capture: true, once: true });
    document.addEventListener("keydown", resumeAfterInteraction, { capture: true, once: true });

    return () => {
      document.removeEventListener("pointerdown", resumeAfterInteraction, true);
      document.removeEventListener("keydown", resumeAfterInteraction, true);
    };
  }, [autoplayBlocked, startCurrentTrack]);

  useEffect(() => () => stopFade(), [stopFade]);

  const advanceTrack = useCallback((forcePlay?: boolean) => {
    const audio = audioRef.current;
    if (!audio || isSwitching) return;
    const shouldResume = forcePlay ?? !audio.paused;
    setIsSwitching(true);
    fadeTo(0, 180, () => {
      audio.pause();
      pendingPlayRef.current = shouldResume;
      setCurrentIndex((index) => (index + 1) % playlist.length);
    });
  }, [fadeTo, isSwitching]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || isSwitching) return;
    if (audio.paused) {
      audio.volume = 0;
      await startCurrentTrack();
    } else {
      stopFade();
      audio.pause();
      audio.volume = 1;
      setIsPlaying(false);
    }
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { pointerX: event.clientX, pointerY: event.clientY, ...offset };
    setIsDragging(true);
  };

  const movePlayer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    setOffset({
      x: Math.max(-90, Math.min(90, start.x + event.clientX - start.pointerX)),
      y: Math.max(-64, Math.min(64, start.y + event.clientY - start.pointerY)),
    });
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragStartRef.current = null;
    setIsDragging(false);
  };

  return (
    <aside
      className={`cute-player${isPlaying ? " is-playing" : ""}${isSwitching ? " is-switching" : ""}${isDragging ? " is-dragging" : ""}`}
      style={{ "--player-x": `${offset.x}px`, "--player-y": `${offset.y}px` } as CSSProperties}
      aria-label="悬浮音乐播放器"
    >
      <audio
        ref={audioRef}
        src={track.src}
        preload="auto"
        autoPlay
        onEnded={() => advanceTrack(true)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
        }}
      />

      <button
        type="button"
        className="player-drag-handle"
        onPointerDown={beginDrag}
        onPointerMove={movePlayer}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onDoubleClick={() => setOffset({ x: 0, y: 0 })}
        aria-label="拖动播放器位置，双击归位"
        title="拖动位置 · 双击归位"
      ><span aria-hidden="true">•••</span></button>

      <button
        type="button"
        className="cute-bear-button"
        onClick={() => void togglePlayback()}
        aria-label={isPlaying ? "暂停" : "播放"}
        title={isPlaying ? "暂停" : "播放"}
      >
        <span className="bear-wave bear-wave-left" aria-hidden="true" />
        <Image className="headphone-bear" src="/assets/headphone-bear-player.png" alt="" width={96} height={96} priority />
        <span className="bear-action-icon" aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
        <span className="bear-wave bear-wave-right" aria-hidden="true" />
      </button>

      <div className="cute-player-body">
        <div className="cute-player-copy">
          <span className="cute-player-kicker">NOW PLAYING · 0{currentIndex + 1}</span>
          <strong title={track.title}>{track.title}</strong>
          <small>{track.artist}</small>
        </div>
        <div className="cute-player-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
        <div className="cute-player-controls">
          <button type="button" className="cute-next-button" onClick={() => advanceTrack()} aria-label="下一首" title="下一首">
            <span aria-hidden="true">▶|</span>
          </button>
          <span className="cute-player-status" aria-live="polite">{isSwitching ? "轻轻换一首" : isPlaying ? "陪你听一会儿" : autoplayBlocked ? "浏览器暂停了自动播放" : "准备播放"}</span>
        </div>
      </div>
    </aside>
  );
}
