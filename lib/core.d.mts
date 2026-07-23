export type ExamState =
  | "SETUP"
  | "INTRODUCTION"
  | "PART1"
  | "PART2_INSTRUCTIONS"
  | "PART2_PREPARATION"
  | "PART2_SPEAKING"
  | "PART2_FOLLOW_UP"
  | "PART3"
  | "FINISHED"
  | "ANALYSING"
  | "RESULTS";

export interface Question {
  id: string;
  part: 1 | 3;
  mainTopic: string;
  subTopic: string;
  question: string;
  difficulty: string;
  followUpRules: string[];
  relatedPart2Topic: string | null;
  relatedPart3Themes: string[];
  sourceType: string;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
}

export interface Part1Topic {
  id: string;
  topic: string;
  label: string;
  questions: Question[];
}

export interface Part2Set {
  id: string;
  part: 2;
  mainTopic: string;
  subTopic: string;
  title: string;
  bullets: string[];
  explain: string;
  closingQuestions: string[];
  relatedPart3Themes: string[];
  difficulty: string;
  sourceType: string;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
  part3Questions: Question[];
}

export interface ExamPlan {
  comboId: string;
  createdAt: string;
  part1: Part1Topic[];
  part2: Part2Set;
  part3: Question[];
}

export type ExaminerAccent = "en-GB" | "en-US" | "en-AU" | "en-IN";
export type ExaminerVoiceId =
  | "gb-female"
  | "gb-male"
  | "us-female"
  | "us-male"
  | "au-female"
  | "au-male"
  | "in-female"
  | "in-male";
export type ExaminerGenderPresentation = "female" | "male";

export interface ExaminerVoicePreset {
  id: ExaminerVoiceId;
  label: string;
  provider: "adaptive";
  voiceId: ExaminerVoiceId;
  accent: ExaminerAccent;
  locale: ExaminerAccent;
  genderPresentation: ExaminerGenderPresentation;
  verifiedGenderPresentation: ExaminerGenderPresentation | null;
  speakingRate: number;
  pitch: number;
  volume: number;
  qualityLevel: "high" | "unverified";
  qualityStatus:
    | "verified"
    | "disabled-unverified-gender"
    | "disabled-unverified-accent"
    | "disabled-unverified-gender-accent"
    | "disabled-quality"
    | "disabled-quality-and-gender";
  enabled: boolean;
  supportedModes: ("mock-exam" | "practice")[];
  fallbackVoiceId: ExaminerVoiceId;
  baseWeight: number;
}

export interface ExaminerAvatarDefinition {
  id: string;
  displayName: string;
  appearanceProfile: string;
  genderPresentation: ExaminerGenderPresentation;
  estimatedAgeRange: string;
  appearanceCategory: string;
  spriteRow: number;
  enabled: boolean;
}

export interface ExaminerProfile {
  id: string;
  sessionId: string;
  displayName: string;
  avatarId: string;
  appearanceProfile: string;
  voiceProvider: "adaptive";
  requestedVoiceId: ExaminerVoiceId;
  voiceId: ExaminerVoiceId;
  accent: ExaminerAccent;
  locale: ExaminerAccent;
  genderPresentation: ExaminerGenderPresentation;
  verifiedGenderPresentation: ExaminerGenderPresentation;
  estimatedAgeRange: string;
  speakingRate: number;
  pitch: number;
  volume: number;
  qualityLevel: "high" | "unverified";
  qualityStatus: ExaminerVoicePreset["qualityStatus"];
  enabled: boolean;
  supportedModes: ("mock-exam" | "practice")[];
  fallbackVoiceId: ExaminerVoiceId;
  selectedAt: string;
  fallbackReason: string | null;
  locked: true;
  createdAt: string;
}

export interface SpeechSegmentInput {
  text?: string;
  durationSec?: number;
  part?: number;
  longPauses?: number;
}

export interface SpeechMetrics {
  wordCount: number;
  totalSpeakingSeconds: number;
  wordsPerMinute: number;
  averageAnswerWords: number;
  longPauses: number;
  fillers: { word: string; count: number }[];
  fillerCount: number;
  repeatedWords: { word: string; count: number }[];
  selfCorrections: number;
  part2SpeakingSeconds: number;
  lexicalDiversity: number;
}

export interface ScoreDimension {
  key: string;
  label: string;
  band: number;
  range: number[];
  confidence: "low" | "medium" | "high";
  explanation: string;
  evidence: string[];
  priority: string;
}

export interface ScoreReport {
  overall: number;
  range: number[];
  dimensions: ScoreDimension[];
  mode: string;
  generatedAt: string;
}

export const EXAM_STATES: ExamState[];
export const INTRODUCTION_QUESTIONS: string[];
export const PART1_TOPICS: Part1Topic[];
export const PART2_SETS: Part2Set[];
export const EXAMINER_VOICE_PRESETS: ExaminerVoicePreset[];
export const EXAMINER_AVATARS: ExaminerAvatarDefinition[];
export function transitionExam(state: ExamState, event: string): ExamState;
export function createExamPlan(options?: {
  seed?: string | number;
  recentTopicIds?: string[];
}): ExamPlan;
export function createExaminerProfile(options?: {
  seed?: string | number;
  availableVoiceIds?: ExaminerVoiceId[];
  recentProfileIds?: string[];
  recentAccents?: ExaminerAccent[];
  randomEnabled?: boolean;
  accentMode?: "all" | "familiar" | "british";
  fixedVoiceId?: ExaminerVoiceId;
  excludedAccents?: ExaminerAccent[];
  forcedAccent?: ExaminerAccent | null;
  avoidAccent?: ExaminerAccent | null;
}): ExaminerProfile;
export function formatTime(totalSeconds: number): string;
export function nextCountdown(seconds: number): number;
export function timerReachedLimit(
  elapsedSeconds: number,
  limitSeconds: number,
): boolean;
export function calculateSpeechMetrics(
  segments?: SpeechSegmentInput[],
): SpeechMetrics;
export function estimateMockScores(metrics: SpeechMetrics): ScoreReport;
export function buildPracticeFeedback(
  text?: string,
  durationSec?: number,
  part?: 1 | 2 | 3,
): {
  band: number;
  tooShort: boolean;
  wordCount: number;
  durationSec: number;
  strengths: string[];
  focus: string;
  naturalExpression: string;
  improvedAnswer: string;
};
export function movingAverage(values: number[], windowSize?: number): number[];
export function prependHistoryRecord<T extends { id: string }>(
  records: T[],
  record: T,
  limit?: number,
): T[];
export function providerErrorStatus(status: number): string;
export function microphoneErrorMessage(name: string): string;
