"use client";

import { microphoneErrorMessage, providerErrorStatus } from "./core.mjs";
import type { ExaminerVoiceId } from "./core.mjs";
import { resolveBrowserVoice, waitForBrowserVoices } from "./examiner-voices";
import type { Accent, ProviderMode } from "./types";

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => RecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

export interface MicrophoneSession {
  stream: MediaStream;
  stop: () => void;
}

export interface RecordingController {
  stop: () => Promise<{ blob: Blob; text: string; durationSec: number }>;
  transcriptionSupported: boolean;
}

export type SpeechViseme = "rest" | "open" | "wide" | "round";
export type ExaminerSpeechState = "idle" | "thinking" | "speaking";

export interface ExaminerSpeechOptions {
  provider: ProviderMode;
  accent: Accent;
  voiceId: ExaminerVoiceId;
  rate: number;
  pitch?: number;
  volume?: number;
  onState?: (state: ExaminerSpeechState) => void;
  onLevel?: (level: number) => void;
  onViseme?: (viseme: SpeechViseme) => void;
  onFallback?: (message: string) => void;
}

export interface ExaminerSpeechProvider {
  speak(text: string, options: ExaminerSpeechOptions): Promise<void>;
  stop(): void;
}

let activeSpeechStop: (() => void) | null = null;

export function stopExaminerSpeech() {
  const stop = activeSpeechStop;
  activeSpeechStop = null;
  stop?.();
}

export async function createMicrophoneSession(
  onLevel: (level: number) => void,
): Promise<MicrophoneSession> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let animation = 0;
    const update = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }
      onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4.2));
      animation = requestAnimationFrame(update);
    };
    update();
    return {
      stream,
      stop: () => {
        cancelAnimationFrame(animation);
        stream.getTracks().forEach((track) => track.stop());
        void context.close();
        onLevel(0);
      },
    };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "UnknownError";
    throw new Error(microphoneErrorMessage(name));
  }
}

export function startRecording(
  stream: MediaStream,
  accent: Accent,
  onTranscript: (text: string, isFinal: boolean) => void,
): RecordingController {
  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
    (type) => MediaRecorder.isTypeSupported(type),
  );
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  );
  const chunks: BlobPart[] = [];
  const startedAt = performance.now();
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.start(250);

  const Recognition =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;
  const recognition = Recognition ? new Recognition() : null;
  let finalText = "";
  let interimText = "";
  if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = accent;
    recognition.onresult = (event) => {
      interimText = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        if (result.isFinal) finalText += `${result[0].transcript} `;
        else interimText += result[0].transcript;
      }
      onTranscript(`${finalText}${interimText}`.trim(), Boolean(finalText));
    };
    recognition.onerror = () => undefined;
    try {
      recognition.start();
    } catch {
      // Chrome can reject a duplicate recognition start; audio recording still remains valid.
    }
  }

  return {
    transcriptionSupported: Boolean(recognition),
    stop: () =>
      new Promise((resolve, reject) => {
        const finish = () => {
          try {
            recognition?.stop();
          } catch {
            recognition?.abort();
          }
          const durationSec = Math.max(
            1,
            Math.round((performance.now() - startedAt) / 1000),
          );
          resolve({
            blob: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
            text: `${finalText}${interimText}`.trim(),
            durationSec,
          });
        };
        recorder.addEventListener("stop", finish, { once: true });
        recorder.addEventListener(
          "error",
          () => reject(new Error("录音失败，请检查麦克风连接。")),
          { once: true },
        );
        if (recorder.state === "inactive") finish();
        else recorder.stop();
      }),
  };
}

function visemeForText(text: string): SpeechViseme {
  if (/[ouqw]/i.test(text)) return "round";
  if (/[eiiy]/i.test(text)) return "wide";
  return "open";
}

