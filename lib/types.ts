import type {
  ExamPlan,
  ExaminerAccent,
  ExaminerProfile,
  ExaminerVoiceId,
  ExamState,
  ScoreReport,
  SpeechMetrics,
} from "./core.mjs";

export type Screen =
  | "home"
  | "onboarding"
  | "setup"
  | "exam"
  | "practice"
  | "history"
  | "history-detail"
  | "expressions"
  | "trends"
  | "settings"
  | "results";
export type ProviderMode = "mock" | "openai";
export type Accent = ExaminerAccent;

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
  practiceVoiceId: ExaminerVoiceId;
  randomExaminer: boolean;
  randomAccentMode: "all" | "familiar" | "british";
  excludedAccents: Accent[];
  onboarded: boolean;
}

export interface CapturedSegment {
  id: string;
  part: 0 | 1 | 2 | 3;
  question: string;
  text: string;
  startedAt: string;
  endedAt?: string;
  durationSec: number;
  longPauses: number;
  transcriptConfidence?: "low" | "medium" | "high";
  transcriptSource?: "browser" | "openai" | "missing";
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
  scoringProvider?: "openai";
  scoringModel?: string;
  scoringGeneratedAt?: string;
  scoringRequestId?: string;
  scoringDiagnosticId?: string;
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
  reportVersion?: number;
  reportComplete?: boolean;
  scoringProvider?: ProviderMode;
  scoringModel?: string;
  scoredAt?: string;
  reanalysisCount?: number;
  selfRating?: number;
  examinerProfileId?: string;
  examinerDisplayName?: string;
  examinerAccent?: Accent;
  examinerVoiceId?: ExaminerVoiceId;
  examinerAvatarId?: string;
  accentEase?: "easy" | "manageable" | "challenging";
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
  examinerProfile?: ExaminerProfile;
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
  practiceVoiceId: "gb-female",
  randomExaminer: true,
  randomAccentMode: "all",
  excludedAccents: [],
  onboarded: false,
};
