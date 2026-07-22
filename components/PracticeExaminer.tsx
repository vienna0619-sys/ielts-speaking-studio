"use client";

import type { SpeechViseme } from "@/lib/browser-audio";
import { ExaminerAvatar, type ExaminerActivity } from "./ExaminerAvatar";

/** Cartoon learning coach used only in daily practice. */
export function PracticeExaminer({ activity, speechLevel, viseme, compact }: {
  activity: ExaminerActivity;
  speechLevel: number;
  viseme: SpeechViseme;
  compact?: boolean;
}) {
  return (
    <ExaminerAvatar
      activity={activity}
      speechLevel={speechLevel}
      viseme={viseme}
      compact={compact}
      avatarId="avery"
      displayName="Practice Coach Avery"
    />
  );
}
