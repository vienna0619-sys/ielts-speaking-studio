"use client";

/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/preserve-manual-memoization */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  INTRODUCTION_QUESTIONS,
  EXAMINER_VOICE_PRESETS,
  PART1_TOPICS,
  PART2_SETS,
  buildPracticeFeedback,
  calculateSpeechMetrics,
  createExamPlan,
  createExaminerProfile,
  estimateMockScores,
  formatTime,
  movingAverage,
  nextCountdown,
  prependHistoryRecord,
  providerErrorStatus,
  timerReachedLimit,
  transitionExam,
  type ExamPlan,
  type ExaminerAccent,
  type ExaminerProfile,
  type ExaminerVoiceId,
  type ExamState,
  type Part2Set,
} from "@/lib/core.mjs";
import {
  DEFAULT_SETTINGS,
  type AnalysisReport,
  type CapturedSegment,
  type ExamCheckpoint,
  type HistoryRecord,
  type Screen,
  type UserSettings,
} from "@/lib/types";
import {
  clearCheckpoint,
  deleteRecordAudio,
  loadAudioBlob,
  loadCheckpoint,
  loadHistory,
  loadRecentTopicIds,
  loadRecentExaminerUsage,
  loadSettings,
  saveAudioBlob,
  saveCheckpoint,
  saveHistory,
  saveRecentTopicIds,
  saveRecentExaminerUsage,
  saveSettings,
} from "@/lib/storage";
import {
  createMicrophoneSession,
  speakExaminer,
  startRecording,
  stopExaminerSpeech,
  transcribeWithProvider,
  type MicrophoneSession,
  type RecordingController,
  type SpeechViseme,
} from "@/lib/browser-audio";
import {
  ACCENT_LABELS,
  VOICE_SAMPLE_TEXT,
  getVoicePreset,
  observeBrowserVoiceOptions,
  type BrowserVoiceOption,
} from "@/lib/examiner-voices";
import {
  AudioMeter,
  ExaminerAvatar,
  type ExaminerActivity,
} from "./ExaminerAvatar";
import { Icon, type IconName } from "./Icons";
import { VoiceSettings } from "./VoiceSettings";

const DISCLAIMER =
  "本结果由AI根据公开的IELTS评分标准估算，仅供练习参考，不是官方雅思成绩，也不能保证与真人考官评分完全一致。";
const SESSION_NOW = Date.now();
const ALL_VOICE_IDS = EXAMINER_VOICE_PRESETS.map((voice) => voice.id);
const DEFAULT_EXAMINER_PROFILE = createExaminerProfile({
  seed: "default-examiner",
  randomEnabled: false,
  fixedVoiceId: "gb-female",
});

type MicStatus = "unchecked" | "checking" | "ready" | "error";
type PracticePhase = "idle" | "preparing" | "speaking" | "feedback";

interface RecordingContext {
  kind: "exam" | "practice";
  question: string;
  part: 0 | 1 | 2 | 3;
  accent: ExaminerAccent;
  examState?: ExamState;
  questionIndex?: number;
}

function storedSegment(
  segment: CapturedSegment,
): Omit<CapturedSegment, "blob" | "audioUrl"> {
  return {
    id: segment.id,
    part: segment.part,
    question: segment.question,
    text: segment.text,
    startedAt: segment.startedAt,
    durationSec: segment.durationSec,
    longPauses: segment.longPauses,
  };
}

function mockAnalysis(
  segments: CapturedSegment[],
  plan: ExamPlan,
): AnalysisReport {
  const metrics = calculateSpeechMetrics(segments);
  const scores = estimateMockScores(metrics);
  const firstSpoken = segments.find((segment) => segment.text.trim());
  const corrections = firstSpoken
    ? [
        {
          original: firstSpoken.text,
          suggestion: "保留原意，再补充一个明确原因和具体细节。",
          type: "insufficient development",
          explanationZh:
            "这不一定是语法错误；在口语评分中，观点是否得到充分展开也会影响连贯性。",
          naturalVersion: `${firstSpoken.text.replace(/[.?!]+$/, "")} One reason for this is that it has a direct effect on my daily life.`,
          affectsUnderstanding: false,
          dimension: "Fluency and Coherence",
          practice: "用 30 秒重复回答同一题，每次只增加一个原因和一个小例子。",
          certainty: "upgrade" as const,
        },
      ]
    : [];
  const improvedAnswers = [1, 2, 3].map((part) => {
    const source = segments.find(
      (segment) => segment.part === part && segment.text.trim(),
    );
    return {
      part,
      answer: source
        ? `${source.text.replace(/[.?!]+$/, "")} What makes this especially important is the effect it has in a real situation, rather than just in theory.`
        : "No reliable transcript was available for this part. Record another answer in Chrome to generate a meaning-preserving improved version.",
      phrases: [
        "What makes this especially important is...",
        "rather than just in theory",
      ],
    };
  });
  return {
    ...scores,
    metrics,
    corrections,
    bestPoints: [
      metrics.totalSpeakingSeconds
        ? `完成了约 ${metrics.totalSpeakingSeconds} 秒有效作答`
        : "完成了完整考试流程",
      metrics.wordCount
        ? `浏览器成功识别约 ${metrics.wordCount} 个英语词`
        : "在没有云端 API 的情况下完成录音",
      "Part 2 与 Part 3 保持同一主题链条",
    ],
    priorities: [
      metrics.longPauses > 3
        ? "减少超过 1.5 秒的无信息停顿"
        : "继续保持自然意群停顿",
      metrics.averageAnswerWords < 25
        ? "把短回答扩展为观点、原因和例子"
        : "提高观点之间的逻辑衔接",
      "录音回听句子重音和结尾音；Mock 发音判断仅为低置信度",
    ],
    nextGoal: "下一次只专注于：每个观点后补一个具体原因。",
    recommendedPart: metrics.part2SpeakingSeconds < 80 ? "Part 2" : "Part 3",
    recommendedTopic: plan.part2.mainTopic,
    expressions: [
      "One reason I feel this way is that...",
      "A good example would be...",
      "It depends to some extent on...",
      "Compared with the past,...",
      "What matters most to me is...",
    ],
    drill:
      "12分钟训练：2分钟列关键词；用45秒回答同一题两次；回听并标出停顿；最后用90秒重答，只改进一个核心问题。",
    improvedAnswers,
    provider: "mock",
    disclaimer: DISCLAIMER,
  };
}

function partProgress(state: ExamState) {
  if (state === "INTRODUCTION") return { part: "Introduction", progress: 6 };
  if (state === "PART1") return { part: "Part 1", progress: 28 };
  if (state.startsWith("PART2"))
    return { part: "Part 2", progress: state === "PART2_FOLLOW_UP" ? 66 : 50 };
  if (state === "PART3") return { part: "Part 3", progress: 82 };
  if (["FINISHED", "ANALYSING", "RESULTS"].includes(state))
    return { part: "Complete", progress: 100 };
  return { part: "Setup", progress: 0 };
}

function TrendLine({ values }: { values: number[] }) {
  if (!values.length)
    return <div className="empty-chart">完成至少一次练习后显示估算趋势</div>;
  const width = 560;
  const height = 180;
  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? width / 2
        : 20 + (index / (values.length - 1)) * (width - 40);
    const y = height - 20 - ((value - 3) / 6) * (height - 40);
    return `${x},${Math.max(15, Math.min(height - 15, y))}`;
  });
  return (
    <svg
      className="trend-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="最近成绩移动平均趋势"
    >
      {[4, 5, 6, 7, 8].map((band) => {
        const y = height - 20 - ((band - 3) / 6) * (height - 40);
        return (
          <g key={band}>
            <line x1="20" x2={width - 20} y1={y} y2={y} />
            <text x="1" y={y + 4}>
              {band}
            </text>
          </g>
        );
      })}
      <polyline points={points.join(" ")} />
      {points.map((point, index) => {
        const [cx, cy] = point.split(",");
        return <circle key={index} cx={cx} cy={cy} r="4" />;
      })}
    </svg>
  );
}

function ScoreBars({ report }: { report: AnalysisReport }) {
  return (
    <div className="score-bars">
      {report.dimensions.map((dimension) => (
        <div className="score-row" key={dimension.key}>
          <div>
            <span>{dimension.label}</span>
            <strong>{dimension.band.toFixed(1)}</strong>
          </div>
          <div className="bar-track">
            <span style={{ width: `${(dimension.band / 9) * 100}%` }} />
          </div>
          <small>
            区间 {dimension.range[0].toFixed(1)}–{dimension.range[1].toFixed(1)}{" "}
            · {dimension.confidence === "low" ? "低置信度" : "中等置信度"}
          </small>
        </div>
      ))}
    </div>
  );
}

