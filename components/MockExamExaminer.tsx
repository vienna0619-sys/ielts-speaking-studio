"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExaminerActivity } from "./ExaminerAvatar";

const SPRITE_ROWS: Record<string, number> = { hana: 0, arjun: 1, nadia: 2, james: 3 };

const STATUS_LABELS: Record<ExaminerActivity, string> = {
  idle: "考官已准备",
  speaking: "考官正在说话",
  listening: "考官正在倾听",
  thinking: "正在准备下一题",
};

/**
 * A local, honest fallback for a future blend-shape/realtime-human provider.
 * Every facial state is a genuine pre-rendered frame; this component never
 * paints synthetic eye or mouth masks over a photograph.
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
  const [blinking, setBlinking] = useState(false);
  const [nodding, setNodding] = useState(false);
  const row = SPRITE_ROWS[avatarId] ?? 0;

  useEffect(() => {
    let blinkTimer = 0;
    let releaseTimer = 0;
    const schedule = () => {
      blinkTimer = window.setTimeout(() => {
        setBlinking(true);
        releaseTimer = window.setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 125 + Math.random() * 65);
      }, 2400 + Math.random() * 4200);
    };
    schedule();
    return () => {
      window.clearTimeout(blinkTimer);
      window.clearTimeout(releaseTimer);
    };
  }, []);

  useEffect(() => {
    if (activity !== "listening") return;
    let nodTimer = 0;
    let releaseTimer = 0;
    const schedule = () => {
      nodTimer = window.setTimeout(() => {
        setNodding(true);
        releaseTimer = window.setTimeout(() => {
          setNodding(false);
          schedule();
        }, 520);
      }, 6000 + Math.random() * 6000);
    };
    schedule();
    return () => {
      window.clearTimeout(nodTimer);
      window.clearTimeout(releaseTimer);
    };
  }, [activity]);

  // The upstream audio driver already applies attack/release smoothing and a
  // silence gate, so the real pre-rendered mouth frame follows audio energy
  // without introducing a second React state loop.
  const frame = blinking ? 1 : activity === "speaking" && speechLevel > 0.12 ? 2 : 0;
  const backgroundPosition = useMemo(
    () => `${frame * 50}% ${row * (100 / 3)}%`,
    [frame, row],
  );

  return (
    <figure
      className={`mock-examiner ${activity} ${compact ? "compact" : ""}`}
      aria-label={`${displayName}，完全虚构的写实虚拟考官。${STATUS_LABELS[activity]}`}
    >
      <div
        className={`mock-examiner-frame ${activity === "listening" && nodding ? "is-nodding" : ""}`}
        role="img"
        aria-label={`${displayName}，预渲染写实虚拟成年人`}
      >
        <div
          className="mock-examiner-sprite"
          style={{ backgroundPosition }}
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
