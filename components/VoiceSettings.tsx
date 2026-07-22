"use client";

import type { ExaminerVoiceId } from "@/lib/core.mjs";
import type { BrowserVoiceOption } from "@/lib/examiner-voices";
import type { ProviderMode } from "@/lib/types";
import { Icon } from "./Icons";

export function VoiceSettings({
  options,
  selectedId,
  provider,
  previewingId,
  onSelect,
  onPreview,
}: {
  options: BrowserVoiceOption[];
  selectedId: ExaminerVoiceId;
  provider: ProviderMode;
  previewingId: ExaminerVoiceId | null;
  onSelect: (voiceId: ExaminerVoiceId) => void;
  onPreview: (voiceId: ExaminerVoiceId) => void;
}) {
  const remote = provider === "openai";
  return (
    <div className="voice-settings">
      <div className="voice-settings-intro">
        <div>
          <span className="eyebrow">EXAMINER VOICES</span>
          <h3>考官声音选择与试听</h3>
        </div>
        <p>
          所有声音使用同一段文本比较。
          {provider === "openai"
            ? "真实 AI 模式会优先使用服务端高质量语音；不可用时自动回退到这里显示的 Chrome 英语语音。"
            : "当前使用 Chrome Speech Synthesis，并显式选择声音，不再使用系统默认声音。"}
        </p>
      </div>
      <div className="voice-option-grid">
        {options.map((option) => (
          <article
            className={`voice-option ${selectedId === option.id ? "selected" : ""}`}
            key={option.id}
          >
            <label>
              <input
                type="radio"
                name="examiner-voice"
                checked={selectedId === option.id}
                disabled={!option.enabled}
                onChange={() => onSelect(option.id)}
              />
              <span className="voice-radio" aria-hidden="true" />
              <span className="voice-copy">
                <strong>{option.accentLabel}</strong>
                <span>
                  {option.verifiedGenderPresentation === "female"
                    ? "已验证女声"
                    : option.verifiedGenderPresentation === "male"
                      ? "已验证男声"
                      : "未验证性别"} ·{" "}
                  {remote ? "服务端自然语音" : option.resolvedName}
                </span>
              </span>
            </label>
            <div className="voice-meta">
              <span>{remote ? "OpenAI TTS" : option.providerLabel}</span>
              <span>
                {remote
                  ? `本地回退：${option.resolvedName}`
                  : option.localService
                    ? "本地声音"
                    : "系统/网络声音"}
              </span>
              <span
                className={
                  remote || option.available
                    ? "voice-available"
                    : "voice-fallback"
                }
              >
                {!option.enabled
                  ? "已停用"
                  : remote
                  ? "服务端可用"
                  : option.available
                    ? "当前可用"
                    : "将自动回退"}
              </span>
            </div>
            <button
              className="voice-preview"
              onClick={() => onPreview(option.id)}
              disabled={
                !option.enabled || previewingId === option.id ||
                (!remote && option.quality === "unavailable")
              }
            >
              <Icon name={previewingId === option.id ? "clock" : "volume"} />
              {previewingId === option.id ? "正在播放" : "试听"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
