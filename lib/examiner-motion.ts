"use client";

export type ExaminerMotionActivity =
  | "idle"
  | "speaking"
  | "listening"
  | "thinking";
export type ExaminerMotionViseme = "rest" | "open" | "wide" | "round";

export interface ExaminerMotionSnapshot {
  activity: ExaminerMotionActivity;
  audioLevel: number;
  mouthBlendValue: number;
  viseme: ExaminerMotionViseme;
  resolvedVoice: string;
  fps: number;
  droppedFrameEstimate: number;
  activeAnimationLoopCount: number;
  activeAudioContextCount: number;
  lastStateTransition: string;
}
type AnimationTask = (now: number, deltaMs: number) => void;

const tasks = new Set<AnimationTask>();
let animationFrame = 0;
let previousFrame = 0;
let audioContextCount = 0;
let sharedFps = 60;
let droppedFrames = 0;

function runFrame(now: number) {
  const deltaMs = previousFrame ? Math.min(100, now - previousFrame) : 16.7;
  previousFrame = now;
  const instantaneous = 1000 / Math.max(1, deltaMs);
  sharedFps += (instantaneous - sharedFps) * 0.08;
  if (deltaMs > 34) droppedFrames += Math.max(1, Math.round(deltaMs / 16.7) - 1);
  for (const task of tasks) task(now, deltaMs);
  if (tasks.size) animationFrame = requestAnimationFrame(runFrame);
  else {
    animationFrame = 0;
    previousFrame = 0;
  }
}

export function registerAnimationTask(task: AnimationTask) {
  tasks.add(task);
  if (!animationFrame && typeof requestAnimationFrame !== "undefined") {
    animationFrame = requestAnimationFrame(runFrame);
  }
  return () => {
    tasks.delete(task);
    if (!tasks.size && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      previousFrame = 0;
    }
  };
}

export function registerAudioContext() {
  audioContextCount += 1;
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    audioContextCount = Math.max(0, audioContextCount - 1);
  };
}

export class ExaminerMotionController {
  private activity: ExaminerMotionActivity = "idle";
  private targetAudioLevel = 0;
  private mouthBlendValue = 0;
  private viseme: ExaminerMotionViseme = "rest";
  private resolvedVoice = "—";
  private lastStateTransition = new Date().toISOString();

  setActivity(activity: ExaminerMotionActivity) {
    if (this.activity === activity) return;
    this.activity = activity;
    if (activity !== "speaking") {
      this.targetAudioLevel = 0;
      this.viseme = "rest";
    }
    this.lastStateTransition = new Date().toISOString();
  }

  getActivity() {
    return this.activity;
  }

  setAudioLevel(level: number) {
    this.targetAudioLevel =
      this.activity === "speaking"
        ? Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0))
        : 0;
  }

  getAudioLevel() {
    return this.targetAudioLevel;
  }

  setMouthBlend(value: number) {
    this.mouthBlendValue = Math.max(0, Math.min(1, value));
  }

  getMouthBlend() {
    return this.mouthBlendValue;
  }

  setViseme(viseme: ExaminerMotionViseme) {
    this.viseme = this.activity === "speaking" ? viseme : "rest";
  }

  getViseme() {
    return this.viseme;
  }

  setResolvedVoice(value: string) {
    this.resolvedVoice = value || "—";
  }

  snapshot(): ExaminerMotionSnapshot {
    return {
      activity: this.activity,
      audioLevel: this.targetAudioLevel,
      mouthBlendValue: this.mouthBlendValue,
      viseme: this.viseme,
      resolvedVoice: this.resolvedVoice,
      fps: Math.round(sharedFps),
      droppedFrameEstimate: droppedFrames,
      activeAnimationLoopCount: animationFrame ? 1 : 0,
      activeAudioContextCount: audioContextCount,
      lastStateTransition: this.lastStateTransition,
    };
  }
}

export function createExaminerMotionController() {
  return new ExaminerMotionController();
}
