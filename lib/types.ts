import type { ExamPlan, ExamState, ScoreReport, SpeechMetrics } from "./core.mjs";

export type Screen = "home" | "onboarding" | "setup" | "exam" | "practice" | "history" | "trends" | "settings" | "results";
export type ProviderMode = "mock" | "openai";
export type Accent = "en-GB" | "en-US" | "en-AU";

export interface UserSettings {
  displayName: string;
  targetBand: number;
  examDate: string;
  accent: Accent;
  saveRecordings: boolean;
  liveTranscript: boolean;
  provider: ProviderMode;
  theme: "light" | "dark" | "system";
  speechRate: number;
  onboarded: boolean;
}

export interface CapturedSegment {
  id: string;
  part: 0 | 1 | 2 | 3;
  question: string;
  text: string;
  startedAt: string;
  durationSec: number;
  longPauses: number;
  blob?: Blob;
  audioUrl?: string;
}

export interface Correction {
  original: string;
  suggestion: string;
  type: string;
  explanationZh: string;
  naturalVersion: string;
  affectsUnderstanding: boolean;
  dimension: string;
  practice: string;
  certainty: "error" | "acceptable" | "upgrade" | "style";
}

export interface AnalysisReport extends ScoreReport {
  metrics: SpeechMetrics;
  corrections: Correction[];
  bestPoints: string[];
  priorities: string[];
  nextGoal: string;
  recommendedPart: string;
  recommendedTopic: string;
  expressions: string[];
  drill: string;
  improvedAnswers: { part: number; answer: string; phrases: string[] }[];
  provider: ProviderMode;
  disclaimer: string;
}

export interface HistoryRecord {
  id: string;
  date: string;
  mode: "mock-exam" | "practice";
  title: string;
  comboId?: string;
  topics: string[];
  recordingSaved: boolean;
  segments: Omit<CapturedSegment, "blob" | "audioUrl">[];
  overall: number;
  dimensions: { key: string; label: string; band: number }[];
  mainErrors: string[];
  durationSec: number;
  retried: boolean;
  selfRating?: number;
}

export interface ExamCheckpoint {
  id: string;
  savedAt: string;
  state: ExamState;
  plan: ExamPlan;
  questionIndex: number;
  segments: Omit<CapturedSegment, "blob" | "audioUrl">[];
  notes: string;
  elapsedSec: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  displayName: "",
  targetBand: 6.5,
  examDate: "",
  accent: "en-GB",
  saveRecordings: false,
  liveTranscript: true,
  provider: "mock",
  theme: "system",
  speechRate: 1,
  onboarded: false,
};
