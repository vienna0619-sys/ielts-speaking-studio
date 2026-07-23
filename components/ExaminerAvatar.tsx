"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SpeechViseme } from "@/lib/browser-audio";
import {
  registerAnimationTask,
  type ExaminerMotionController,
} from "@/lib/examiner-motion";

export type ExaminerActivity = "idle" | "speaking" | "listening" | "thinking";

interface AvatarTheme {
  skin: string;
  skinShadow: string;
  skinLight: string;
  hair: string;
  brow: string;
  iris: string;
  lip: string;
  mouth: string;
  jacket: string;
  shirt: string;
  accent: string;
}
const AVATAR_THEMES: Record<string, AvatarTheme> = {
  avery: {
    skin: "#d9a07d",
    skinShadow: "#bd7e60",
    skinLight: "#efc3a4",
    hair: "#352821",
    brow: "#443027",
    iris: "#597365",
    lip: "#a2575d",
    mouth: "#7e3541",
    jacket: "#203c55",
    shirt: "#eef2ec",
    accent: "#b9d2cf",
  },
  maya: {
    skin: "#7f4f38",
    skinShadow: "#643a2c",
    skinLight: "#a36c50",
    hair: "#1f1917",
    brow: "#291d19",
    iris: "#3a2821",
    lip: "#92535a",
    mouth: "#6f303b",
    jacket: "#28453e",
    shirt: "#e9ddcf",
    accent: "#d2af7c",
  },
  lin: {
    skin: "#e1b28f",
    skinShadow: "#bf886a",
    skinLight: "#f3ccb0",
    hair: "#24272b",
    brow: "#343234",
    iris: "#4c4037",
    lip: "#a75c64",
    mouth: "#813641",
    jacket: "#3b405a",
    shirt: "#f1eee8",
    accent: "#aab7d8",
  },
  rowan: {
    skin: "#c88d69",
    skinShadow: "#a96f53",
    skinLight: "#e6b393",
    hair: "#392d27",
    brow: "#44342d",
    iris: "#546f78",
    lip: "#98525a",
    mouth: "#71313b",
    jacket: "#263b4d",
    shirt: "#e7eceb",
    accent: "#b8c8d2",
  },
  jordan: {
    skin: "#68412f",
    skinShadow: "#503023",
    skinLight: "#8d6049",
    hair: "#171515",
    brow: "#241a17",
    iris: "#2f2420",
    lip: "#85505a",
    mouth: "#5e2d38",
    jacket: "#3c3547",
    shirt: "#e6ddd1",
    accent: "#c8afcf",
  },
  sam: {
    skin: "#b97b56",
    skinShadow: "#965f43",
    skinLight: "#d7a07a",
    hair: "#777778",
    brow: "#5d5551",
    iris: "#485b54",
    lip: "#8d5057",
    mouth: "#6d303a",
    jacket: "#2e454b",
    shirt: "#e8ece7",
    accent: "#b9d0cc",
  },
};