function createTextMouthDriver(
  text: string,
  rate: number,
  options: ExaminerSpeechOptions,
) {
  let animation = 0;
  let level = 0;
  let target = 0;
  let boundaryReceived = false;
  const timers = new Set<number>();

  const later = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };

  const setTarget = (nextLevel: number, nextViseme: SpeechViseme) => {
    target = Math.max(target, nextLevel);
    options.onViseme?.(nextViseme);
  };

  const driveWord = (word: string) => {
    const units = word.match(/[aeiouy]+|[^aeiouy]+/gi) ?? [word];
    const duration = Math.max(
      120,
      Math.min(440, (word.length * 54) / Math.max(0.75, rate)),
    );
    units.slice(0, 4).forEach((unit, index) => {
      later(
        () =>
          setTarget(
            0.38 + Math.min(0.48, unit.length * 0.11),
            visemeForText(unit),
          ),
        (duration / Math.max(1, units.length)) * index,
      );
    });
    later(() => {
      target *= 0.22;
    }, duration);
  };

  const frame = () => {
    level += (target - level) * (target > level ? 0.34 : 0.2);
    target *= 0.9;
    if (level < 0.025) {
      level = 0;
      options.onViseme?.("rest");
    }
    options.onLevel?.(Math.min(1, level));
    animation = requestAnimationFrame(frame);
  };

  return {
    start() {
      frame();
      later(() => {
        if (boundaryReceived) return;
        const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
        let offset = 0;
        words.slice(0, 90).forEach((word) => {
          later(() => driveWord(word), offset);
          offset += Math.max(
            145,
            (word.length * 55 + 70) / Math.max(0.75, rate),
          );
        });
      }, 420);
    },
    boundary(charIndex: number) {
      boundaryReceived = true;
      const word = text.slice(charIndex).match(/[A-Za-z]+(?:'[A-Za-z]+)?/)?.[0];
      if (word) driveWord(word);
    },
    pause() {
      target = 0;
      level = 0;
      options.onLevel?.(0);
      options.onViseme?.("rest");
    },
    stop() {
      cancelAnimationFrame(animation);
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      options.onLevel?.(0);
      options.onViseme?.("rest");
    },
  };
}

async function speakBrowser(
  text: string,
  options: ExaminerSpeechOptions,
): Promise<void> {
  stopExaminerSpeech();
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    throw new Error("当前浏览器不支持语音播放，请使用最新版 Chrome。");
  }
  const voices = await waitForBrowserVoices();
  const resolvedVoice = resolveBrowserVoice(options.voiceId, voices);
  if (!resolvedVoice)
    throw new Error("Chrome 没有返回可用的英语语音，请检查系统语音设置。");
  if (resolvedVoice.fallbackUsed) options.onFallback?.(resolvedVoice.message);

  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const driver = createTextMouthDriver(text, options.rate, options);
    let settled = false;
    let cancelled = false;
    const finish = (failure?: Error) => {
      if (settled) return;
      settled = true;
      driver.stop();
      options.onState?.("idle");
      if (activeSpeechStop === stop) activeSpeechStop = null;
      if (failure && !cancelled) reject(failure);
      else resolve();
    };
    const stop = () => {
      cancelled = true;
      synth.cancel();
      finish();
    };
    activeSpeechStop = stop;
    synth.cancel();
    utterance.lang = options.accent;
    utterance.voice = resolvedVoice.voice;
    utterance.rate = Math.max(0.82, Math.min(1.12, options.rate || 1));
    utterance.pitch = Math.max(0.96, Math.min(1.04, options.pitch ?? 1));
    utterance.volume = Math.max(0, Math.min(1, options.volume ?? 1));
    utterance.onstart = () => {
      options.onState?.("speaking");
      driver.start();
    };
    utterance.onboundary = (event) => driver.boundary(event.charIndex);
    utterance.onpause = () => {
      driver.pause();
      options.onState?.("idle");
    };
    utterance.onresume = () => options.onState?.("speaking");
    utterance.onend = () => finish();
    utterance.onerror = (event) => {
      if (event.error === "canceled" || event.error === "interrupted") finish();
      else finish(new Error("考官语音播放失败，请检查扬声器后重试。"));
    };
    synth.speak(utterance);
  });
}

