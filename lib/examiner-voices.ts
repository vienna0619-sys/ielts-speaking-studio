"use client";

import {
  EXAMINER_VOICE_PRESETS,
  type ExaminerAccent,
  type ExaminerVoiceId,
  type ExaminerVoicePreset,
} from "./core.mjs";

export const VOICE_SAMPLE_TEXT =
  "Good morning. My name is Alex, and I will be your examiner today. Can you tell me your full name, please?";

export const ACCENT_LABELS: Record<ExaminerAccent, string> = {
  "en-GB": "标准英式英语",
  "en-US": "北美英语",
  "en-AU": "澳大利亚英语",
  "en-IN": "印度英语",
};

const PREFERRED_NAMES: Record<ExaminerVoiceId, string[]> = {
  "gb-female": [
    "Microsoft Sonia Online",
    "Google UK English Female",
    "Serena",
    "Martha",
    "Kate",
    "Stephanie",
  ],
  "gb-male": [
    "Microsoft Ryan Online",
    "Google UK English Male",
    "Daniel",
    "Arthur",
    "Oliver",
  ],
  "us-female": [
    "Microsoft Aria Online",
    "Google US English",
    "Samantha",
    "Ava",
    "Allison",
    "Zoe",
    "Joelle",
  ],
  "us-male": ["Microsoft Guy Online", "Aaron", "Nathan", "Evan", "Tom", "Alex"],
  "au-female": ["Microsoft Natasha Online", "Karen", "Catherine", "Lee"],
  "au-male": ["Microsoft William Online", "Gordon", "Russell", "Jack"],
  "in-female": ["Microsoft Neerja Online", "Veena", "Lekha"],
  "in-male": ["Microsoft Prabhat Online", "Rishi"],
};

const NATURAL_MARKERS = [
  "natural",
  "neural",
  "online",
  "premium",
  "enhanced",
  "google",
  "microsoft",
];
const NOVELTY_MARKERS = [
  "albert",
  "bad news",
  "bahh",
  "bells",
  "boing",
  "bubbles",
  "cellos",
  "deranged",
  "fred",
  "good news",
  "hysterical",
  "jester",
  "junior",
  "organ",
  "princess",
  "ralph",
  "trinoids",
  "whisper",
  "zarvox",
  "espeak",
];

export interface ResolvedBrowserVoice {
  preset: ExaminerVoicePreset;
  voice: SpeechSynthesisVoice;
  fallbackUsed: boolean;
  exactLocale: boolean;
  quality: "high" | "standard" | "fallback";
  message: string;
}

export interface BrowserVoiceOption {
  id: ExaminerVoiceId;
  label: string;
  accent: ExaminerAccent;
  accentLabel: string;
  genderPresentation: "female" | "male";
  verifiedGenderPresentation: "female" | "male" | null;
  enabled: boolean;
  qualityStatus: ExaminerVoicePreset["qualityStatus"];
  available: boolean;
  resolvedName: string;
  resolvedLang: string;
  providerLabel: string;
  localService: boolean;
  quality: "high" | "standard" | "fallback" | "unavailable";
  fallbackUsed: boolean;
  statusMessage: string;
}

function normalizedLocale(value: string) {
  return value.replace("_", "-").toLowerCase();
}

function voiceText(voice: SpeechSynthesisVoice) {
  return `${voice.name} ${voice.voiceURI}`.toLowerCase();
}

function preferredNameIndex(
  voice: SpeechSynthesisVoice,
  preset: ExaminerVoicePreset,
) {
  const haystack = voiceText(voice);
  return PREFERRED_NAMES[preset.id].findIndex((name) =>
    haystack.includes(name.toLowerCase()),
  );
}

function isNoveltyVoice(voice: SpeechSynthesisVoice) {
  const haystack = voiceText(voice);
  return NOVELTY_MARKERS.some((marker) => haystack.includes(marker));
}

function scoreVoice(voice: SpeechSynthesisVoice, preset: ExaminerVoicePreset) {
  const locale = normalizedLocale(voice.lang);
  const requested = normalizedLocale(preset.locale);
  const text = voiceText(voice);
  const preferredIndex = preferredNameIndex(voice, preset);
  let score =
    locale === requested
      ? 120
      : locale.startsWith(requested.slice(0, 2))
        ? 25
        : -200;
  if (preferredIndex >= 0) score += 180 - preferredIndex * 8;
  if (NATURAL_MARKERS.some((marker) => text.includes(marker))) score += 35;
  if (voice.localService) score += 14;
  if (voice.default) score -= 8;
  if (isNoveltyVoice(voice)) score -= 500;
  return score;
}

