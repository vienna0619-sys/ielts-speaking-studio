"use client";

import { useEffect, useRef } from "react";
import { registerAnimationTask } from "@/lib/examiner-motion";
import type { ExaminerActivity } from "./ExaminerAvatar";

const SPRITE_ROWS: Record<string, number> = {
  hana: 0,
  arjun: 1,
  nadia: 2,
  james: 3,
};

const STATUS_LABELS: Record<ExaminerActivity, string> = {
  idle: "考官已准备",
  speaking: "考官正在说话",
  listening: "考官正在倾听",
  thinking: "正在准备下一题",
};

/**
 * Honest local fallback for a future blend-shape/realtime-human provider.
 * Facial states are pre-rendered complete frames; no eye/mouth mask is painted
 * over a photograph. A shared RAF controller prevents timer and render-loop
 * accumulation during a full exam.
 */
export function MockExamExaminer({
  activity = "idle",
  speechLevel = 0,
  compact = false,
  avatarId = "hana",
  displayName = "Examiner H.",
}: {
  activity?: ExaminerActivity;
  speechLevel?: number;
  compact?: boolean;
  avatarId?: string;
  displayName?: string;
}) {
  const spriteRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const activityRef = useRef(activity);
  const levelRef = useRef(speechLevel);
  const rowRef = useRef(SPRITE_ROWS[avatarId] ?? 0);

  useEffect(() => {
    activityRef.current = activity;
    levelRef.current = activity === "speaking" ? speechLevel : 0;
    rowRef.current = SPRITE_ROWS[avatarId] ?? 0;
  }, [activity, avatarId, speechLevel]);

  useEffect(() => {
    let smoothed = 0;
    let mouthOpen = false;
    let nextBlink = performance.now() + 2200 + Math.random() * 4200;
    let blinkUntil = -1;
    let nextNod = performance.now() + 6200 + Math.random() * 6200;
    let nodStarted = -1;
    let lastFrame = -1;

    return registerAnimationTask((now, deltaMs) => {
      const currentActivity = activityRef.current;
      const target = currentActivity === "speaking" ? levelRef.current : 0;
      const response = target > smoothed ? 0.26 : 0.13;
      smoothed +=
        (target - smoothed) * response * Math.min(2, deltaMs / 16.7);
      if (mouthOpen ? smoothed < 0.07 : smoothed > 0.15) {
        mouthOpen = !mouthOpen;
      }

      if (now >= nextBlink) {
        blinkUntil = now + 120 + Math.random() * 55;
        nextBlink = now + 2800 + Math.random() * 4500;
        if (Math.random() < 0.1) nextBlink = blinkUntil + 220;
      }
      const blinking = now < blinkUntil;
      const visualFrame =
        blinking ? 1 : currentActivity === "speaking" && mouthOpen ? 2 : 0;
      if (visualFrame !== lastFrame && spriteRef.current) {
        lastFrame = visualFrame;
        spriteRef.current.style.backgroundPosition =
          `${visualFrame * 50}% ${rowRef.current * (100 / 3)}%`;
      }

      if (currentActivity === "listening" && now >= nextNod) {
        nodStarted = now;
        nextNod = now + 7200 + Math.random() * 6800;
      }
      const nodProgress =
        nodStarted < 0 ? 1 : Math.min(1, (now - nodStarted) / 720);
      const nod =
        nodProgress >= 1 ? 0 : Math.sin(nodProgress * Math.PI) * 1.4;
      if (nodProgress >= 1) nodStarted = -1;
      const breathing = Math.sin(now / 1800) * 0.7;
      const speakingMotion =
        currentActivity === "speaking" ? Math.sin(now / 820) * 0.16 : 0;
      if (frameRef.current) {
        frameRef.current.style.transform =
          `translateY(${breathing - nod}px) rotate(${speakingMotion}deg)`;
      }
    });
  }, []);

  return (
    <figure
      className={`mock-examiner ${activity} ${compact ? "compact" : ""}`}
      aria-label={`${displayName}，完全虚构的写实虚拟考官。${STATUS_LABELS[activity]}`}
    >
      <div
        ref={frameRef}
        className="mock-examiner-frame"
        role="img"
        aria-label={`${displayName}，预渲染写实虚拟成年人`}
      >
        <div
          ref={spriteRef}
          className="mock-examiner-sprite"
          style={{
            backgroundPosition: `0% ${(SPRITE_ROWS[avatarId] ?? 0) * (100 / 3)}%`,
          }}
          aria-hidden="true"
        />
      </div>
      <figcaption>
        <span className="status-orb" aria-hidden="true" />
        <strong>{STATUS_LABELS[activity]}</strong>
        <small>{displayName} · 虚构 AI · 简化真人模式</small>
      </figcaption>
    </figure>
  );
}
