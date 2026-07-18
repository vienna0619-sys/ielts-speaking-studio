"use client";

import { microphoneErrorMessage, providerErrorStatus } from "./core.mjs";
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

export async function createMicrophoneSession(onLevel: (level: number) => void): Promise<MicrophoneSession> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
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
  const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  const startedAt = performance.now();
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.start(250);

  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  const recognition = Recognition ? new Recognition() : null;
  let finalText = "";
  let interimText = "";
  if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = accent;
    recognition.onresult = (event) => {
      interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
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
          const durationSec = Math.max(1, Math.round((performance.now() - startedAt) / 1000));
          resolve({
            blob: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
            text: `${finalText}${interimText}`.trim(),
            durationSec,
          });
        };
        recorder.addEventListener("stop", finish, { once: true });
        recorder.addEventListener("error", () => reject(new Error("录音失败，请检查麦克风连接。")), { once: true });
        if (recorder.state === "inactive") finish();
        else recorder.stop();
      }),
  };
}

export function speakBrowser(
  text: string,
  accent: Accent,
  rate: number,
  onActivity?: (active: boolean) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window)) {
      reject(new Error("当前浏览器不支持语音播放，请使用最新版 Chrome。"));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = accent;
    utterance.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith(accent.toLowerCase()))
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(accent.slice(0, 2).toLowerCase()))
      ?? null;
    utterance.onstart = () => onActivity?.(true);
    utterance.onend = () => {
      onActivity?.(false);
      resolve();
    };
    utterance.onerror = () => {
      onActivity?.(false);
      reject(new Error("考官语音播放失败，请检查扬声器后重试。"));
    };
    window.speechSynthesis.speak(utterance);
  });
}

export async function speakExaminer(
  text: string,
  options: { provider: ProviderMode; accent: Accent; rate: number; onActivity?: (active: boolean) => void },
): Promise<void> {
  if (options.provider === "mock") return speakBrowser(text, options.accent, options.rate, options.onActivity);
  options.onActivity?.(true);
  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "speech", text, accent: options.accent, rate: options.rate }),
    });
    if (!response.ok) throw new Error(providerErrorStatus(response.status));
    const audio = new Audio(URL.createObjectURL(await response.blob()));
    await audio.play();
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("AI 语音播放失败。"));
    });
  } finally {
    options.onActivity?.(false);
  }
}

export async function transcribeWithProvider(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("operation", "transcribe");
  form.append("audio", blob, blob.type.includes("mp4") ? "answer.mp4" : "answer.webm");
  const response = await fetch("/api/ai", { method: "POST", body: form });
  if (!response.ok) throw new Error(providerErrorStatus(response.status));
  const data = (await response.json()) as { text?: string };
  return data.text?.trim() ?? "";
}