function bestForPreset(
  voices: SpeechSynthesisVoice[],
  preset: ExaminerVoicePreset,
  exactLocaleOnly = true,
) {
  const requested = normalizedLocale(preset.locale);
  const candidates = voices
      .filter((voice) => !isNoveltyVoice(voice))
      .filter((voice) =>
        exactLocaleOnly
          ? normalizedLocale(voice.lang) === requested
          : normalizedLocale(voice.lang).startsWith("en"),
      )
      .sort((a, b) => scoreVoice(b, preset) - scoreVoice(a, preset));
  // Browser voices do not expose gender metadata. Formal options therefore
  // use only names that have been explicitly reviewed for the requested
  // presentation; an arbitrary same-locale default is not labelled as male or
  // female. Disabled/unverified presets are never admitted to the exam pool.
  if (preset.qualityStatus === "verified") {
    return candidates.find((voice) => preferredNameIndex(voice, preset) >= 0) ?? null;
  }
  return candidates[0] ?? null;
}

function qualityFor(
  voice: SpeechSynthesisVoice,
  preset: ExaminerVoicePreset,
  exactLocale: boolean,
): ResolvedBrowserVoice["quality"] {
  if (!exactLocale) return "fallback";
  const preferred = preferredNameIndex(voice, preset) >= 0;
  const natural = NATURAL_MARKERS.some((marker) =>
    voiceText(voice).includes(marker),
  );
  return preferred || natural || voice.localService ? "high" : "standard";
}

export function getVoicePreset(voiceId: ExaminerVoiceId): ExaminerVoicePreset {
  return (
    EXAMINER_VOICE_PRESETS.find((preset) => preset.id === voiceId) ??
    EXAMINER_VOICE_PRESETS[0]
  );
}

export function resolveBrowserVoice(
  voiceId: ExaminerVoiceId,
  voices: SpeechSynthesisVoice[],
): ResolvedBrowserVoice | null {
  const preset = getVoicePreset(voiceId);
  const verifiedSameGender = (candidate: ExaminerVoicePreset) =>
    candidate.enabled &&
    candidate.qualityStatus === "verified" &&
    candidate.verifiedGenderPresentation ===
      candidate.genderPresentation &&
    candidate.genderPresentation === preset.genderPresentation;
  let resolvedPreset =
    (verifiedSameGender(preset) ? preset : null) ||
    EXAMINER_VOICE_PRESETS.find(
      (candidate) =>
        candidate.id === preset.fallbackVoiceId &&
        verifiedSameGender(candidate),
    ) ||
    EXAMINER_VOICE_PRESETS.find(
      (candidate) =>
        candidate.accent === "en-GB" && verifiedSameGender(candidate),
    ) ||
    EXAMINER_VOICE_PRESETS.find(verifiedSameGender);
  if (!resolvedPreset) return null;
  let voice = bestForPreset(voices, resolvedPreset, true);

  if (!voice) {
    const regionalBackup = EXAMINER_VOICE_PRESETS.find(
      (candidate) =>
        candidate.id === preset.fallbackVoiceId &&
        verifiedSameGender(candidate),
    );
    if (regionalBackup) {
      voice = bestForPreset(voices, regionalBackup, true);
      resolvedPreset = regionalBackup;
    }
  }
  if (!voice) {
    const britishSameStyle = EXAMINER_VOICE_PRESETS.find(
      (candidate) =>
        candidate.accent === "en-GB" &&
        verifiedSameGender(candidate),
    );
    if (britishSameStyle) {
      voice = bestForPreset(voices, britishSameStyle, true);
      resolvedPreset = britishSameStyle;
    }
  }
  if (!voice) {
    const currentResolvedId = resolvedPreset.id;
    const anySameGender = EXAMINER_VOICE_PRESETS.find(
      (candidate) =>
        candidate.id !== currentResolvedId &&
        verifiedSameGender(candidate) &&
        Boolean(bestForPreset(voices, candidate, true)),
    );
    if (anySameGender) {
      voice = bestForPreset(voices, anySameGender, true);
      resolvedPreset = anySameGender;
    }
  }
  if (!voice) return null;

  const exactLocale =
    normalizedLocale(voice.lang) === normalizedLocale(preset.locale);
  const fallbackUsed = resolvedPreset.id !== preset.id || !exactLocale;
  const message = fallbackUsed || !preset.enabled
    ? `${preset.label} ${preset.enabled ? "在此设备上不可用" : "尚未通过质量验证"}，已自动改用 ${voice.name}（${voice.lang}）。`
    : `已使用 ${voice.name}（${voice.lang}）。`;
  return {
    preset,
    voice,
    fallbackUsed,
    exactLocale,
    quality: qualityFor(voice, preset, exactLocale),
    message,
  };
}

