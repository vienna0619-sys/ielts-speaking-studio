"use client";

import Image from "next/image";

export type ExaminerActivity = "idle" | "speaking" | "listening" | "thinking";

export function ExaminerAvatar({ activity = "idle", level = 0, compact = false }: { activity?: ExaminerActivity; level?: number; compact?: boolean }) {
  const mouthScale = activity === "speaking" ? 0.7 + Math.max(0.18, level) * 2.2 : 0.22;
  const labels: Record<ExaminerActivity, string> = {
    idle: "Ready",
    speaking: "Speaking",
    listening: "Listening",
    thinking: "Preparing",
  };
  return (
    <div className={`examiner ${activity} ${compact ? "compact" : ""}`} aria-label={`虚构 AI 考官，当前状态：${labels[activity]}`}>
      <div className="examiner-halo" aria-hidden="true" />
      <div className="examiner-frame">
        <Image src="/images/examiner.png" alt="完全虚构的 AI 英语口语考官" fill sizes={compact ? "220px" : "(max-width: 760px) 86vw, 520px"} priority />
        <div className="eye-blink eye-left" aria-hidden="true" />
        <div className="eye-blink eye-right" aria-hidden="true" />
        <div className="animated-mouth" aria-hidden="true" style={{ transform: `translateX(-50%) scaleY(${mouthScale})` }} />
        <div className="portrait-shade" aria-hidden="true" />
      </div>
      <div className="examiner-status">
        <span className="status-orb" aria-hidden="true" />
        <span>{labels[activity]}</span>
        <span className="fictional-label">Fictional AI examiner</span>
      </div>
    </div>
  );
}

export function AudioMeter({ level, active = false }: { level: number; active?: boolean }) {
  return (
    <div className={`audio-meter ${active ? "active" : ""}`} aria-label={`麦克风音量 ${Math.round(level * 100)}%`}>
      {Array.from({ length: 24 }, (_, index) => {
        const threshold = index / 24;
        const height = 6 + Math.sin((index + 1) * 1.7) * 4 + (index % 5) * 2;
        return <span key={index} className={level >= threshold ? "lit" : ""} style={{ height: `${Math.max(5, height)}px` }} />;
      })}
    </div>
  );
}