export default function SpeakingStudio() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [settings, setSettingsState] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [checkpoint, setCheckpoint] = useState<ExamCheckpoint | null>(null);
  const [micStatus, setMicStatus] = useState<MicStatus>("unchecked");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(true);
  const [providerReady, setProviderReady] = useState<boolean | null>(null);
  const [voiceOptions, setVoiceOptions] = useState<BrowserVoiceOption[]>([]);
  const [previewingVoiceId, setPreviewingVoiceId] =
    useState<ExaminerVoiceId | null>(null);

  const [examState, setExamState] = useState<ExamState>("SETUP");
  const [plan, setPlan] = useState<ExamPlan>(() =>
    createExamPlan({ seed: "initial" }),
  );
  const [examinerProfile, setExaminerProfile] = useState<ExaminerProfile>(
    DEFAULT_EXAMINER_PROFILE,
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [segments, setSegments] = useState<CapturedSegment[]>([]);
  const [notes, setNotes] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [prepRemaining, setPrepRemaining] = useState(60);
  const [speakingElapsed, setSpeakingElapsed] = useState(0);
  const [examinerActivity, setExaminerActivity] =
    useState<ExaminerActivity>("idle");
  const [examinerSpeechLevel, setExaminerSpeechLevel] = useState(0);
  const [examinerViseme, setExaminerViseme] = useState<SpeechViseme>("rest");
  const [recording, setRecording] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [instructionReady, setInstructionReady] = useState(false);
  const [earlyWarning, setEarlyWarning] = useState(false);
  const [longSilence, setLongSilence] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(
    null,
  );
  const [analysisError, setAnalysisError] = useState("");
  const [accentEase, setAccentEase] = useState<HistoryRecord["accentEase"]>();

  const [practicePart, setPracticePart] = useState<1 | 2 | 3>(1);
  const [practiceMode, setPracticeMode] = useState("单项练习");
  const [practiceTopicId, setPracticeTopicId] = useState(PART1_TOPICS[0].id);
  const [practicePart2Id, setPracticePart2Id] = useState(PART2_SETS[0].id);
  const [practiceQuestionIndex, setPracticeQuestionIndex] = useState(0);
  const [practicePhase, setPracticePhase] = useState<PracticePhase>("idle");
  const [practiceRemaining, setPracticeRemaining] = useState(60);
  const [practiceDuration, setPracticeDuration] = useState(120);
  const [practiceElapsed, setPracticeElapsed] = useState(0);
  const [practiceNotes, setPracticeNotes] = useState("");
  const [practiceFeedback, setPracticeFeedback] = useState<ReturnType<
    typeof buildPracticeFeedback
  > | null>(null);
  const [strictPractice, setStrictPractice] = useState(false);

  const micRef = useRef<MicrophoneSession | null>(null);
  const recorderRef = useRef<RecordingController | null>(null);
  const recordingContextRef = useRef<RecordingContext | null>(null);
  const spokenKeyRef = useRef("");
  const analysisRunRef = useRef("");
  const longPauseCountRef = useRef(0);
  const silenceStartRef = useRef<number | null>(null);
  const silenceCountedRef = useRef(false);
  const segmentsRef = useRef<CapturedSegment[]>([]);
  const storedPlaybackRef = useRef<{
    audio: HTMLAudioElement;
    objectUrl?: string;
  } | null>(null);

  const setSettings = useCallback(
    (next: UserSettings | ((current: UserSettings) => UserSettings)) => {
      setSettingsState((current) => {
        const value = typeof next === "function" ? next(current) : next;
        saveSettings(value);
        return value;
      });
    },
    [],
  );

  useEffect(() => {
    const storedSettings = loadSettings();
    setSettingsState(storedSettings);
    setHistory(loadHistory());
    setCheckpoint(loadCheckpoint());
    setOnline(navigator.onLine);
    if (!storedSettings.onboarded) setScreen("onboarding");
    if ("serviceWorker" in navigator) {
      const serviceWorkerUrl = new URL("sw.js", document.baseURI);
      void navigator.serviceWorker
        .register(serviceWorkerUrl.pathname)
        .catch(() => undefined);
    }
    setReady(true);
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    const stopVoiceObserver = observeBrowserVoiceOptions(setVoiceOptions);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      stopVoiceObserver();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(
    () => () => {
      micRef.current?.stop();
      stopExaminerSpeech();
      storedPlaybackRef.current?.audio.pause();
      if (storedPlaybackRef.current?.objectUrl)
        URL.revokeObjectURL(storedPlaybackRef.current.objectUrl);
      segmentsRef.current.forEach(
        (segment) => segment.audioUrl && URL.revokeObjectURL(segment.audioUrl),
      );
    },
    [],
  );

  useEffect(() => {
    if (!recording) {
      silenceStartRef.current = null;
      silenceCountedRef.current = false;
      setLongSilence(false);
      return;
    }
    if (level < 0.035) {
      if (!silenceStartRef.current) silenceStartRef.current = Date.now();
      if (
        !silenceCountedRef.current &&
        Date.now() - silenceStartRef.current > 1500
      ) {
        longPauseCountRef.current += 1;
        silenceCountedRef.current = true;
      }
      if (
        silenceStartRef.current &&
        Date.now() - silenceStartRef.current > 12000
      )
        setLongSilence(true);
    } else {
      silenceStartRef.current = null;
      silenceCountedRef.current = false;
      setLongSilence(false);
    }
  }, [level, recording]);

  useEffect(() => {
    if (
      screen !== "exam" ||
      ["SETUP", "ANALYSING", "RESULTS"].includes(examState)
    )
      return;
    const timer = window.setInterval(
      () => setElapsedSec((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [screen, examState]);

  useEffect(() => {
    if (screen !== "exam" || examState !== "PART2_PREPARATION") return;
    if (prepRemaining <= 0) {
      setQuestionIndex(0);
      setExamState(transitionExam("PART2_PREPARATION", "PREPARATION_COMPLETE"));
      return;
    }
    const timer = window.setTimeout(
      () => setPrepRemaining(nextCountdown),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [screen, examState, prepRemaining]);

  useEffect(() => {
    if (screen !== "exam" || examState !== "PART2_SPEAKING" || !recording)
      return;
    if (timerReachedLimit(speakingElapsed, 120)) {
      void stopCurrentRecording();
      return;
    }
    const timer = window.setTimeout(
      () => setSpeakingElapsed((value) => value + 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [screen, examState, recording, speakingElapsed]);

  useEffect(() => {
    if (screen !== "practice" || practicePhase !== "preparing") return;
    if (practiceRemaining <= 0) {
      void beginPracticeSpeaking();
      return;
    }
    const timer = window.setTimeout(
      () => setPracticeRemaining(nextCountdown),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [screen, practicePhase, practiceRemaining]);

  useEffect(() => {
    if (screen !== "practice" || practicePhase !== "speaking" || !recording)
      return;
    if (timerReachedLimit(practiceElapsed, practiceDuration)) {
      void stopCurrentRecording();
      return;
    }
    const timer = window.setTimeout(
      () => setPracticeElapsed((value) => value + 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [screen, practicePhase, recording, practiceElapsed, practiceDuration]);

  useEffect(() => {
    if (screen !== "exam" || examState === "SETUP" || examState === "RESULTS")
      return;
    const serializableSegments = segments.map(storedSegment);
    const saved: ExamCheckpoint = {
      id: plan.comboId,
      savedAt: new Date().toISOString(),
      state: examState,
      plan,
      questionIndex,
      segments: serializableSegments,
      notes,
      elapsedSec,
      examinerProfile,
    };
    saveCheckpoint(saved);
    setCheckpoint(saved);
  }, [
    screen,
    examState,
    plan,
    questionIndex,
    segments,
    notes,
    elapsedSec,
    examinerProfile,
  ]);

  const ensureMic = useCallback(async () => {
    if (micRef.current) {
      setMicStatus("ready");
      return true;
    }
    setMicStatus("checking");
    setError("");
    try {
      micRef.current = await createMicrophoneSession(setLevel);
      setMicStatus("ready");
      return true;
    } catch (micError) {
      setMicStatus("error");
      setError(
        micError instanceof Error ? micError.message : "无法访问麦克风。 ",
      );
      return false;
    }
  }, []);

  const releaseMic = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    setMicStatus("unchecked");
    setLevel(0);
  }, []);

  const stopStoredPlayback = useCallback(() => {
    const current = storedPlaybackRef.current;
    storedPlaybackRef.current = null;
    if (!current) return;
    current.audio.pause();
    current.audio.currentTime = 0;
    if (current.objectUrl) URL.revokeObjectURL(current.objectUrl);
  }, []);

  useEffect(() => {
    stopExaminerSpeech();
    stopStoredPlayback();
    setExaminerSpeechLevel(0);
    setExaminerViseme("rest");
    if (!recording) setExaminerActivity("idle");
  }, [screen, stopStoredPlayback]);

  const practiceProfile = useMemo(
    () =>
      createExaminerProfile({
        seed: `practice:${settings.practiceVoiceId}`,
        availableVoiceIds: ALL_VOICE_IDS,
        randomEnabled: false,
        fixedVoiceId: settings.practiceVoiceId,
      }),
    [settings.practiceVoiceId],
  );

  const availableExamVoiceIds = useMemo<ExaminerVoiceId[]>(() => {
    if (settings.provider === "openai") return ALL_VOICE_IDS;
    const highQuality = voiceOptions
      .filter((option) => option.available && option.quality === "high")
      .map((option) => option.id);
    if (highQuality.length) return highQuality;
    const exactLocale = voiceOptions
      .filter((option) => option.available)
      .map((option) => option.id);
    return exactLocale.length ? exactLocale : ["gb-female"];
  }, [settings.provider, voiceOptions]);

  const selectPracticeVoice = useCallback(
    (voiceId: ExaminerVoiceId) => {
      stopExaminerSpeech();
      setExaminerSpeechLevel(0);
      setExaminerViseme("rest");
      setExaminerActivity("idle");
      const preset = getVoicePreset(voiceId);
      setSettings((current) => ({
        ...current,
        practiceVoiceId: voiceId,
        accent: preset.accent,
      }));
    },
    [setSettings],
  );

  const toggleExcludedAccent = useCallback(
    (accent: ExaminerAccent) => {
      setSettings((current) => {
        const excluded = current.excludedAccents.includes(accent)
          ? current.excludedAccents.filter((item) => item !== accent)
          : [...current.excludedAccents, accent];
        return { ...current, excludedAccents: excluded };
      });
    },
    [setSettings],
  );

  const speak = useCallback(
    async (text: string, profile: ExaminerProfile) => {
      setError("");
      stopStoredPlayback();
      try {
        await speakExaminer(text, {
          provider: settings.provider,
          accent: profile.accent,
          voiceId: profile.voiceId,
          rate: screen === "exam" ? profile.speakingRate : settings.speechRate,
          pitch: profile.pitch,
          volume: profile.volume,
          onState: (state) =>
            setExaminerActivity(
              state === "speaking"
                ? "speaking"
                : state === "thinking"
                  ? "thinking"
                  : "idle",
            ),
          onLevel: setExaminerSpeechLevel,
          onViseme: setExaminerViseme,
          onFallback: (message) => setNotice(message),
        });
      } catch (speechError) {
        const message =
          speechError instanceof Error ? speechError.message : "语音播放失败。";
        setError(message);
        throw speechError;
      }
    },
    [screen, settings.provider, settings.speechRate, stopStoredPlayback],
  );

  const testSpeaker = useCallback(
    async (profile: ExaminerProfile = practiceProfile) => {
      setNotice("");
      try {
        await speak(VOICE_SAMPLE_TEXT, profile);
        setNotice("扬声器测试完成");
      } catch {
        // The visible error is set by speak().
      }
    },
    [practiceProfile, speak],
  );

  const previewVoice = useCallback(
    async (voiceId: ExaminerVoiceId) => {
      const profile = createExaminerProfile({
        seed: `preview:${voiceId}`,
        availableVoiceIds: ALL_VOICE_IDS,
        randomEnabled: false,
        fixedVoiceId: voiceId,
      });
      setPreviewingVoiceId(voiceId);
      setNotice("");
      try {
        await speak(VOICE_SAMPLE_TEXT, profile);
      } catch {
        // speak() already exposes the error.
      } finally {
        setPreviewingVoiceId((current) =>
          current === voiceId ? null : current,
        );
      }
    },
    [speak],
  );

  const checkProvider = useCallback(async () => {
    if (!online) {
      setProviderReady(false);
      setError("当前网络已断开。Mock 模式仍可使用浏览器本地语音。 ");
      return;
    }
    if (settings.provider === "mock") {
      setProviderReady(true);
      setNotice("Mock 服务可用：语音和评分在本地演示");
      return;
    }
    try {
      const response = await fetch("/api/ai", { cache: "no-store" });
      const data = (await response.json()) as { configured?: boolean };
      setProviderReady(Boolean(response.ok && data.configured));
      if (!data.configured)
        setError(
          "服务端尚未配置 OPENAI_API_KEY。可在设置中切换到 Mock 模式。 ",
        );
      else setNotice("OpenAI 服务端配置已就绪");
    } catch {
      setProviderReady(false);
      setError("无法连接 AI 服务。当前考试状态会保留。 ");
    }
  }, [online, settings.provider]);

  const startAnswer = useCallback((context: RecordingContext) => {
    if (!micRef.current || recorderRef.current) return;
    stopExaminerSpeech();
    setExaminerSpeechLevel(0);
    setExaminerViseme("rest");
    setLiveText("");
    setEarlyWarning(false);
    setLongSilence(false);
    longPauseCountRef.current = 0;
    silenceStartRef.current = null;
    recordingContextRef.current = context;
    recorderRef.current = startRecording(
      micRef.current.stream,
      context.accent,
      (text) => setLiveText(text),
    );
    setRecording(true);
    setExaminerActivity("listening");
  }, []);

  const advanceExamAfterAnswer = useCallback(
    (state: ExamState, index: number) => {
      if (state === "INTRODUCTION") {
        setQuestionIndex(index + 1);
        return;
      }
      if (state === "PART1") {
        const total = plan.part1.reduce(
          (sum, topic) => sum + topic.questions.length,
          0,
        );
        if (index + 1 < total) setQuestionIndex(index + 1);
        else {
          setQuestionIndex(0);
          setExamState(transitionExam("PART1", "PART1_COMPLETE"));
        }
        return;
      }
      if (state === "PART2_SPEAKING") {
        setQuestionIndex(0);
        setExamState(transitionExam("PART2_SPEAKING", "SPEAKING_COMPLETE"));
        return;
      }
      if (state === "PART2_FOLLOW_UP") {
        if (index + 1 < Math.min(2, plan.part2.closingQuestions.length))
          setQuestionIndex(index + 1);
        else {
          setQuestionIndex(0);
          setExamState(transitionExam("PART2_FOLLOW_UP", "FOLLOW_UP_COMPLETE"));
        }
        return;
      }
      if (state === "PART3") {
        if (index + 1 < plan.part3.length) setQuestionIndex(index + 1);
        else {
          setQuestionIndex(0);
          setExamState(transitionExam("PART3", "PART3_COMPLETE"));
        }
      }
    },
    [plan],
  );

  const storePracticeHistory = useCallback(
    (
      segment: CapturedSegment,
      feedback: ReturnType<typeof buildPracticeFeedback>,
    ) => {
      const record: HistoryRecord = {
        id: `practice-${segment.id}`,
        date: new Date().toISOString(),
        mode: "practice",
        title: `Part ${segment.part} · ${segment.question.slice(0, 54)}`,
        topics: [practicePart === 1 ? practiceTopicId : practicePart2Id],
        recordingSaved: settings.saveRecordings,
        segments: [storedSegment(segment)],
        overall: feedback.band,
        dimensions: [
          { key: "fluency", label: "Fluency", band: feedback.band },
          {
            key: "lexical",
            label: "Vocabulary",
            band: Math.max(1, feedback.band - 0.5),
          },
          { key: "grammar", label: "Grammar", band: feedback.band },
          {
            key: "pronunciation",
            label: "Pronunciation",
            band: Math.max(1, feedback.band - 0.5),
          },
        ],
        mainErrors: [feedback.focus],
        durationSec: segment.durationSec,
        retried: practiceFeedback !== null,
        examinerProfileId: practiceProfile.id,
        examinerDisplayName: practiceProfile.displayName,
        examinerAccent: practiceProfile.accent,
        examinerVoiceId: practiceProfile.voiceId,
        examinerAvatarId: practiceProfile.avatarId,
      };
      setHistory((current) => {
        const next = prependHistoryRecord(current, record);
        saveHistory(next);
        return next;
      });
    },
    [
      practicePart,
      practiceTopicId,
      practicePart2Id,
      settings.saveRecordings,
      practiceFeedback,
      practiceProfile,
    ],
  );

  const stopCurrentRecording = useCallback(async () => {
    const controller = recorderRef.current;
    const context = recordingContextRef.current;
    if (!controller || !context || savingAnswer) return;
    setSavingAnswer(true);
    setRecording(false);
    recorderRef.current = null;
    try {
      const captured = await controller.stop();
      let text = captured.text;
      if (settings.provider === "openai") {
        try {
          text = await transcribeWithProvider(captured.blob);
        } catch (transcriptionError) {
          setError(
            transcriptionError instanceof Error
              ? transcriptionError.message
              : "云端转写失败。 ",
          );
          if (!text) text = "";
        }
      }
      const id = `${context.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const segment: CapturedSegment = {
        id,
        part: context.part,
        question: context.question,
        text,
        startedAt: new Date(
          Date.now() - captured.durationSec * 1000,
        ).toISOString(),
        durationSec: captured.durationSec,
        longPauses: longPauseCountRef.current,
        blob: captured.blob,
        audioUrl: URL.createObjectURL(captured.blob),
      };
      if (settings.saveRecordings) {
        try {
          await saveAudioBlob(id, captured.blob);
        } catch {
          setError(
            "录音无法写入本地数据库；本次页面内仍可回放，但刷新后不会保留。 ",
          );
        }
      }
      if (context.kind === "exam") {
        setSegments((current) => [...current, segment]);
        advanceExamAfterAnswer(context.examState!, context.questionIndex!);
      } else {
        const feedback = buildPracticeFeedback(
          text,
          captured.durationSec,
          context.part as 1 | 2 | 3,
        );
        setSegments((current) => [...current, segment]);
        setPracticeFeedback(feedback);
        setPracticePhase("feedback");
        storePracticeHistory(segment, feedback);
      }
      setLiveText(text);
    } catch (recordingError) {
      setError(
        recordingError instanceof Error
          ? recordingError.message
          : "录音处理失败。 ",
      );
    } finally {
      recordingContextRef.current = null;
      setSavingAnswer(false);
      setExaminerActivity("idle");
    }
  }, [
    savingAnswer,
    settings.provider,
    settings.saveRecordings,
    advanceExamAfterAnswer,
    storePracticeHistory,
  ]);

  const flatPart1Questions = useMemo(
    () => plan.part1.flatMap((topic) => topic.questions),
    [plan],
  );

  useEffect(() => {
    if (screen !== "exam" || recording || savingAnswer || !micRef.current)
      return;
    const key = `${plan.comboId}:${examState}:${questionIndex}`;
    if (spokenKeyRef.current === key) return;

    let text = "";
    let part: 0 | 1 | 2 | 3 = 0;
    let shouldRecord = false;
    let afterSpeech: (() => void) | undefined;
    if (examState === "INTRODUCTION") {
      text = INTRODUCTION_QUESTIONS[questionIndex] || "";
      shouldRecord = questionIndex < 3;
      afterSpeech =
        questionIndex === 3
          ? () => {
              setQuestionIndex(0);
              setExamState(transitionExam("INTRODUCTION", "INTRO_COMPLETE"));
            }
          : undefined;
    } else if (examState === "PART1") {
      text = flatPart1Questions[questionIndex]?.question || "";
      part = 1;
      shouldRecord = true;
    } else if (examState === "PART2_INSTRUCTIONS") {
      text =
        "Now I'm going to give you a topic and I'd like you to talk about it for one to two minutes. You have one minute to think about what you're going to say. You can make some notes if you wish.";
      afterSpeech = () => setInstructionReady(true);
    } else if (examState === "PART2_SPEAKING") {
      text =
        "All right. Remember, you have one to two minutes for this, so don't worry if I stop you. Please start speaking now.";
      part = 2;
      shouldRecord = true;
    } else if (examState === "PART2_FOLLOW_UP") {
      text = plan.part2.closingQuestions[questionIndex] || "";
      part = 2;
      shouldRecord = true;
    } else if (examState === "PART3") {
      text = plan.part3[questionIndex]?.question || "";
      part = 3;
      shouldRecord = true;
    } else if (examState === "FINISHED") {
      text = "Thank you. That is the end of the speaking test.";
      afterSpeech = () => setExamState(transitionExam("FINISHED", "ANALYSE"));
    }
    if (!text) return;
    spokenKeyRef.current = key;
    let cancelled = false;
    void speak(text, examinerProfile)
      .then(() => {
        if (cancelled) return;
        afterSpeech?.();
        if (shouldRecord)
          startAnswer({
            kind: "exam",
            question: text,
            part,
            accent: examinerProfile.accent,
            examState,
            questionIndex,
          });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    screen,
    examState,
    questionIndex,
    plan,
    flatPart1Questions,
    recording,
    savingAnswer,
    speak,
    startAnswer,
    examinerProfile,
  ]);

  const saveExamHistory = useCallback(
    (report: AnalysisReport) => {
      const record: HistoryRecord = {
        id: plan.comboId,
        date: new Date().toISOString(),
        mode: "mock-exam",
        title: `全真模拟 · ${plan.part2.mainTopic}`,
        comboId: plan.comboId,
        topics: [...plan.part1.map((topic) => topic.id), plan.part2.id],
        recordingSaved: settings.saveRecordings,
        segments: segments.map(storedSegment),
        overall: report.overall,
        dimensions: report.dimensions.map(({ key, label, band }) => ({
          key,
          label,
          band,
        })),
        mainErrors: report.priorities,
        durationSec: elapsedSec,
        retried: false,
        examinerProfileId: examinerProfile.id,
        examinerDisplayName: examinerProfile.displayName,
        examinerAccent: examinerProfile.accent,
        examinerVoiceId: examinerProfile.voiceId,
        examinerAvatarId: examinerProfile.avatarId,
      };
      setHistory((current) => {
        const next = prependHistoryRecord(current, record);
        saveHistory(next);
        return next;
      });
      saveRecentTopicIds([...record.topics, ...loadRecentTopicIds()]);
    },
    [plan, settings.saveRecordings, segments, elapsedSec, examinerProfile],
  );

  const analyseSession = useCallback(
    async (forceMock = false) => {
      const runKey = `${plan.comboId}:${forceMock ? "mock" : settings.provider}`;
      if (analysisRunRef.current === runKey) return;
      analysisRunRef.current = runKey;
      setAnalysisError("");
      try {
        let report: AnalysisReport;
        if (settings.provider === "openai" && !forceMock) {
          const metrics = calculateSpeechMetrics(segments);
          const response = await fetch("/api/ai", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              operation: "evaluate",
              payload: {
                examPlan: {
                  comboId: plan.comboId,
                  part1Topics: plan.part1.map((topic) => topic.topic),
                  part2Topic: plan.part2.mainTopic,
                  part3Themes: plan.part2.relatedPart3Themes,
                },
                segments: segments.map(storedSegment),
                metrics,
                note: "Pronunciation evidence is limited to timing and transcription reliability; mark phoneme claims low confidence.",
              },
            }),
          });
          if (!response.ok)
            throw new Error(providerErrorStatus(response.status));
          const cloud = (await response.json()) as Omit<
            AnalysisReport,
            "metrics" | "provider" | "disclaimer"
          >;
          report = {
            ...cloud,
            metrics,
            provider: "openai",
            disclaimer: DISCLAIMER,
          };
        } else {
          await new Promise((resolve) => window.setTimeout(resolve, 1100));
          report = mockAnalysis(segments, plan);
        }
        setAnalysisReport(report);
        saveExamHistory(report);
        clearCheckpoint();
        setCheckpoint(null);
        setExamState(transitionExam("ANALYSING", "ANALYSIS_COMPLETE"));
        setScreen("results");
      } catch (analysisFailure) {
        analysisRunRef.current = "";
        setAnalysisError(
          analysisFailure instanceof Error
            ? analysisFailure.message
            : "分析失败，考试内容已保留。 ",
        );
      }
    },
    [plan, settings.provider, segments, saveExamHistory],
  );

  useEffect(() => {
    if (screen === "exam" && examState === "ANALYSING") void analyseSession();
  }, [screen, examState, analyseSession]);

  const newExam = useCallback(
    (options?: {
      forcedAccent?: ExaminerAccent;
      avoidAccent?: ExaminerAccent;
    }) => {
      stopExaminerSpeech();
      stopStoredPlayback();
      const next = createExamPlan({
        seed: Date.now(),
        recentTopicIds: loadRecentTopicIds(),
      });
      const recent = loadRecentExaminerUsage();
      const profile = createExaminerProfile({
        seed: settings.randomExaminer
          ? next.comboId
          : `fixed:${settings.practiceVoiceId}`,
        availableVoiceIds: availableExamVoiceIds,
        recentProfileIds: recent.map((item) => item.profileId),
        recentAccents: recent.map((item) => item.accent),
        randomEnabled: settings.randomExaminer,
        accentMode: settings.randomAccentMode,
        fixedVoiceId: settings.practiceVoiceId,
        excludedAccents: settings.excludedAccents,
        forcedAccent: options?.forcedAccent ?? null,
        avoidAccent: options?.avoidAccent ?? null,
      });
      setPlan(next);
      setExaminerProfile(profile);
      setExamState("SETUP");
      setQuestionIndex(0);
      setSegments([]);
      setNotes("");
      setElapsedSec(0);
      setPrepRemaining(60);
      setSpeakingElapsed(0);
      setAnalysisReport(null);
      setAnalysisError("");
      setAccentEase(undefined);
      setExaminerActivity("idle");
      setExaminerSpeechLevel(0);
      setExaminerViseme("rest");
      setInstructionReady(false);
      setEarlyWarning(false);
      spokenKeyRef.current = "";
      analysisRunRef.current = "";
      setScreen("setup");
    },
    [
      availableExamVoiceIds,
      settings.excludedAccents,
      settings.practiceVoiceId,
      settings.randomAccentMode,
      settings.randomExaminer,
      stopStoredPlayback,
    ],
  );

  const beginExam = useCallback(async () => {
    const hasMic = await ensureMic();
    if (!hasMic) return;
    if (!online && settings.provider === "openai") {
      setError("OpenAI 模式需要网络。请恢复网络或切换到 Mock 模式。 ");
      return;
    }
    stopExaminerSpeech();
    setExaminerSpeechLevel(0);
    setExaminerViseme("rest");
    saveRecentExaminerUsage([
      { profileId: examinerProfile.id, accent: examinerProfile.accent },
      ...loadRecentExaminerUsage(),
    ]);
    setInstructionReady(false);
    setQuestionIndex(0);
    setExamState(transitionExam("SETUP", "START"));
    spokenKeyRef.current = "";
    setScreen("exam");
  }, [ensureMic, online, settings.provider, examinerProfile]);

  const resumeExam = useCallback(async () => {
    if (!checkpoint) return;
    const hasMic = await ensureMic();
    if (!hasMic) return;
    setPlan(checkpoint.plan);
    setExaminerProfile(
      checkpoint.examinerProfile ??
        createExaminerProfile({
          seed: checkpoint.id,
          availableVoiceIds: availableExamVoiceIds,
          randomEnabled: settings.randomExaminer,
          accentMode: settings.randomAccentMode,
          fixedVoiceId: settings.practiceVoiceId,
          excludedAccents: settings.excludedAccents,
        }),
    );
    setExamState(
      checkpoint.state === "ANALYSING" ? "FINISHED" : checkpoint.state,
    );
    setQuestionIndex(checkpoint.questionIndex);
    setSegments(checkpoint.segments);
    setNotes(checkpoint.notes);
    setElapsedSec(checkpoint.elapsedSec);
    setPrepRemaining(
      checkpoint.state === "PART2_PREPARATION" ? 60 : prepRemaining,
    );
    spokenKeyRef.current = "";
    setScreen("exam");
  }, [
    checkpoint,
    ensureMic,
    prepRemaining,
    availableExamVoiceIds,
    settings.excludedAccents,
    settings.practiceVoiceId,
    settings.randomAccentMode,
    settings.randomExaminer,
  ]);

  const beginPart2Prep = useCallback(() => {
    setPrepRemaining(60);
    setInstructionReady(false);
    setExamState(transitionExam("PART2_INSTRUCTIONS", "INSTRUCTIONS_COMPLETE"));
  }, []);

  const handleStopAnswer = useCallback(() => {
    if (
      examState === "PART2_SPEAKING" &&
      speakingElapsed < 30 &&
      !earlyWarning
    ) {
      setEarlyWarning(true);
      return;
    }
    void stopCurrentRecording();
  }, [examState, speakingElapsed, earlyWarning, stopCurrentRecording]);

  const exitExam = useCallback(() => {
    const confirmed = window.confirm(
      "当前考试进度已保存在本机。确定退出到首页吗？",
    );
    if (!confirmed) return;
    if (recording) void stopCurrentRecording();
    stopExaminerSpeech();
    setExaminerSpeechLevel(0);
    setExaminerViseme("rest");
    setScreen("home");
  }, [recording, stopCurrentRecording]);

  const selectedPart2 = useMemo<Part2Set>(
    () =>
      PART2_SETS.find((item) => item.id === practicePart2Id) || PART2_SETS[0],
    [practicePart2Id],
  );
  const selectedPart1 = useMemo(
    () =>
      PART1_TOPICS.find((item) => item.id === practiceTopicId) ||
      PART1_TOPICS[0],
    [practiceTopicId],
  );
  const practiceQuestion = useMemo(() => {
    if (practicePart === 1)
      return selectedPart1.questions[
        practiceQuestionIndex % selectedPart1.questions.length
      ].question;
    if (practicePart === 2) return selectedPart2.title;
    return selectedPart2.part3Questions[
      practiceQuestionIndex % selectedPart2.part3Questions.length
    ].question;
  }, [practicePart, selectedPart1, selectedPart2, practiceQuestionIndex]);

  const beginPracticeSpeaking = useCallback(async () => {
    const hasMic = await ensureMic();
    if (!hasMic) return;
    setPracticePhase("speaking");
    setPracticeElapsed(0);
    const spoken =
      practicePart === 2
        ? `${selectedPart2.title} Please start speaking now.`
        : practiceQuestion;
    try {
      await speak(spoken, practiceProfile);
      startAnswer({
        kind: "practice",
        question: practiceQuestion,
        part: practicePart,
        accent: practiceProfile.accent,
      });
    } catch {
      setPracticePhase("idle");
    }
  }, [
    ensureMic,
    practicePart,
    selectedPart2,
    practiceQuestion,
    practiceProfile,
    speak,
    startAnswer,
  ]);

  const startPractice = useCallback(async () => {
    setPracticeFeedback(null);
    setLiveText("");
    setError("");
    if (practicePart === 2) {
      const hasMic = await ensureMic();
      if (!hasMic) return;
      setPracticeRemaining(60);
      setPracticePhase("preparing");
      try {
        await speak(
          "You have one minute to prepare. You can make notes if you wish.",
          practiceProfile,
        );
      } catch {
        setPracticePhase("idle");
      }
    } else {
      await beginPracticeSpeaking();
    }
  }, [
    practicePart,
    ensureMic,
    speak,
    beginPracticeSpeaking,
    practiceProfile,
  ]);

  const nextPracticeQuestion = useCallback(() => {
    setPracticeQuestionIndex((value) => value + 1);
    setPracticeFeedback(null);
    setPracticePhase("idle");
    setLiveText("");
    setPracticeElapsed(0);
  }, []);

  const playStoredAudio = useCallback(
    async (segmentId: string) => {
      stopExaminerSpeech();
      stopStoredPlayback();
      setExaminerSpeechLevel(0);
      setExaminerViseme("rest");
      try {
        const current = segments.find((segment) => segment.id === segmentId);
        if (current?.audioUrl) {
          const audio = new Audio(current.audioUrl);
          storedPlaybackRef.current = { audio };
          audio.onended = () => {
            if (storedPlaybackRef.current?.audio === audio)
              storedPlaybackRef.current = null;
          };
          await audio.play();
          return;
        }
        const blob = await loadAudioBlob(segmentId);
        if (!blob) throw new Error("这段录音未保存或已被清理。 ");
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        storedPlaybackRef.current = { audio, objectUrl: url };
        audio.onended = () => {
          if (storedPlaybackRef.current?.audio === audio)
            storedPlaybackRef.current = null;
          URL.revokeObjectURL(url);
        };
        await audio.play();
      } catch (playError) {
        stopStoredPlayback();
        setError(
          playError instanceof Error ? playError.message : "录音播放失败。 ",
        );
      }
    },
    [segments, stopStoredPlayback],
  );

  const removeHistory = useCallback(
    async (record: HistoryRecord) => {
      if (!window.confirm("删除这条练习记录及其本地录音？此操作不可撤销。"))
        return;
      const next = history.filter((item) => item.id !== record.id);
      setHistory(next);
      saveHistory(next);
      if (record.recordingSaved) await deleteRecordAudio(record);
    },
    [history],
  );

  const rateAccentEase = useCallback(
    (rating: NonNullable<HistoryRecord["accentEase"]>) => {
      setAccentEase(rating);
      setHistory((current) => {
        const next = current.map((record) =>
          record.id === plan.comboId
            ? { ...record, accentEase: rating }
            : record,
        );
        saveHistory(next);
        return next;
      });
    },
    [plan.comboId],
  );

  const finishOnboarding = useCallback(() => {
    const next = {
      ...settings,
      onboarded: true,
      displayName: settings.displayName.trim() || "Learner",
    };
    setSettings(next);
    setScreen("home");
  }, [settings, setSettings]);

  const navItems: { id: Screen; label: string; icon: IconName }[] = [
    { id: "home", label: "首页", icon: "home" },
    { id: "practice", label: "专项练习", icon: "practice" },
    { id: "history", label: "历史成绩", icon: "history" },
    { id: "trends", label: "学习趋势", icon: "trend" },
    { id: "settings", label: "设置", icon: "settings" },
  ];

  const examProgress = partProgress(examState);
  const latest = history[0];
  const weakest = latest?.dimensions.slice().sort((a, b) => a.band - b.band)[0];
  const examCount = history.filter(
    (record) => record.mode === "mock-exam",
  ).length;
  const recentAverage = movingAverage(
    history
      .slice()
      .reverse()
      .map((record) => record.overall),
    3,
  ).at(-1);

  if (!ready)
    return (
      <div className="boot-screen">
        <span className="logo-mark">V</span>
        <p>正在恢复学习空间…</p>
      </div>
    );

  if (screen === "onboarding") {
    return (
      <main className="onboarding-shell">
        <section className="onboarding-copy">
          <div className="brand">
            <span className="logo-mark">V</span>
            <div>
              <strong>Vocalis</strong>
              <small>AI IELTS Speaking Studio</small>
            </div>
          </div>
          <span className="eyebrow">FIRST-TIME SETUP</span>
          <h1>
            先让练习环境
            <br />
            适合你的目标。
          </h1>
          <p>
            约 2
            分钟完成设置。麦克风录音默认不会永久保存；只有你主动开启后才写入本机。
          </p>
          <div className="privacy-note">
            <Icon name="shield" />
            <span>
              音频说明：Mock 模式不把录音发送给 AI。OpenAI
              模式会把你提交的录音发送到所配置的服务用于转写。
            </span>
          </div>
        </section>
        <section className="onboarding-card">
          <div className="step-dots">
            <span className="active" />
            <span />
            <span />
          </div>
          <h2>个人目标与设备</h2>
          <div className="form-grid">
            <label>
              希望如何称呼你
              <input
                value={settings.displayName}
                onChange={(event) =>
                  setSettings({ ...settings, displayName: event.target.value })
                }
                placeholder="例如：Lin"
              />
            </label>
            <label>
              目标分数
              <select
                value={settings.targetBand}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    targetBand: Number(event.target.value),
                  })
                }
              >
                {[5, 5.5, 6, 6.5, 7, 7.5, 8].map((band) => (
                  <option key={band} value={band}>
                    {band.toFixed(1)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              考试日期（可跳过）
              <input
                type="date"
                value={settings.examDate}
                onChange={(event) =>
                  setSettings({ ...settings, examDate: event.target.value })
                }
              />
            </label>
            <label>
              日常练习考官声音
              <select
                value={settings.practiceVoiceId}
                onChange={(event) =>
                  selectPracticeVoice(event.target.value as ExaminerVoiceId)
                }
              >
                {EXAMINER_VOICE_PRESETS.map((voice) => (
                  <option value={voice.id} key={voice.id}>
                    {ACCENT_LABELS[voice.accent]} · {voice.genderPresentation === "female" ? "女声" : "男声"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="device-checks">
            <button
              className={`device-check ${micStatus === "ready" ? "complete" : ""}`}
              onClick={() => void ensureMic()}
              disabled={micStatus === "checking"}
            >
              <Icon name="mic" />
              <span>
                <strong>麦克风检查</strong>
                <small>
                  {micStatus === "ready"
                    ? "已授权，可以录音"
                    : micStatus === "checking"
                      ? "正在请求权限…"
                      : "点击授权并测试音量"}
                </small>
              </span>
              {micStatus === "ready" && <Icon name="check" />}
            </button>
            <button className="device-check" onClick={() => void testSpeaker()}>
              <Icon name="volume" />
              <span>
                <strong>扬声器检查</strong>
                <small>播放一段英语测试语音</small>
              </span>
              <Icon name="play" />
            </button>
          </div>
          {micStatus === "ready" && <AudioMeter level={level} active />}
          <label className="toggle-row">
            <span>
              <strong>保存录音</strong>
              <small>关闭时，录音仅在当前页面会话内使用</small>
            </span>
            <input
              type="checkbox"
              checked={settings.saveRecordings}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  saveRecordings: event.target.checked,
                })
              }
            />
            <i />
          </label>
          <label className="toggle-row">
            <span>
              <strong>练习模式显示实时转写</strong>
              <small>全真考试期间始终隐藏</small>
            </span>
            <input
              type="checkbox"
              checked={settings.liveTranscript}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  liveTranscript: event.target.checked,
                })
              }
            />
            <i />
          </label>
          {(error || notice) && (
            <div className={error ? "alert error" : "alert success"}>
              <Icon name={error ? "warning" : "check"} />
              <span>{error || notice}</span>
            </div>
          )}
          <button className="primary wide" onClick={finishOnboarding}>
            完成设置，进入首页 <Icon name="arrow" />
          </button>
        </section>
      </main>
    );
  }

  if (screen === "exam") {
    const showCueCard = ["PART2_PREPARATION", "PART2_SPEAKING"].includes(
      examState,
    );
    const isAnalysing = examState === "ANALYSING";
    return (
      <main className="exam-shell">
        <header className="exam-topbar">
          <div className="brand inverse">
            <span className="logo-mark">V</span>
            <div>
              <strong>Vocalis</strong>
              <small>Speaking Simulation</small>
            </div>
          </div>
          <div className="exam-progress">
            <div>
              <strong>{examProgress.part}</strong>
              <span>{formatTime(elapsedSec)}</span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${examProgress.progress}%` }} />
            </div>
          </div>
          <button className="ghost inverse" onClick={exitExam}>
            退出考试
          </button>
        </header>
        {isAnalysing ? (
          <section className="analysis-stage">
            <div className="analysis-orbit">
              <span />
              <span />
              <span />
              <div>
                <Icon name="spark" size={32} />
              </div>
            </div>
            <span className="eyebrow">PRIVATE ANALYSIS</span>
            <h1>正在分析你的整场表现</h1>
            <p>
              整理分段转写、语速、停顿、词汇范围与四项公开评分标准。发音结论会标注置信度。
            </p>
            <div className="analysis-steps">
              <span className="done">
                <Icon name="check" />
                录音分段
              </span>
              <span className="done">
                <Icon name="check" />
                语言特征
              </span>
              <span className="active">
                <span className="spinner" />
                综合估分
              </span>
            </div>
            {analysisError && (
              <div className="analysis-error">
                <div className="alert error">
                  <Icon name="warning" />
                  <span>{analysisError}</span>
                </div>
                <p>没有生成任何伪造的云端评分。考试录音和状态仍在本机。</p>
                <div>
                  <button
                    className="secondary"
                    onClick={() => {
                      analysisRunRef.current = "";
                      void analyseSession();
                    }}
                  >
                    重试云端分析
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      analysisRunRef.current = "";
                      void analyseSession(true);
                    }}
                  >
                    使用 Mock 低置信度分析
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className={`exam-stage ${showCueCard ? "with-card" : ""}`}>
            {showCueCard && (
              <aside className="cue-panel exam-cue">
                <div className="cue-heading">
                  <span>PART 2 · CUE CARD</span>
                  <strong>
                    {examState === "PART2_PREPARATION"
                      ? formatTime(prepRemaining)
                      : formatTime(speakingElapsed)}
                  </strong>
                </div>
                <h2>{plan.part2.title}</h2>
                <p>You should say:</p>
                <ul>
                  {plan.part2.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                <p>{plan.part2.explain}</p>
                <label>
                  Notes
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Type keywords only…"
                    disabled={examState === "PART2_SPEAKING"}
                  />
                </label>
              </aside>
            )}
            <div className="examiner-column">
              <ExaminerAvatar
                activity={examinerActivity}
                speechLevel={examinerSpeechLevel}
                viseme={examinerViseme}
                avatarId={examinerProfile.avatarId}
                displayName={examinerProfile.displayName}
              />
              <div className="exam-status-copy">
                {examinerActivity === "speaking" && (
                  <>
                    <span className="english-status">Examiner is speaking</span>
                    <small>Please listen carefully</small>
                  </>
                )}
                {examinerActivity === "thinking" && (
                  <>
                    <span className="english-status">Preparing examiner audio</span>
                    <small>Please wait a moment</small>
                  </>
                )}
                {recording && (
                  <>
                    <span className="english-status listening">
                      Your answer is being recorded
                    </span>
                    <small>
                      {examState === "PART2_SPEAKING"
                        ? `${formatTime(speakingElapsed)} / 02:00`
                        : "Speak naturally, then end your answer"}
                    </small>
                  </>
                )}
                {examState === "PART2_PREPARATION" && (
                  <>
                    <span className="english-status">Preparation time</span>
                    <small>You may write keywords in your notes</small>
                  </>
                )}
                {examState === "PART2_INSTRUCTIONS" && instructionReady && (
                  <>
                    <span className="english-status">
                      Ready for preparation
                    </span>
                    <small>
                      The one-minute timer will start when you continue
                    </small>
                  </>
                )}
              </div>
              <AudioMeter level={recording ? level : 0} active={recording} />
              <div className="exam-actions">
                {recording && (
                  <button
                    className={`record-stop ${earlyWarning ? "warning" : ""}`}
                    onClick={handleStopAnswer}
                    disabled={savingAnswer}
                  >
                    <span>
                      <Icon name="stop" />
                    </span>
                    {savingAnswer
                      ? "Saving…"
                      : earlyWarning
                        ? "Confirm end"
                        : "End answer"}
                  </button>
                )}
                {examState === "PART2_INSTRUCTIONS" && instructionReady && (
                  <button className="exam-continue" onClick={beginPart2Prep}>
                    Begin preparation <Icon name="arrow" />
                  </button>
                )}
              </div>
              {earlyWarning && (
                <p className="exam-english-warning">
                  You have spoken for less than 30 seconds. Continue if you can,
                  or press again to finish.
                </p>
              )}
              {recording && longSilence && (
                <p className="exam-english-warning">
                  Take your time. You may continue when you are ready.
                </p>
              )}
              {error && (
                <div className="exam-error">
                  <Icon name="warning" />
                  <span>{error}</span>
                  <button onClick={() => setError("")}>×</button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    );
  }

  if (screen === "results" && analysisReport) {
    return (
      <div className="app-shell results-shell">
        <header className="top-header">
          <div className="brand">
            <span className="logo-mark">V</span>
            <div>
              <strong>Vocalis</strong>
              <small>AI IELTS Speaking Studio</small>
            </div>
          </div>
          <div className="header-actions">
            <span className="provider-pill">
              <i />
              {analysisReport.provider === "mock"
                ? "Mock analysis"
                : "OpenAI analysis"}
            </span>
            <button
              className="icon-button"
              onClick={() =>
                setSettings({
                  ...settings,
                  theme: settings.theme === "dark" ? "light" : "dark",
                })
              }
            >
              <Icon name={settings.theme === "dark" ? "sun" : "moon"} />
            </button>
          </div>
        </header>
        <main className="results-main">
          <button className="back-link" onClick={() => setScreen("home")}>
            <span>←</span> 返回首页
          </button>
          <section className="result-hero">
            <div>
              <span className="eyebrow">ESTIMATED RESULT</span>
              <h1>本次口语表现报告</h1>
              <p>
                {new Date().toLocaleDateString("zh-CN")} ·{" "}
                {plan.part2.mainTopic} · {formatTime(elapsedSec)}
              </p>
            </div>
            <div className="overall-score">
              <span>综合估分</span>
              <strong>{analysisReport.overall.toFixed(1)}</strong>
              <small>
                合理区间 {analysisReport.range[0].toFixed(1)}–
                {analysisReport.range[1].toFixed(1)}
              </small>
            </div>
          </section>
          <div className="disclaimer">
            <Icon name="shield" />
            <p>{analysisReport.disclaimer}</p>
          </div>
          <section className="panel result-examiner-card">
            <ExaminerAvatar
              compact
              activity="idle"
              avatarId={examinerProfile.avatarId}
              displayName={examinerProfile.displayName}
            />
            <div>
              <span className="eyebrow">THIS SESSION&apos;S EXAMINER</span>
              <h2>{examinerProfile.displayName}</h2>
              <p>
                {ACCENT_LABELS[examinerProfile.accent]} · 本场从 Part 1 到 Part
                3 始终使用同一形象和声音。
              </p>
              <div className="accent-ease">
                <span>这个口音对你来说容易理解吗？</span>
                {([
                  ["easy", "容易"],
                  ["manageable", "基本能听懂"],
                  ["challenging", "有挑战"],
                ] as const).map(([value, label]) => (
                  <button
                    className={accentEase === value ? "active" : ""}
                    key={value}
                    onClick={() => rateAccentEase(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <small>口音适应反馈单独保存，不会进入四项评分。</small>
            </div>
          </section>
          <section className="result-grid">
            <article className="panel score-panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">FOUR CRITERIA</span>
                  <h2>四项评分维度</h2>
                </div>
                <Icon name="chart" />
              </div>
              <ScoreBars report={analysisReport} />
            </article>
            <article className="panel metrics-panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">SPEECH METRICS</span>
                  <h2>辅助语音指标</h2>
                </div>
                <Icon name="mic" />
              </div>
              <div className="metric-grid">
                <div>
                  <strong>{analysisReport.metrics.wordsPerMinute}</strong>
                  <span>词 / 分钟</span>
                </div>
                <div>
                  <strong>
                    {formatTime(analysisReport.metrics.totalSpeakingSeconds)}
                  </strong>
                  <span>总讲话时间</span>
                </div>
                <div>
                  <strong>{analysisReport.metrics.averageAnswerWords}</strong>
                  <span>平均回答词数</span>
                </div>
                <div>
                  <strong>{analysisReport.metrics.longPauses}</strong>
                  <span>&gt;1.5秒停顿</span>
                </div>
                <div>
                  <strong>{analysisReport.metrics.fillerCount}</strong>
                  <span>填充词</span>
                </div>
                <div>
                  <strong>
                    {formatTime(analysisReport.metrics.part2SpeakingSeconds)}
                  </strong>
                  <span>Part 2 持续</span>
                </div>
              </div>
              <p className="confidence-note">
                <Icon name="warning" />
                这些指标仅辅助解释，不会机械决定分数。Mock 发音分析为低置信度。
              </p>
            </article>
          </section>
          <section className="panel dimension-detail">
            <div className="panel-title">
              <div>
                <span className="eyebrow">EVIDENCE</span>
                <h2>评分证据与提高 0.5 分方向</h2>
              </div>
            </div>
            <div className="dimension-cards">
              {analysisReport.dimensions.map((dimension) => (
                <article key={dimension.key}>
                  <div>
                    <h3>{dimension.label}</h3>
                    <span className={`confidence ${dimension.confidence}`}>
                      {dimension.confidence === "low"
                        ? "低置信度"
                        : "中等置信度"}
                    </span>
                  </div>
                  <p>{dimension.explanation}</p>
                  <ul>
                    {dimension.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <strong>下一步：{dimension.priority}</strong>
                </article>
              ))}
            </div>
          </section>
          <section className="panel transcript-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">REPLAY & TRANSCRIPT</span>
                <h2>完整对话回放</h2>
              </div>
              <span>{segments.length} 段回答</span>
            </div>
            <div className="transcript-list">
              {segments.length ? (
                segments.map((segment, index) => (
                  <article key={segment.id}>
                    <button
                      className="play-button"
                      onClick={() => void playStoredAudio(segment.id)}
                    >
                      <Icon name="play" />
                    </button>
                    <div>
                      <div className="transcript-meta">
                        <strong>
                          {segment.part
                            ? `Part ${segment.part}`
                            : "Introduction"}{" "}
                          · Answer {index + 1}
                        </strong>
                        <span>{formatTime(segment.durationSec)}</span>
                      </div>
                      <p className="question-line">{segment.question}</p>
                      <p>
                        {segment.text ||
                          "浏览器未返回可靠转写；录音仍可在当前会话回放。"}
                      </p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">没有可用回答分段。</div>
              )}
            </div>
          </section>
          <section className="result-grid">
            <article className="panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">LANGUAGE REVIEW</span>
                  <h2>纠错与更自然表达</h2>
                </div>
              </div>
              {analysisReport.corrections.length ? (
                analysisReport.corrections.map((correction, index) => (
                  <div className="correction" key={index}>
                    <div>
                      <span className={`certainty ${correction.certainty}`}>
                        {correction.certainty === "error"
                          ? "确定错误"
                          : correction.certainty === "acceptable"
                            ? "可接受"
                            : correction.certainty === "upgrade"
                              ? "表达升级"
                              : "个人风格"}
                      </span>
                      <span>{correction.type}</span>
                    </div>
                    <p>
                      <del>{correction.original}</del>
                    </p>
                    <p>
                      <strong>{correction.naturalVersion}</strong>
                    </p>
                    <small>{correction.explanationZh}</small>
                    <footer>
                      影响维度：{correction.dimension} · {correction.practice}
                    </footer>
                  </div>
                ))
              ) : (
                <p className="empty-state">
                  转写不足，未生成未经证据支持的语言错误。
                </p>
              )}
            </article>
            <article className="panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">ACTION PLAN</span>
                  <h2>个性化改进计划</h2>
                </div>
              </div>
              <h3 className="subheading">本次做得最好的 3 点</h3>
              <ol className="number-list good">
                {analysisReport.bestPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ol>
              <h3 className="subheading">最需要解决的 3 个问题</h3>
              <ol className="number-list">
                {analysisReport.priorities.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ol>
              <div className="core-goal">
                <span>下次唯一核心目标</span>
                <strong>{analysisReport.nextGoal}</strong>
              </div>
              <p>
                <strong>推荐：</strong>
                {analysisReport.recommendedPart} ·{" "}
                {analysisReport.recommendedTopic}
              </p>
              <div className="expression-chips">
                {analysisReport.expressions.map((expression) => (
                  <span key={expression}>{expression}</span>
                ))}
              </div>
              <div className="drill">
                <Icon name="clock" />
                <p>
                  <strong>10–15 分钟针对练习</strong>
                  {analysisReport.drill}
                </p>
              </div>
            </article>
          </section>
          <section className="panel improved-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">BETTER ANSWERS</span>
                <h2>各 Part 改进版回答</h2>
              </div>
              <span>比当前水平高约 0.5–1 分</span>
            </div>
            <div className="improved-grid">
              {analysisReport.improvedAnswers.map((answer) => (
                <article key={answer.part}>
                  <span>PART {answer.part}</span>
                  <p>{answer.answer}</p>
                  <div>
                    {answer.phrases.map((phrase) => (
                      <mark key={phrase}>{phrase}</mark>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <div className="result-actions">
            <button
              className="secondary"
              onClick={() => {
                setPracticePart(
                  analysisReport.recommendedPart.includes("2") ? 2 : 3,
                );
                setScreen("practice");
              }}
            >
              练习推荐薄弱项
            </button>
            <button
              className="secondary"
              onClick={() => newExam({ forcedAccent: examinerProfile.accent })}
            >
              使用相同口音再练
            </button>
            <button
              className="primary"
              onClick={() => newExam({ avoidAccent: examinerProfile.accent })}
            >
              <Icon name="refresh" /> 换一种口音重新模拟
            </button>
          </div>
        </main>
      </div>
    );
  }

  const renderMain = () => {
    if (screen === "home")
      return (
        <>
          <section className="welcome-row">
            <div>
              <span className="eyebrow">YOUR SPEAKING DESK</span>
              <h1>
                {settings.displayName ? `${settings.displayName}，` : ""}
                今天想怎么练？
              </h1>
              <p>
                目标分数 {settings.targetBand.toFixed(1)} ·
                让每一次开口都有清晰下一步
              </p>
            </div>
            <div className="date-card">
              <span>
                {new Date().toLocaleDateString("zh-CN", { weekday: "long" })}
              </span>
              <strong>{new Date().getDate()}</strong>
              <small>
                {new Date().toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "long",
                })}
              </small>
            </div>
          </section>
          {checkpoint && (
            <section className="resume-banner">
              <div>
                <Icon name="refresh" />
                <span>
                  <strong>发现未完成的模拟考试</strong>
                  <small>
                    保存于{" "}
                    {new Date(checkpoint.savedAt).toLocaleString("zh-CN")} ·{" "}
                    {partProgress(checkpoint.state).part}
                  </small>
                </span>
              </div>
              <div>
                <button
                  className="ghost"
                  onClick={() => {
                    clearCheckpoint();
                    setCheckpoint(null);
                  }}
                >
                  放弃进度
                </button>
                <button className="secondary" onClick={() => void resumeExam()}>
                  恢复考试
                </button>
              </div>
            </section>
          )}
          <section className="hero-actions">
            <button
              className="hero-card exam-card"
              onClick={() => newExam()}
            >
              <div className="card-top">
                <span className="card-icon">
                  <Icon name="exam" size={26} />
                </span>
                <span className="duration">
                  <Icon name="clock" />
                  11–14 min
                </span>
              </div>
              <div>
                <span className="eyebrow">FULL SIMULATION</span>
                <h2>开始全真模拟考试</h2>
                <p>
                  完整 Part 1–3；每场随机分配并锁定一名考官，考试中不显示提示或反馈。
                </p>
              </div>
              <span className="card-arrow">
                <Icon name="arrow" />
              </span>
              <div className="card-glow" />
            </button>
            <button
              className="hero-card practice-card"
              onClick={() => setScreen("practice")}
            >
              <div className="card-top">
                <span className="card-icon">
                  <Icon name="practice" size={26} />
                </span>
                <span className="duration">按需练习</span>
              </div>
              <div>
                <span className="eyebrow">DAILY PRACTICE</span>
                <h2>进入日常专项练习</h2>
                <p>选择 Part、主题和难度，可打开实时转写、提示与即时反馈。</p>
              </div>
              <span className="card-arrow">
                <Icon name="arrow" />
              </span>
            </button>
          </section>
          <section className="dashboard-stats">
            <article>
              <span>最近估分</span>
              <strong>{latest ? latest.overall.toFixed(1) : "—"}</strong>
              <small>
                {latest
                  ? `${new Date(latest.date).toLocaleDateString("zh-CN")} · ${latest.mode === "mock-exam" ? "模拟考试" : "专项练习"}`
                  : "完成练习后显示"}
              </small>
            </article>
            <article>
              <span>累计练习</span>
              <strong>{history.length}</strong>
              <small>其中 {examCount} 次完整模拟</small>
            </article>
            <article>
              <span>最需提高</span>
              <strong className="text-stat">
                {weakest?.label || "等待数据"}
              </strong>
              <small>
                {weakest
                  ? `最近估分 ${weakest.band.toFixed(1)}`
                  : "完成一次完整模拟后分析"}
              </small>
            </article>
          </section>
          <section className="home-grid">
            <article className="panel mini-trend">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">ESTIMATED TREND</span>
                  <h2>学习趋势</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setScreen("trends")}
                >
                  查看全部 <Icon name="arrow" />
                </button>
              </div>
              <TrendLine
                values={movingAverage(
                  history
                    .slice(0, 7)
                    .reverse()
                    .map((record) => record.overall),
                  3,
                )}
              />
              <footer>
                <span>
                  <i className="legend-dot" />
                  最近多次移动平均
                </span>
                <strong>
                  {recentAverage
                    ? `当前 ${recentAverage.toFixed(1)}`
                    : "暂无数据"}
                </strong>
              </footer>
            </article>
            <article className="panel weak-panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">FOCUS</span>
                  <h2>错题与薄弱点</h2>
                </div>
                <Icon name="spark" />
              </div>
              {latest ? (
                <>
                  <div className="weak-score">
                    <span>{weakest?.label}</span>
                    <strong>{weakest?.band.toFixed(1)}</strong>
                  </div>
                  <p>{latest.mainErrors[0] || "继续积累多次练习数据。"}</p>
                  <button
                    className="secondary wide"
                    onClick={() => setScreen("practice")}
                  >
                    开始薄弱点专项 <Icon name="arrow" />
                  </button>
                </>
              ) : (
                <div className="empty-state">
                  完成第一次练习后，这里会显示最优先的改进方向。
                </div>
              )}
            </article>
          </section>
        </>
      );

    if (screen === "setup")
      return (
        <section className="page-section setup-page">
          <div className="page-heading">
            <div>
              <span className="eyebrow">PRE-TEST CHECK</span>
              <h1>考试前检查</h1>
              <p>
                {settings.randomExaminer
                  ? "本次考试已随机分配一名考官；开始后整场锁定同一形象、声音和口音。"
                  : "本次考试使用你设置的固定考官声音；开始后整场保持不变。"}
              </p>
            </div>
            <ExaminerAvatar
              compact
              activity={examinerActivity === "speaking" ? "speaking" : "idle"}
              speechLevel={examinerSpeechLevel}
              viseme={examinerViseme}
              avatarId={examinerProfile.avatarId}
              displayName={examinerProfile.displayName}
            />
          </div>
          <div className="setup-grid">
            <article className="panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">DEVICE</span>
                  <h2>设备与环境</h2>
                </div>
                <Icon name="headphones" />
              </div>
              <button
                className={`check-row ${micStatus === "ready" ? "complete" : ""}`}
                onClick={() => void ensureMic()}
              >
                <span>
                  <Icon name="mic" />
                </span>
                <div>
                  <strong>麦克风</strong>
                  <small>
                    {micStatus === "ready"
                      ? "已连接并检测到音频输入"
                      : "点击授权 Chrome 使用麦克风"}
                  </small>
                </div>
                <b>{micStatus === "ready" ? "Ready" : "Check"}</b>
              </button>
              {micStatus === "ready" && <AudioMeter level={level} active />}
              <button
                className="check-row"
                onClick={() => void testSpeaker(examinerProfile)}
              >
                <span>
                  <Icon name="volume" />
                </span>
                <div>
                  <strong>扬声器</strong>
                  <small>
                    试听本场 {ACCENT_LABELS[examinerProfile.accent]}考官语音
                  </small>
                </div>
                <b>Test</b>
              </button>
              <button
                className={`check-row ${providerReady ? "complete" : ""}`}
                onClick={() => void checkProvider()}
              >
                <span>
                  <Icon name="spark" />
                </span>
                <div>
                  <strong>网络与 AI 服务</strong>
                  <small>
                    {settings.provider === "mock"
                      ? "Mock 模式无需 API 密钥"
                      : "检查服务端 OpenAI 配置"}
                  </small>
                </div>
                <b>{providerReady ? "Ready" : online ? "Check" : "Offline"}</b>
              </button>
              <div className="noise-hint">
                <Icon name={level > 0.3 ? "warning" : "check"} />
                <p>
                  <strong>
                    {level > 0.3 ? "环境音量偏高" : "环境噪声提示"}
                  </strong>
                  {level > 0.3
                    ? "请远离风扇、谈话声或回声较强的位置。"
                    : "说话前保持 2 秒安静，观察音量条是否接近最低。"}
                </p>
              </div>
            </article>
            <article className="panel test-summary">
              <span className="eyebrow">TEST FORMAT</span>
              <h2>本次题目组合</h2>
              <div className="setup-examiner-assignment">
                <Icon name="volume" />
                <p>
                  <strong>{examinerProfile.displayName}</strong>
                  <span>{ACCENT_LABELS[examinerProfile.accent]} · {examinerProfile.genderPresentation === "female" ? "女声" : "男声"}</span>
                </p>
                <small>考试中不可切换</small>
              </div>
              <div className="test-parts">
                <div>
                  <span>01</span>
                  <p>
                    <strong>Part 1</strong>
                    {plan.part1.map((topic) => topic.topic).join(" · ")}
                  </p>
                  <small>约 4–5 分钟</small>
                </div>
                <div>
                  <span>02</span>
                  <p>
                    <strong>Part 2</strong>
                    {plan.part2.mainTopic}
                  </p>
                  <small>1 分钟准备 + 2 分钟陈述</small>
                </div>
                <div>
                  <span>03</span>
                  <p>
                    <strong>Part 3</strong>
                    {plan.part2.relatedPart3Themes.join(" · ")}
                  </p>
                  <small>约 4–5 分钟</small>
                </div>
              </div>
              <div className="privacy-note">
                <Icon name="shield" />
                <span>
                  {settings.provider === "mock"
                    ? "Mock 模式：录音不会发送给外部 AI；浏览器可能使用系统语音服务完成转写。"
                    : "OpenAI 模式：回答录音会发送到你配置的 OpenAI 服务用于转写；评分数据默认 store:false。"}
                </span>
              </div>
              <label className="consent">
                <input type="checkbox" defaultChecked />
                <span>
                  我已了解本次音频处理方式，身份检查仅为流程模拟，不上传证件。
                </span>
              </label>
              <button
                className="primary wide large"
                onClick={() => void beginExam()}
                disabled={micStatus === "checking"}
              >
                {micStatus === "checking" ? "正在检查麦克风…" : "开始考试"}
                <Icon name="arrow" />
              </button>
              <button
                className="text-button centered"
                onClick={() => setScreen("home")}
              >
                返回首页
              </button>
            </article>
          </div>
          {(error || notice) && (
            <div
              className={
                error
                  ? "alert error floating-alert"
                  : "alert success floating-alert"
              }
            >
              <Icon name={error ? "warning" : "check"} />
              <span>{error || notice}</span>
            </div>
          )}
        </section>
      );

    if (screen === "practice")
      return (
        <section className="page-section practice-page">
          <div className="page-heading simple">
            <div>
              <span className="eyebrow">DAILY PRACTICE</span>
              <h1>专项口语练习</h1>
              <p>练习模式可以显示辅助信息；严格模式只在回答后反馈。</p>
            </div>
            <button
              className="secondary"
              onClick={() => setStrictPractice((value) => !value)}
            >
              <Icon name="shield" />
              {strictPractice ? "严格模式已开" : "开启严格模式"}
            </button>
          </div>
          <div className="practice-layout">
            <aside className="practice-controls panel">
              <label>
                练习类型
                <select
                  value={practiceMode}
                  onChange={(event) => setPracticeMode(event.target.value)}
                >
                  {[
                    "单项练习",
                    "综合练习",
                    "薄弱点专项",
                    "历史错题重练",
                    "随机练习",
                  ].map((mode) => (
                    <option key={mode}>{mode}</option>
                  ))}
                </select>
              </label>
              <label>
                本组固定考官声音
                <select
                  value={settings.practiceVoiceId}
                  disabled={recording || examinerActivity === "speaking"}
                  onChange={(event) =>
                    selectPracticeVoice(event.target.value as ExaminerVoiceId)
                  }
                >
                  {EXAMINER_VOICE_PRESETS.map((voice) => (
                    <option value={voice.id} key={voice.id}>
                      {ACCENT_LABELS[voice.accent]} · {voice.genderPresentation === "female" ? "女声" : "男声"}
                    </option>
                  ))}
                </select>
              </label>
              <div className="segmented">
                <button
                  className={practicePart === 1 ? "active" : ""}
                  onClick={() => {
                    setPracticePart(1);
                    setPracticePhase("idle");
                  }}
                >
                  Part 1
                </button>
                <button
                  className={practicePart === 2 ? "active" : ""}
                  onClick={() => {
                    setPracticePart(2);
                    setPracticePhase("idle");
                  }}
                >
                  Part 2
                </button>
                <button
                  className={practicePart === 3 ? "active" : ""}
                  onClick={() => {
                    setPracticePart(3);
                    setPracticePhase("idle");
                  }}
                >
                  Part 3
                </button>
              </div>
              {practicePart === 1 ? (
                <label>
                  主题
                  <select
                    value={practiceTopicId}
                    onChange={(event) => {
                      setPracticeTopicId(event.target.value);
                      setPracticeQuestionIndex(0);
                    }}
                  >
                    {PART1_TOPICS.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.label} · {topic.topic}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  {practicePart === 2 ? "Cue Card 主题" : "关联讨论主题"}
                  <select
                    value={practicePart2Id}
                    onChange={(event) => {
                      setPracticePart2Id(event.target.value);
                      setPracticeQuestionIndex(0);
                    }}
                  >
                    {PART2_SETS.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.mainTopic}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {practicePart === 2 && (
                <label>
                  讲话时长
                  <select
                    value={practiceDuration}
                    onChange={(event) =>
                      setPracticeDuration(Number(event.target.value))
                    }
                  >
                    <option value={30}>30 秒</option>
                    <option value={60}>60 秒</option>
                    <option value={90}>90 秒</option>
                    <option value={120}>完整 2 分钟</option>
                  </select>
                </label>
              )}
              <div className="practice-options">
                <label className="toggle-row compact">
                  <span>
                    <strong>实时转写</strong>
                    <small>仅练习模式</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.liveTranscript}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        liveTranscript: event.target.checked,
                      })
                    }
                  />
                  <i />
                </label>
                <label className="toggle-row compact">
                  <span>
                    <strong>慢速考官</strong>
                    <small>0.85× 语速</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.speechRate < 1}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        speechRate: event.target.checked ? 0.85 : 1,
                      })
                    }
                  />
                  <i />
                </label>
              </div>
              <div className="privacy-mini">
                <Icon name="shield" />
                录音{settings.saveRecordings ? "会保存到本机" : "不会永久保存"}
              </div>
            </aside>
            <div className="practice-workspace">
              <article className="panel practice-question">
                <div className="practice-examiner">
                  <ExaminerAvatar
                    compact
                    activity={examinerActivity}
                    speechLevel={examinerSpeechLevel}
                    viseme={examinerViseme}
                    avatarId={practiceProfile.avatarId}
                    displayName={practiceProfile.displayName}
                  />
                  <div>
                    <span className="eyebrow">
                      {practiceMode.toUpperCase()} · PART {practicePart}
                    </span>
                    <h2>{practiceQuestion}</h2>
                    {practicePart === 2 && (
                      <>
                        <p>You should say:</p>
                        <ul>
                          {selectedPart2.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                        <p>{selectedPart2.explain}</p>
                      </>
                    )}
                    {practicePart === 3 && !strictPractice && (
                      <div className="structure-hints">
                        <span>观点</span>
                        <span>原因</span>
                        <span>解释</span>
                        <span>例子 / 对比</span>
                      </div>
                    )}
                  </div>
                </div>
                {practicePart === 2 &&
                  (practicePhase === "preparing" ||
                    practicePhase === "speaking") && (
                    <div className="practice-notes">
                      <label>
                        电子笔记
                        <textarea
                          value={practiceNotes}
                          onChange={(event) =>
                            setPracticeNotes(event.target.value)
                          }
                          placeholder="只写关键词，不要写完整答案…"
                          disabled={practicePhase === "speaking"}
                        />
                      </label>
                      <div
                        className={`big-timer ${practiceRemaining <= 10 && practicePhase === "preparing" ? "urgent" : ""}`}
                      >
                        <span>
                          {practicePhase === "preparing"
                            ? "准备时间"
                            : "讲话时间"}
                        </span>
                        <strong>
                          {formatTime(
                            practicePhase === "preparing"
                              ? practiceRemaining
                              : practiceElapsed,
                          )}
                        </strong>
                        <small>
                          {practicePhase === "speaking"
                            ? `/ ${formatTime(practiceDuration)}`
                            : "倒计时结束后自动开始"}
                        </small>
                      </div>
                    </div>
                  )}
                <div className="practice-recorder">
                  <AudioMeter
                    level={recording ? level : 0}
                    active={recording}
                  />
                  {settings.liveTranscript &&
                    !strictPractice &&
                    (recording || liveText) && (
                      <div className="live-transcript">
                        <span>LIVE TRANSCRIPT</span>
                        <p>{liveText || "Listening…"}</p>
                      </div>
                    )}
                  <div>
                    {practicePhase === "idle" && (
                      <button
                        className="primary large"
                        onClick={() => void startPractice()}
                      >
                        <Icon name="mic" />
                        {practicePart === 2
                          ? "开始 1 分钟准备"
                          : "听题并开始回答"}
                      </button>
                    )}
                    {recording && (
                      <button
                        className="record-stop practice"
                        onClick={() => void stopCurrentRecording()}
                      >
                        <span>
                          <Icon name="stop" />
                        </span>
                        结束回答
                      </button>
                    )}
                    {practicePhase === "preparing" && (
                      <button
                        className="secondary"
                        onClick={() => void beginPracticeSpeaking()}
                      >
                        提前开始回答
                      </button>
                    )}
                  </div>
                </div>
                {error && (
                  <div className="alert error">
                    <Icon name="warning" />
                    <span>{error}</span>
                  </div>
                )}
              </article>
              {practiceFeedback && (
                <article className="panel feedback-card">
                  <div className="feedback-head">
                    <div>
                      <span className="eyebrow">INSTANT FEEDBACK</span>
                      <h2>本题即时反馈</h2>
                    </div>
                    <div>
                      <span>练习估分</span>
                      <strong>{practiceFeedback.band.toFixed(1)}</strong>
                    </div>
                  </div>
                  <div className="feedback-grid">
                    <div>
                      <span>回答长度</span>
                      <strong>
                        {practiceFeedback.wordCount} 词 ·{" "}
                        {formatTime(practiceFeedback.durationSec)}
                      </strong>
                      <p>
                        {practiceFeedback.tooShort
                          ? "偏短，需要补充原因或例子。"
                          : "长度足以支持基本展开。"}
                      </p>
                    </div>
                    <div>
                      <span>最优先改进</span>
                      <strong>{practiceFeedback.focus}</strong>
                      <p>不要为了模板而强行加入不相关内容。</p>
                    </div>
                  </div>
                  <div className="natural-box">
                    <span>可以学习的自然表达</span>
                    <strong>{practiceFeedback.naturalExpression}</strong>
                    <p>{practiceFeedback.improvedAnswer}</p>
                  </div>
                  <div className="feedback-actions">
                    <button
                      className="secondary"
                      onClick={() => {
                        setPracticeFeedback(null);
                        setPracticePhase("idle");
                        setLiveText("");
                      }}
                    >
                      <Icon name="refresh" />
                      重新回答
                    </button>
                    <button className="primary" onClick={nextPracticeQuestion}>
                      下一题 <Icon name="arrow" />
                    </button>
                  </div>
                </article>
              )}
            </div>
          </div>
        </section>
      );

    if (screen === "history")
      return (
        <section className="page-section">
          <div className="page-heading simple">
            <div>
              <span className="eyebrow">YOUR RECORDS</span>
              <h1>历史成绩</h1>
              <p>
                成绩、转写与练习记录保存在当前浏览器；录音只在你主动开启后保存。
              </p>
            </div>
            <span className="count-pill">{history.length} 次记录</span>
          </div>
          {error && (
            <div className="alert error">
              <Icon name="warning" />
              <span>{error}</span>
            </div>
          )}
          <div className="history-list">
            {history.length ? (
              history.map((record) => (
                <article className="history-card panel" key={record.id}>
                  <div className="history-date">
                    <strong>{new Date(record.date).getDate()}</strong>
                    <span>
                      {new Date(record.date).toLocaleDateString("zh-CN", {
                        month: "short",
                      })}
                    </span>
                  </div>
                  <div className="history-info">
                    <div>
                      <span className={`mode-badge ${record.mode}`}>
                        {record.mode === "mock-exam" ? "全真模拟" : "专项练习"}
                      </span>
                      {record.examinerAccent && (
                        <span className="accent-badge">
                          {ACCENT_LABELS[record.examinerAccent]}
                        </span>
                      )}
                      <span>
                        {new Date(record.date).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <h2>{record.title}</h2>
                    {record.examinerDisplayName && (
                      <small className="history-examiner">
                        {record.examinerDisplayName}
                        {record.accentEase
                          ? ` · 听感：${record.accentEase === "easy" ? "容易" : record.accentEase === "manageable" ? "基本能听懂" : "有挑战"}`
                          : ""}
                      </small>
                    )}
                    <p>{record.mainErrors[0] || "暂无主要问题记录"}</p>
                  </div>
                  <div className="history-score">
                    <span>估分</span>
                    <strong>{record.overall.toFixed(1)}</strong>
                    <small>{formatTime(record.durationSec)}</small>
                  </div>
                  <div className="history-actions">
                    {record.recordingSaved && record.segments[0] && (
                      <button
                        className="icon-button"
                        title="播放第一段录音"
                        onClick={() =>
                          void playStoredAudio(record.segments[0].id)
                        }
                      >
                        <Icon name="play" />
                      </button>
                    )}
                    <button
                      className="icon-button danger"
                      title="删除记录"
                      onClick={() => void removeHistory(record)}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-panel">
                <Icon name="history" size={34} />
                <h2>还没有练习记录</h2>
                <p>完成一次专项练习或全真模拟后，记录会出现在这里。</p>
                <button
                  className="primary"
                  onClick={() => setScreen("practice")}
                >
                  开始第一次练习
                </button>
              </div>
            )}
          </div>
        </section>
      );

    if (screen === "trends") {
      const ordered = history.slice().reverse();
      const averages = movingAverage(
        ordered.map((record) => record.overall),
        3,
      );
      const partCounts = [1, 2, 3].map((part) =>
        history.reduce(
          (sum, record) =>
            sum +
            record.segments.filter((segment) => segment.part === part).length,
          0,
        ),
      );
      const totalParts = Math.max(
        1,
        partCounts.reduce((a, b) => a + b, 0),
      );
      return (
        <section className="page-section">
          <div className="page-heading simple">
            <div>
              <span className="eyebrow">LEARNING ANALYTICS</span>
              <h1>学习趋势</h1>
              <p>
                使用最近多次练习的移动平均，避免把单次 AI 波动误认为真实进步。
              </p>
            </div>
            <span className="count-pill">估算趋势</span>
          </div>
          <div className="trend-layout">
            <article className="panel trend-large">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">MOVING AVERAGE</span>
                  <h2>综合估分变化</h2>
                </div>
                <strong>{averages.at(-1)?.toFixed(1) || "—"}</strong>
              </div>
              <TrendLine values={averages} />
              <p className="confidence-note">
                <Icon name="warning" />
                移动平均只代表练习估算趋势，不等同于官方成绩变化。
              </p>
            </article>
            <article className="panel part-ratio">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">PRACTICE MIX</span>
                  <h2>Part 练习比例</h2>
                </div>
              </div>
              {partCounts.map((count, index) => (
                <div className="ratio-row" key={index}>
                  <span>Part {index + 1}</span>
                  <div>
                    <i style={{ width: `${(count / totalParts) * 100}%` }} />
                  </div>
                  <strong>{Math.round((count / totalParts) * 100)}%</strong>
                </div>
              ))}
            </article>
            <article className="panel trend-insights">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">CURRENT SIGNALS</span>
                  <h2>近期能力信号</h2>
                </div>
              </div>
              <div className="insight-list">
                <div>
                  <Icon name="spark" />
                  <p>
                    <span>最近最明显的进步</span>
                    <strong>
                      {averages.length > 1 && averages.at(-1)! > averages[0]
                        ? "综合回答稳定性正在提高"
                        : "需要更多练习数据确认"}
                    </strong>
                  </p>
                </div>
                <div>
                  <Icon name="warning" />
                  <p>
                    <span>当前最薄弱能力</span>
                    <strong>{weakest?.label || "等待完整模拟数据"}</strong>
                  </p>
                </div>
                <div>
                  <Icon name="clock" />
                  <p>
                    <span>Part 2 平均持续</span>
                    <strong>
                      {formatTime(
                        Math.round(
                          history
                            .flatMap((record) => record.segments)
                            .filter((segment) => segment.part === 2)
                            .reduce(
                              (sum, segment) => sum + segment.durationSec,
                              0,
                            ) /
                            Math.max(
                              1,
                              history
                                .flatMap((record) => record.segments)
                                .filter((segment) => segment.part === 2).length,
                            ),
                        ),
                      )}
                    </strong>
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>
      );
    }

    return (
      <section className="page-section settings-page">
        <div className="page-heading simple">
          <div>
            <span className="eyebrow">PREFERENCES & PRIVACY</span>
            <h1>设置</h1>
            <p>
              所有 API
              密钥只能配置在服务端环境变量中，本页面不会要求或保存密钥。
            </p>
          </div>
        </div>
        <div className="settings-grid">
          <article className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">PROFILE</span>
                <h2>学习目标</h2>
              </div>
            </div>
            <div className="form-grid">
              <label>
                称呼
                <input
                  value={settings.displayName}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      displayName: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                目标分数
                <select
                  value={settings.targetBand}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      targetBand: Number(event.target.value),
                    })
                  }
                >
                  {[5, 5.5, 6, 6.5, 7, 7.5, 8].map((band) => (
                    <option key={band}>{band}</option>
                  ))}
                </select>
              </label>
              <label>
                考试日期
                <input
                  type="date"
                  value={settings.examDate}
                  onChange={(event) =>
                    setSettings({ ...settings, examDate: event.target.value })
                  }
                />
              </label>
              <label>
                日常练习固定声音
                <select
                  value={settings.practiceVoiceId}
                  onChange={(event) =>
                    selectPracticeVoice(event.target.value as ExaminerVoiceId)
                  }
                >
                  {EXAMINER_VOICE_PRESETS.map((voice) => (
                    <option value={voice.id} key={voice.id}>
                      {ACCENT_LABELS[voice.accent]} · {voice.genderPresentation === "female" ? "女声" : "男声"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </article>
          <article className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">AI PROVIDER</span>
                <h2>语音与评分服务</h2>
              </div>
              <Icon name="spark" />
            </div>
            <div className="provider-cards">
              <button
                className={settings.provider === "mock" ? "active" : ""}
                onClick={() => setSettings({ ...settings, provider: "mock" })}
              >
                <strong>Mock / 浏览器模式</strong>
                <span>无需密钥，可完整预览流程；发音评分低置信度。</span>
                <i>{settings.provider === "mock" && <Icon name="check" />}</i>
              </button>
              <button
                className={settings.provider === "openai" ? "active" : ""}
                onClick={() => setSettings({ ...settings, provider: "openai" })}
              >
                <strong>OpenAI 服务端模式</strong>
                <span>使用服务端环境变量；录音会发送用于转写。</span>
                <i>{settings.provider === "openai" && <Icon name="check" />}</i>
              </button>
            </div>
            <button
              className="secondary wide"
              onClick={() => void checkProvider()}
            >
              检测当前服务
            </button>
          </article>
          <article className="panel random-examiner-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">FULL MOCK EXAM</span>
                <h2>随机考官</h2>
              </div>
              <Icon name="refresh" />
            </div>
            <label className="toggle-row">
              <span>
                <strong>每场新模拟随机分配</strong>
                <small>同一场考试及恢复考试时保持完全一致</small>
              </span>
              <input
                type="checkbox"
                checked={settings.randomExaminer}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    randomExaminer: event.target.checked,
                  })
                }
              />
              <i />
            </label>
            <label>
              随机范围
              <select
                value={settings.randomAccentMode}
                disabled={!settings.randomExaminer}
                onChange={(event) => {
                  const mode = event.target.value as UserSettings["randomAccentMode"];
                  setSettings({
                    ...settings,
                    randomAccentMode: mode,
                    excludedAccents:
                      mode === "british"
                        ? settings.excludedAccents.filter(
                            (accent) => accent !== "en-GB",
                          )
                        : settings.excludedAccents,
                  });
                }}
              >
                <option value="all">随机全部可用口音</option>
                <option value="familiar">只随机熟悉口音（英式 / 北美）</option>
                <option value="british">固定标准英式口音</option>
              </select>
            </label>
            <fieldset className="accent-exclusions" disabled={!settings.randomExaminer}>
              <legend>排除口音</legend>
              {(Object.entries(ACCENT_LABELS) as [ExaminerAccent, string][]).map(
                ([accent, label]) => (
                  <label key={accent}>
                    <input
                      type="checkbox"
                      checked={settings.excludedAccents.includes(accent)}
                      disabled={
                        settings.randomAccentMode === "british" &&
                        accent === "en-GB"
                      }
                      onChange={() => toggleExcludedAccent(accent)}
                    />
                    <span>{label}</span>
                  </label>
                ),
              )}
            </fieldset>
            <p className="settings-hint">
              系统只从当前 provider 或设备真正可用的高质量声音中抽取，并降低最近三场重复组合的概率。人物外观与口音独立选择。
            </p>
          </article>
          <article className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">PRIVACY</span>
                <h2>录音与转写</h2>
              </div>
              <Icon name="shield" />
            </div>
            <label className="toggle-row">
              <span>
                <strong>保存录音到本机</strong>
                <small>默认关闭；开启后使用 IndexedDB 保存</small>
              </span>
              <input
                type="checkbox"
                checked={settings.saveRecordings}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    saveRecordings: event.target.checked,
                  })
                }
              />
              <i />
            </label>
            <label className="toggle-row">
              <span>
                <strong>练习时显示实时转写</strong>
                <small>全真考试期间始终隐藏</small>
              </span>
              <input
                type="checkbox"
                checked={settings.liveTranscript}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    liveTranscript: event.target.checked,
                  })
                }
              />
              <i />
            </label>
            <div className="privacy-note">
              <Icon name="shield" />
              <span>
                不收集身份证件。身份检查只模拟考试流程。关闭保存录音后，新录音不会写入持久存储。
              </span>
            </div>
          </article>
          <article className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">APPEARANCE</span>
                <h2>显示与练习语速</h2>
              </div>
            </div>
            <label>
              显示模式
              <select
                value={settings.theme}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    theme: event.target.value as UserSettings["theme"],
                  })
                }
              >
                <option value="system">跟随系统</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </label>
            <label>
              日常练习考官语速
              <select
                value={settings.speechRate}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    speechRate: Number(event.target.value),
                  })
                }
              >
                <option value={0.85}>慢速 0.85×</option>
                <option value={1}>标准 1.0×</option>
                <option value={1.1}>较快 1.1×</option>
              </select>
            </label>
            <div className="settings-actions">
              <button className="secondary" onClick={() => void testSpeaker()}>
                <Icon name="volume" />
                试听语音
              </button>
              <button className="ghost" onClick={releaseMic}>
                释放麦克风
              </button>
            </div>
          </article>
          <article className="panel voice-library-panel">
            <VoiceSettings
              options={voiceOptions}
              selectedId={settings.practiceVoiceId}
              provider={settings.provider}
              previewingId={previewingVoiceId}
              onSelect={selectPracticeVoice}
              onPreview={(voiceId) => void previewVoice(voiceId)}
            />
          </article>
        </div>
        {(error || notice) && (
          <div
            className={
              error
                ? "alert error floating-alert"
                : "alert success floating-alert"
            }
          >
            <Icon name={error ? "warning" : "check"} />
            <span>{error || notice}</span>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo-mark">V</span>
          <div>
            <strong>Vocalis</strong>
            <small>IELTS Speaking</small>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={screen === item.id ? "active" : ""}
              onClick={() => setScreen(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "history" && history.length > 0 && (
                <b>{history.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div
            className="goal-ring"
            style={
              {
                "--progress": `${Math.min(100, ((latest?.overall || 0) / settings.targetBand) * 100)}%`,
              } as React.CSSProperties
            }
          >
            <div>
              <strong>{latest?.overall.toFixed(1) || "—"}</strong>
              <small>/ {settings.targetBand.toFixed(1)}</small>
            </div>
          </div>
          <p>
            <strong>目标进度</strong>
            <span>
              {settings.examDate
                ? `距考试 ${Math.max(0, Math.ceil((new Date(settings.examDate).getTime() - SESSION_NOW) / 86400000))} 天`
                : "尚未设置考试日期"}
            </span>
          </p>
        </div>
      </aside>
      <div className="main-column">
        <header className="top-header">
          <div className="mobile-brand">
            <span className="logo-mark">V</span>
            <strong>Vocalis</strong>
          </div>
          <div className="connection">
            <i className={online ? "online" : "offline"} />
            {online ? "在线" : "离线"} ·{" "}
            {settings.provider === "mock" ? "Mock" : "OpenAI"}
          </div>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="切换明暗模式"
              onClick={() =>
                setSettings({
                  ...settings,
                  theme: settings.theme === "dark" ? "light" : "dark",
                })
              }
            >
              <Icon name={settings.theme === "dark" ? "sun" : "moon"} />
            </button>
            <div className="user-chip">
              <span>
                {settings.displayName.slice(0, 1).toUpperCase() || "L"}
              </span>
              <div>
                <strong>{settings.displayName || "Learner"}</strong>
                <small>目标 {settings.targetBand.toFixed(1)}</small>
              </div>
            </div>
          </div>
        </header>
        <main className="content">{renderMain()}</main>
        <nav className="mobile-nav">
          {navItems.slice(0, 4).map((item) => (
            <button
              key={item.id}
              className={screen === item.id ? "active" : ""}
              onClick={() => setScreen(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