function createAnalyserDriver(
  audio: HTMLAudioElement,
  options: ExaminerSpeechOptions,
) {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.74;
  const source = context.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(context.destination);
  const data = new Uint8Array(analyser.fftSize);
  let animation = 0;
  let smoothed = 0;
  let stopped = false;
  const frame = () => {
    if (stopped) return;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) {
      const normalized = (value - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.min(1, Math.sqrt(sum / data.length) * 5.8);
    smoothed += (rms - smoothed) * (rms > smoothed ? 0.38 : 0.16);
    options.onLevel?.(smoothed < 0.025 ? 0 : smoothed);
    options.onViseme?.(
      smoothed < 0.04
        ? "rest"
        : smoothed > 0.58
          ? "open"
          : smoothed > 0.3
            ? "wide"
            : "round",
    );
    animation = requestAnimationFrame(frame);
  };
  return {
    async start() {
      await context.resume();
      frame();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(animation);
      options.onLevel?.(0);
      options.onViseme?.("rest");
      void context.close();
    },
  };
}

async function speakRemote(
  text: string,
  options: ExaminerSpeechOptions,
): Promise<void> {
  stopExaminerSpeech();
  const controller = new AbortController();
  let audio: HTMLAudioElement | null = null;
  let objectUrl = "";
  let analyser: ReturnType<typeof createAnalyserDriver> | null = null;
  let cancelled = false;
  let settleStop: (() => void) | null = null;
  const stop = () => {
    cancelled = true;
    controller.abort();
    audio?.pause();
    if (audio) audio.currentTime = 0;
    analyser?.stop();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    options.onState?.("idle");
    settleStop?.();
  };
  activeSpeechStop = stop;
  options.onState?.("thinking");
  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        operation: "speech",
        text,
        accent: options.accent,
        voiceId: options.voiceId,
        rate: options.rate,
      }),
    });
    if (!response.ok) throw new Error(providerErrorStatus(response.status));
    if (cancelled) return;
    objectUrl = URL.createObjectURL(await response.blob());
    audio = new Audio(objectUrl);
    audio.preload = "auto";
    audio.volume = Math.max(0, Math.min(1, options.volume ?? 1));
    analyser = createAnalyserDriver(audio, options);
    await analyser.start();
    await new Promise<void>((resolve, reject) => {
      settleStop = resolve;
      if (!audio) {
        reject(new Error("AI 语音播放失败。"));
        return;
      }
      audio.onplaying = () => options.onState?.("speaking");
      audio.onpause = () => {
        options.onLevel?.(0);
        options.onViseme?.("rest");
        if (!audio?.ended && !cancelled) options.onState?.("idle");
      };
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("AI 语音播放失败。"));
      void audio
        .play()
        .catch(() =>
          reject(new Error("Chrome 阻止了语音播放，请点击页面后重试。")),
        );
    });
  } finally {
    analyser?.stop();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    options.onState?.("idle");
    if (activeSpeechStop === stop) activeSpeechStop = null;
  }
}

export const browserSpeechProvider: ExaminerSpeechProvider = {
  speak: speakBrowser,
  stop: stopExaminerSpeech,
};

export const remoteSpeechProvider: ExaminerSpeechProvider = {
  speak: speakRemote,
  stop: stopExaminerSpeech,
};

export async function speakExaminer(
  text: string,
  options: ExaminerSpeechOptions,
): Promise<void> {
  if (options.provider === "mock")
    return browserSpeechProvider.speak(text, options);
  try {
    await remoteSpeechProvider.speak(text, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    const message =
      error instanceof Error ? error.message : "AI 语音暂时不可用。";
    options.onFallback?.(`${message} 已自动切换到此设备上的英语语音。`);
    await browserSpeechProvider.speak(text, options);
  }
}

export async function transcribeWithProvider(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("operation", "transcribe");
  form.append(
    "audio",
    blob,
    blob.type.includes("mp4") ? "answer.mp4" : "answer.webm",
  );
  const response = await fetch("/api/ai", { method: "POST", body: form });
  if (!response.ok) throw new Error(providerErrorStatus(response.status));
  const data = (await response.json()) as { text?: string };
  return data.text?.trim() ?? "";
}