function HairBack({ avatarId, color }: { avatarId: string; color: string }) {
  if (avatarId === "avery")
    return (
      <path
        d="M111 237C82 146 118 65 210 62c94 3 126 88 98 183l-29-3-137 2Z"
        fill={color}
      />
    );
  if (avatarId === "maya")
    return (
      <g fill={color}>
        {[
          [127, 121, 47],
          [166, 86, 48],
          [213, 76, 51],
          [261, 91, 48],
          [296, 132, 44],
          [115, 171, 40],
          [305, 178, 38],
        ].map(([cx, cy, r], index) => (
          <circle key={index} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    );
  if (avatarId === "lin")
    return (
      <path
        d="M116 186C112 94 161 61 219 65c73 4 99 58 83 133l-33-57-120 4Z"
        fill={color}
      />
    );
  if (avatarId === "jordan")
    return (
      <g fill={color}>
        {[
          [137, 109, 37],
          [174, 84, 39],
          [215, 77, 41],
          [255, 86, 38],
          [286, 116, 35],
          [119, 146, 31],
          [300, 150, 30],
        ].map(([cx, cy, r], index) => (
          <circle key={index} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    );
  return (
    <path
      d="M113 188C102 105 150 65 215 66c76 2 105 54 87 133l-31-54-126-1Z"
      fill={color}
    />
  );
}

function HairFront({ avatarId, color }: { avatarId: string; color: string }) {
  if (avatarId === "avery")
    return (
      <>
        <path
          d="M115 154c22-72 90-93 151-61 33 18 45 57 39 94-35-31-82-49-142-39-13 2-31 9-48 19Z"
          fill={color}
        />
        <path d="M118 145c-20 47-10 96 5 126l24-70 2-69Z" fill={color} />
      </>
    );
  if (avatarId === "maya")
    return (
      <g fill={color}>
        {[
          [142, 111, 28],
          [177, 92, 30],
          [213, 89, 31],
          [250, 98, 29],
          [280, 119, 26],
          [121, 143, 25],
          [302, 148, 24],
        ].map(([cx, cy, r], index) => (
          <circle key={index} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    );
  if (avatarId === "lin")
    return (
      <path
        d="M119 151c24-65 82-85 140-58 25 12 39 34 43 62-39-19-75-32-112-29-27 2-47 13-71 25Z"
        fill={color}
      />
    );
  if (avatarId === "rowan")
    return (
      <>
        <path
          d="M116 159c20-70 77-99 138-69 26 13 43 35 49 68-30-15-58-24-91-25-38-1-65 9-96 26Z"
          fill={color}
        />
        <path
          d="M210 83c-7 22-5 39 2 52"
          fill="none"
          stroke="#e7c5aa"
          strokeOpacity=".32"
          strokeWidth="3"
        />
      </>
    );
  if (avatarId === "jordan")
    return (
      <g fill={color}>
        {[
          [138, 115, 24],
          [168, 96, 26],
          [202, 91, 27],
          [236, 95, 27],
          [268, 108, 24],
          [291, 135, 22],
          [117, 142, 22],
        ].map(([cx, cy, r], index) => (
          <circle key={index} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    );
  return (
    <>
      <path
        d="M117 157c24-68 81-91 138-68 27 11 44 32 50 64-38-17-75-27-113-23-27 3-50 13-75 27Z"
        fill={color}
      />
      <path
        d="M127 136c43-35 94-45 153-18"
        fill="none"
        stroke="#dad9d5"
        strokeOpacity=".42"
        strokeWidth="9"
        strokeLinecap="round"
      />
    </>
  );
}

export function ExaminerAvatar({
  activity = "idle",
  speechLevel = 0,
  viseme = "rest",
  compact = false,
  avatarId = "avery",
  displayName = "Examiner Avery",
  motion,
}: {
  activity?: ExaminerActivity;
  speechLevel?: number;
  viseme?: SpeechViseme;
  compact?: boolean;
  avatarId?: string;
  displayName?: string;
  motion?: ExaminerMotionController;
}) {
  const theme = AVATAR_THEMES[avatarId] ?? AVATAR_THEMES.avery;
  const gradientId = useId().replaceAll(":", "");
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const leftEyeRef = useRef<SVGGElement>(null);
  const rightEyeRef = useRef<SVGGElement>(null);
  const leftEyelidRef = useRef<SVGPathElement>(null);
  const rightEyelidRef = useRef<SVGPathElement>(null);
  const lowerFaceRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGEllipseElement>(null);
  const teethRef = useRef<SVGPathElement>(null);
  const lowerLipRef = useRef<SVGPathElement>(null);
  const chinRef = useRef<SVGPathElement>(null);
  const activityRef = useRef(activity);
  const speechLevelRef = useRef(speechLevel);
  const visemeRef = useRef(viseme);
  const [debugSnapshot, setDebugSnapshot] = useState(
    motion?.snapshot() ?? null,
  );

  useEffect(() => {
    activityRef.current = activity;
    speechLevelRef.current = speechLevel;
    visemeRef.current = viseme;
    motion?.setActivity(activity);
  }, [activity, motion, speechLevel, viseme]);

  useEffect(() => {
    let mouthBlend = 0;
    let blinkStart = -1;
    let nextBlink = performance.now() + 1800 + Math.random() * 3600;
    let nextGaze = performance.now() + 2200 + Math.random() * 3200;
    let gazeX = 0;
    let gazeY = 0;
    let targetGazeX = 0;
    let targetGazeY = 0;
    let nextNod = performance.now() + 4800 + Math.random() * 5200;
    let nodStart = -1;
    let lastDebug = 0;
    const unregister = registerAnimationTask((now, deltaMs) => {
      const currentActivity = motion?.getActivity() ?? activityRef.current;
      const targetLevel =
        currentActivity === "speaking"
          ? motion?.getAudioLevel() ?? speechLevelRef.current
          : 0;
      const smoothing = targetLevel > mouthBlend ? 0.24 : 0.14;
      mouthBlend += (Math.min(0.88, targetLevel) - mouthBlend) * smoothing;
      if (mouthBlend < 0.012) mouthBlend = 0;
      motion?.setMouthBlend(mouthBlend);
      const currentViseme = motion?.getViseme() ?? visemeRef.current;
      const shape =
        currentViseme === "round"
          ? { width: 0.78, height: 1.08 }
          : currentViseme === "wide"
            ? { width: 1.12, height: 0.72 }
            : { width: 1, height: 1 };
      const jaw = mouthBlend * 7;
      mouthRef.current?.setAttribute(
        "rx",
        String(22 * shape.width + mouthBlend * 3),
      );
      mouthRef.current?.setAttribute(
        "ry",
        String(1.2 + mouthBlend * 13 * shape.height),
      );
      mouthRef.current?.setAttribute(
        "opacity",
        mouthBlend > 0.015 ? "1" : "0",
      );
      teethRef.current?.setAttribute(
        "opacity",
        String(Math.max(0, Math.min(0.82, (mouthBlend - 0.22) * 2.4))),
      );
      if (lowerFaceRef.current)
        lowerFaceRef.current.style.transform = `translateY(${jaw * 0.34}px)`;
      lowerLipRef.current?.setAttribute(
        "d",
        `M188 ${319 + jaw * 0.35}c12 ${5 + mouthBlend * 4} 32 ${5 + mouthBlend * 4} 44 0-10 ${10 + mouthBlend * 2}-34 ${11 + mouthBlend * 2}-44 0Z`,
      );
      if (chinRef.current)
        chinRef.current.style.transform = `translateY(${jaw * 0.5}px)`;

      if (now >= nextBlink) {
        blinkStart = now;
        nextBlink = now + 2800 + Math.random() * 4400;
        if (Math.random() < 0.12) nextBlink = now + 380;
      }
      const blinkProgress =
        blinkStart < 0 ? 0 : Math.min(1, (now - blinkStart) / 170);
      const lidScale =
        blinkProgress >= 1 ? 0 : Math.sin(blinkProgress * Math.PI);
      for (const lid of [leftEyelidRef.current, rightEyelidRef.current]) {
        if (!lid) continue;
        lid.style.opacity = String(lidScale);
        lid.style.transform = `scaleY(${0.08 + lidScale * 0.92})`;
      }
      if (blinkProgress >= 1) blinkStart = -1;

      if (now >= nextGaze) {
        const listening = currentActivity === "listening";
        targetGazeX = listening ? 0 : (Math.random() - 0.5) * 2.6;
        targetGazeY = listening ? 0 : (Math.random() - 0.5) * 1.5;
        nextGaze = now + 2800 + Math.random() * 4300;
      }
      gazeX += (targetGazeX - gazeX) * 0.025 * Math.min(2, deltaMs / 16.7);
      gazeY += (targetGazeY - gazeY) * 0.025 * Math.min(2, deltaMs / 16.7);
      const gazeTransform = `translate(${gazeX}px, ${gazeY}px)`;
      if (leftEyeRef.current) leftEyeRef.current.style.transform = gazeTransform;
      if (rightEyeRef.current)
        rightEyeRef.current.style.transform = gazeTransform;

      if (currentActivity === "listening" && now >= nextNod) {
        nodStart = now;
        nextNod = now + 6500 + Math.random() * 6500;
      }
      const nodProgress =
        nodStart < 0 ? 0 : Math.min(1, (now - nodStart) / 720);
      const nod = nodProgress >= 1 ? 0 : Math.sin(nodProgress * Math.PI) * 1.6;
      if (nodProgress >= 1) nodStart = -1;
      const breathing = Math.sin(now / 1650) * 0.8;
      const speechHead =
        currentActivity === "speaking" ? Math.sin(now / 720) * 0.45 : 0;
      if (bodyRef.current)
        bodyRef.current.style.transform = `translateY(${breathing * 0.45}px)`;
      if (headRef.current)
        headRef.current.style.transform = `translateY(${nod + breathing * 0.18}px) rotate(${speechHead}deg)`;
      if (frameRef.current)
        frameRef.current.style.setProperty("--avatar-motion-ready", "1");

      if (
        motion &&
        (import.meta.env.DEV ||
          new URLSearchParams(window.location.search).get(
            "debugPerformance",
          ) === "1") &&
        now - lastDebug > 400
      ) {
        lastDebug = now;
        setDebugSnapshot(motion.snapshot());
      }
    });
    return unregister;
  }, [motion]);

  const labels: Record<ExaminerActivity, string> = {
    idle: "Ready",
    speaking: "Speaking",
    listening: "Listening",
    thinking: "Preparing",
  };

  return (
    <div
      className={`examiner ${activity} ${compact ? "compact" : ""}`}
      aria-label={`${displayName}，完全虚构的 AI 考官，当前状态：${labels[activity]}`}
    >
      <div className="examiner-halo" aria-hidden="true" />
      <div
        ref={frameRef}
        className="examiner-frame avatar-frame"
      >
        <svg
          className="avatar-rig"
          viewBox="0 0 420 520"
          role="img"
          aria-label={`${displayName}，可动画的虚构二维考官`}
        >
          <defs>
            <linearGradient id={`${gradientId}-bg`} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#274a62" />
              <stop offset="1" stopColor="#10283d" />
            </linearGradient>
            <linearGradient
              id={`${gradientId}-jacket`}
              x1="0"
              y1="0"
              x2="0.9"
              y2="1"
            >
              <stop stopColor={theme.jacket} />
              <stop offset="1" stopColor="#17293a" />
            </linearGradient>
            <radialGradient id={`${gradientId}-face`} cx="42%" cy="28%" r="70%">
              <stop stopColor={theme.skinLight} />
              <stop offset=".38" stopColor={theme.skin} />
              <stop offset="1" stopColor={theme.skinShadow} />
            </radialGradient>
          </defs>
          <rect width="420" height="520" fill={`url(#${gradientId}-bg)`} />
          <circle cx="210" cy="210" r="164" fill={theme.accent} opacity=".09" />
          <g ref={bodyRef} className="avatar-body">
            <path
              d="M38 520c13-86 67-133 131-145h82c66 11 119 58 132 145Z"
              fill={`url(#${gradientId}-jacket)`}
            />
            <path d="m151 386 59 82 60-82-36-18h-49Z" fill={theme.shirt} />
            <path
              d="m151 386 59 82-44 52H91c11-67 29-111 60-134Zm119 0-60 82 44 52h75c-10-67-28-111-59-134Z"
              fill={theme.jacket}
            />
            <path
              d="M183 340h54v56c-8 16-46 16-54 0Z"
              fill={theme.skinShadow}
            />
          </g>
          <g ref={headRef} className="avatar-head">
            <HairBack avatarId={avatarId} color={theme.hair} />
            <ellipse
              cx="116"
              cy="240"
              rx="22"
              ry="36"
              fill={theme.skinShadow}
            />
            <ellipse
              cx="304"
              cy="240"
              rx="22"
              ry="36"
              fill={theme.skinShadow}
            />
            <path
              d="M119 176c5-70 46-101 92-101 52 0 91 34 94 103l-8 94c-6 57-40 101-87 103-47-2-81-46-87-103Z"
              fill={`url(#${gradientId}-face)`}
            />
            <path
              d="M133 277c13 62 41 91 77 96-44-2-77-42-84-96Z"
              fill={theme.skinShadow}
              opacity=".22"
            />
            <HairFront avatarId={avatarId} color={theme.hair} />
            <g
              className="avatar-brows"
              fill="none"
              stroke={theme.brow}
              strokeWidth="7"
              strokeLinecap="round"
            >
              <path d="M144 220c13-8 29-8 43-2" />
              <path d="M233 218c15-7 31-6 44 2" />
            </g>
            <g className="avatar-eye">
              <ellipse cx="166" cy="246" rx="23" ry="10.5" fill="#fffaf1" />
              <g ref={leftEyeRef}>
                <circle cx="166" cy="246" r="7" fill={theme.iris} />
                <circle cx="166" cy="246" r="3" fill="#17211f" />
                <circle
                  cx="163.5"
                  cy="243.5"
                  r="1.5"
                  fill="#fff"
                  opacity=".9"
                />
              </g>
              <path
                d="M143 246c10-13 36-14 46 0"
                fill="none"
                stroke={theme.brow}
                strokeOpacity=".56"
                strokeWidth="2.4"
              />
            </g>
            <path
              ref={leftEyelidRef}
              className="avatar-eyelid"
              d="M141 234c12-10 38-11 50 1v17c-12 8-38 8-50-1Z"
              fill={theme.skin}
              style={{ transformOrigin: "166px 234px" }}
            />
            <g className="avatar-eye">
              <ellipse cx="254" cy="246" rx="23" ry="10.5" fill="#fffaf1" />
              <g ref={rightEyeRef}>
                <circle cx="254" cy="246" r="7" fill={theme.iris} />
                <circle cx="254" cy="246" r="3" fill="#17211f" />
                <circle
                  cx="251.5"
                  cy="243.5"
                  r="1.5"
                  fill="#fff"
                  opacity=".9"
                />
              </g>
              <path
                d="M231 246c10-13 36-14 46 0"
                fill="none"
                stroke={theme.brow}
                strokeOpacity=".56"
                strokeWidth="2.4"
              />
            </g>
            <path
              ref={rightEyelidRef}
              className="avatar-eyelid"
              d="M229 235c12-10 38-11 50 0v17c-12 8-38 8-50 0Z"
              fill={theme.skin}
              style={{ transformOrigin: "254px 235px" }}
            />
            <path
              d="M210 244c-4 21-8 39-9 47 6 5 13 6 20 1"
              fill="none"
              stroke={theme.skinShadow}
              strokeOpacity=".58"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <g
              ref={lowerFaceRef}
              className="avatar-lower-face"
            >
              <ellipse
                ref={mouthRef}
                cx="210"
                cy="318"
                rx="22"
                ry="1.2"
                fill={theme.mouth}
                opacity="0"
              />
              <path
                ref={teethRef}
                d="M193 314c10-4 24-4 34 0-4 4-28 4-34 0Z"
                fill="#f3e9dc"
                opacity="0"
              />
              <path
                d="M188 317c8-5 14-7 22-4 8-3 15-1 22 4-12 3-32 3-44 0Z"
                fill={theme.lip}
              />
              <path
                ref={lowerLipRef}
                d="M188 319c12 5 32 5 44 0-10 10-34 11-44 0Z"
                fill={theme.lip}
              />
            </g>
            <path
              ref={chinRef}
              d="M178 348c18 11 47 11 65 0"
              fill="none"
              stroke={theme.skinLight}
              strokeOpacity=".2"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>
      <div className="examiner-status">
        <span className="status-orb" aria-hidden="true" />
        <span>{labels[activity]}</span>
        <span className="fictional-label">{displayName} · Fictional AI</span>
      </div>
      {debugSnapshot &&
        (import.meta.env.DEV ||
          (typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).get(
              "debugPerformance",
            ) === "1")) && (
          <div className="examiner-performance" aria-label="开发性能诊断">
            <span>{debugSnapshot.activity}</span>
            <span>{debugSnapshot.fps} FPS</span>
            <span>{debugSnapshot.resolvedVoice}</span>
            <span>audio {debugSnapshot.audioLevel.toFixed(2)}</span>
            <span>mouth {debugSnapshot.mouthBlendValue.toFixed(2)}</span>
            <span>loops {debugSnapshot.activeAnimationLoopCount}</span>
            <span>audio ctx {debugSnapshot.activeAudioContextCount}</span>
            <span>dropped {debugSnapshot.droppedFrameEstimate}</span>
          </div>
        )}
    </div>
  );
}

export function AudioMeter({
  level,
  active = false,
}: {
  level: number;
  active?: boolean;
}) {
  return (
    <div
      className={`audio-meter ${active ? "active" : ""}`}
      aria-label={`麦克风音量 ${Math.round(level * 100)}%`}
    >
      {Array.from({ length: 24 }, (_, index) => {
        const threshold = index / 24;
        const height = 6 + Math.sin((index + 1) * 1.7) * 4 + (index % 5) * 2;
        return (
          <span
            key={index}
            className={level >= threshold ? "lit" : ""}
            style={{ height: `${Math.max(5, height)}px` }}
          />
        );
      })}
    </div>
  );
}