export function buildVoiceOptions(
  voices: SpeechSynthesisVoice[],
): BrowserVoiceOption[] {
  return EXAMINER_VOICE_PRESETS.map((preset) => {
    if (!preset.enabled || preset.qualityStatus !== "verified") {
      return {
        id: preset.id,
        label: preset.label,
        accent: preset.accent,
        accentLabel: ACCENT_LABELS[preset.accent],
        genderPresentation: preset.genderPresentation,
        verifiedGenderPresentation: preset.verifiedGenderPresentation,
        enabled: false,
        qualityStatus: preset.qualityStatus,
        available: false,
        resolvedName: "未启用",
        resolvedLang: preset.locale,
        providerLabel: "浏览器 Speech Synthesis",
        localService: false,
        quality: "unavailable",
        fallbackUsed: false,
        statusMessage: "该声音尚未通过真实性别、口音与流畅度验证，已从正式随机池停用。",
      };
    }
    const resolved = resolveBrowserVoice(preset.id, voices);
    if (!resolved) {
      return {
        id: preset.id,
        label: preset.label,
        accent: preset.accent,
        accentLabel: ACCENT_LABELS[preset.accent],
        genderPresentation: preset.genderPresentation,
        verifiedGenderPresentation: preset.verifiedGenderPresentation,
        enabled: true,
        qualityStatus: preset.qualityStatus,
        available: false,
        resolvedName: "未找到英语语音",
        resolvedLang: "—",
        providerLabel: "浏览器 Speech Synthesis",
        localService: false,
        quality: "unavailable",
        fallbackUsed: false,
        statusMessage: "当前 Chrome 没有返回可用的英语语音。",
      };
    }
    return {
      id: preset.id,
      label: preset.label,
      accent: preset.accent,
      accentLabel: ACCENT_LABELS[preset.accent],
      genderPresentation: preset.genderPresentation,
      verifiedGenderPresentation: preset.verifiedGenderPresentation,
      enabled: true,
      qualityStatus: preset.qualityStatus,
      available: resolved.exactLocale && resolved.quality !== "fallback",
      resolvedName: resolved.voice.name,
      resolvedLang: resolved.voice.lang,
      providerLabel: resolved.voice.localService
        ? "浏览器本地语音"
        : "浏览器网络语音",
      localService: resolved.voice.localService,
      quality: resolved.quality,
      fallbackUsed: resolved.fallbackUsed,
      statusMessage: resolved.message,
    };
  });
}

export function waitForBrowserVoices(
  timeoutMs = 1800,
): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const immediate = synth.getVoices();
    if (immediate.length) {
      resolve(immediate);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", changed);
      window.clearTimeout(timeout);
      resolve(synth.getVoices());
    };
    const changed = () => finish();
    const timeout = window.setTimeout(finish, timeoutMs);
    synth.addEventListener("voiceschanged", changed, { once: true });
  });
}

export function observeBrowserVoiceOptions(
  onChange: (options: BrowserVoiceOption[]) => void,
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onChange(buildVoiceOptions([]));
    return () => undefined;
  }
  const synth = window.speechSynthesis;
  let active = true;
  const refresh = async () => {
    const voices = await waitForBrowserVoices();
    if (active) onChange(buildVoiceOptions(voices));
  };
  const changed = () => {
    void refresh();
  };
  synth.addEventListener("voiceschanged", changed);
  void refresh();
  return () => {
    active = false;
    synth.removeEventListener("voiceschanged", changed);
  };
}
