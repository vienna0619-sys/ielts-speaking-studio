import "server-only";
import OpenAI from "openai";
import type { SpeechCreateParams } from "openai/resources/audio/speech";
import { z } from "zod";

const API_BASE =
  process.env.OPENAI_API_BASE?.replace(/\/$/, "") ||
  "https://api.openai.com/v1";

export class ProviderError extends Error {
  status: number;
  code: string;
  requestId?: string;

  constructor(message: string, status = 502, code = "provider_error", requestId?: string) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key)
    throw new ProviderError(
      "OpenAI provider is not configured on the server.",
      503,
    );
  return key;
}

let openAiClient: OpenAI | null = null;

function client() {
  if (!openAiClient) {
    openAiClient = new OpenAI({
      apiKey: apiKey(),
      baseURL: API_BASE,
      maxRetries: 2,
      timeout: 75_000,
    });
  }
  return openAiClient;
}

function mapOpenAiError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof SyntaxError || error instanceof z.ZodError)
    return new ProviderError(
      "The scoring response did not match the required report structure.",
      502,
      "invalid_response",
    );
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 502;
    const rawCode = typeof error.code === "string" ? error.code : "openai_error";
    const code =
      status === 401 ? "invalid_api_key" :
      status === 403 ? "project_permission_denied" :
      status === 404 ? "model_or_route_not_found" :
      status === 429 && rawCode.includes("quota") ? "insufficient_quota" :
      status === 429 ? "rate_limited" :
      status >= 500 ? "openai_temporary_error" : rawCode;
    return new ProviderError(error.message, status, code, error.requestID ?? undefined);
  }
  if (error instanceof Error && error.name === "AbortError")
    return new ProviderError("OpenAI request timed out.", 504, "timeout");
  return new ProviderError("Unable to reach OpenAI.", 502, "network_error");
}

function logProviderEvent(details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production" || process.env.AI_DEBUG_LOGS === "1")
    console.info("[openai-provider]", details);
}

export interface AiProvider {
  transcribe(audio: File): Promise<string>;
  synthesize(
    text: string,
    options: { accent: string; voiceId: string; rate: number },
  ): Promise<ArrayBuffer>;
  evaluate(payload: unknown): Promise<unknown>;
  health(): Promise<{ configured: boolean; provider: string }>;
  diagnose(): Promise<{ configured: boolean; connected: boolean; provider: string; model: string; elapsedMs: number; requestId?: string }>;
}

function configuredTtsVoice(voiceId: string) {
  const environmentNames: Record<string, string> = {
    "gb-female": "OPENAI_TTS_VOICE_GB_FEMALE",
    "gb-male": "OPENAI_TTS_VOICE_GB_MALE",
    "us-female": "OPENAI_TTS_VOICE_US_FEMALE",
    "us-male": "OPENAI_TTS_VOICE_US_MALE",
    "au-female": "OPENAI_TTS_VOICE_AU_FEMALE",
    "au-male": "OPENAI_TTS_VOICE_AU_MALE",
    "in-female": "OPENAI_TTS_VOICE_IN_FEMALE",
    "in-male": "OPENAI_TTS_VOICE_IN_MALE",
  };
  const configured = environmentNames[voiceId]
    ? process.env[environmentNames[voiceId]]
    : undefined;
  if (configured) return configured;
  if (process.env.OPENAI_TTS_VOICE) return process.env.OPENAI_TTS_VOICE;
  return voiceId.endsWith("-male") ? "cedar" : "marin";
}

function examinerSpeechInstruction(accent: string) {
  const accentInstruction =
    accent === "en-US"
      ? "Use clear, natural North American English."
      : accent === "en-AU"
        ? "Use clear, natural Australian English."
        : accent === "en-IN"
          ? "Use clear, natural Indian English without caricature or exaggeration."
          : "Use clear, natural standard British English.";
  return `${accentInstruction} Speak like a calm, alert, courteous adult language examiner. Keep a neutral professional tone and a natural conversational pace. Avoid a hoarse, elderly, breathy, strained, theatrical, announcer-like, or overly cheerful delivery.`;
}

function extractOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string") return data.output_text;
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const block of content) {
      if (
        block &&
        typeof block === "object" &&
        typeof (block as { text?: unknown }).text === "string"
      ) {
        return (block as { text: string }).text;
      }
    }
  }
  throw new ProviderError(
    "The scoring model returned no readable output.",
    502,
  );
}

const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "overall",
    "range",
    "dimensions",
    "corrections",
    "bestPoints",
    "priorities",
    "nextGoal",
    "recommendedPart",
    "recommendedTopic",
    "expressions",
    "drill",
    "improvedAnswers",
  ],
  properties: {
    overall: { type: "number", minimum: 1, maximum: 9, multipleOf: 0.5 },
    range: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: { type: "number" },
    },
    dimensions: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "key",
          "label",
          "band",
          "range",
          "confidence",
          "explanation",
          "evidence",
          "priority",
        ],
        properties: {
          key: {
            type: "string",
            enum: ["fluency", "lexical", "grammar", "pronunciation"],
          },
          label: { type: "string" },
          band: { type: "number", minimum: 1, maximum: 9, multipleOf: 0.5 },
          range: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: { type: "number" },
          },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          explanation: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          priority: { type: "string" },
        },
      },
    },
    corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "original",
          "suggestion",
          "type",
          "explanationZh",
          "naturalVersion",
          "affectsUnderstanding",
          "dimension",
          "practice",
          "certainty",
        ],
        properties: {
          original: { type: "string" },
          suggestion: { type: "string" },
          type: { type: "string" },
          explanationZh: { type: "string" },
          naturalVersion: { type: "string" },
          affectsUnderstanding: { type: "boolean" },
          dimension: { type: "string" },
          practice: { type: "string" },
          certainty: {
            type: "string",
            enum: ["error", "acceptable", "upgrade", "style"],
          },
        },
      },
    },
    bestPoints: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
    },
    priorities: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
    },
    nextGoal: { type: "string" },
    recommendedPart: { type: "string" },
    recommendedTopic: { type: "string" },
    expressions: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: { type: "string" },
    },
    drill: { type: "string" },
    improvedAnswers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["part", "answer", "phrases"],
        properties: {
          part: { type: "integer", minimum: 1, maximum: 3 },
          answer: { type: "string" },
          phrases: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

const band = z.number().min(1).max(9).refine((value) => value * 2 === Math.round(value * 2));
const bandRange = z.tuple([z.number(), z.number()]);
const scoringReportValidator = z.object({
  overall: band,
  range: bandRange,
  dimensions: z.array(z.object({
    key: z.enum(["fluency", "lexical", "grammar", "pronunciation"]),
    label: z.string().min(1),
    band,
    range: bandRange,
    confidence: z.enum(["low", "medium", "high"]),
    explanation: z.string().min(1),
    evidence: z.array(z.string()),
    priority: z.string().min(1),
  }).strict()).length(4),
  corrections: z.array(z.object({
    original: z.string(),
    suggestion: z.string(),
    type: z.string(),
    explanationZh: z.string(),
    naturalVersion: z.string(),
    affectsUnderstanding: z.boolean(),
    dimension: z.string(),
    practice: z.string(),
    certainty: z.enum(["error", "acceptable", "upgrade", "style"]),
  }).strict()),
  bestPoints: z.array(z.string()).length(3),
  priorities: z.array(z.string()).length(3),
  nextGoal: z.string().min(1),
  recommendedPart: z.string().min(1),
  recommendedTopic: z.string().min(1),
  expressions: z.array(z.string()).length(5),
  drill: z.string().min(1),
  improvedAnswers: z.array(z.object({
    part: z.number().int().min(1).max(3),
    answer: z.string(),
    phrases: z.array(z.string()),
  }).strict()),
}).strict();

export const openAiProvider: AiProvider = {
  async transcribe(audio) {
    const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
    const startedAt = Date.now();
    try {
      const data = await client().audio.transcriptions.create({
        file: audio,
        model,
        language: "en",
        response_format: "json",
      });
      if (!data.text?.trim())
        throw new ProviderError("Transcription returned no text.", 422, "empty_transcript");
      logProviderEvent({ route: "audio.transcriptions", model, status: 200, elapsedMs: Date.now() - startedAt });
      return data.text;
    } catch (error) {
      const mapped = mapOpenAiError(error);
      logProviderEvent({ route: "audio.transcriptions", model, status: mapped.status, code: mapped.code, requestId: mapped.requestId, elapsedMs: Date.now() - startedAt });
      throw mapped;
    }
  },

  async synthesize(text, options) {
    const model = process.env.OPENAI_TTS_MODEL || "gpt-audio-1.5";
    const startedAt = Date.now();
    try {
      const voice = configuredTtsVoice(options.voiceId);
      if (model.startsWith("gpt-audio")) {
        const pace = Math.max(0.85, Math.min(1.12, options.rate || 1));
        const response = await client().chat.completions.create({
          model,
          modalities: ["text", "audio"],
          audio: { voice, format: "mp3" },
          messages: [
            {
              role: "system",
              content: `${examinerSpeechInstruction(options.accent)} Use a natural pace near ${pace.toFixed(2)}x. Speak the supplied examiner line exactly, without adding an introduction, explanation, or closing.`,
            },
            { role: "user", content: text },
          ],
        });
        const encoded = response.choices[0]?.message.audio?.data;
        if (!encoded)
          throw new ProviderError("The audio model returned no playable audio.", 502, "empty_audio_response");
        const bytes = Buffer.from(encoded, "base64");
        logProviderEvent({ route: "chat.completions.audio", model, status: 200, voiceProfileId: options.voiceId, elapsedMs: Date.now() - startedAt });
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      }
      const response = await client().audio.speech.create({
        model,
        voice: voice as SpeechCreateParams["voice"],
        input: text,
        instructions: examinerSpeechInstruction(options.accent),
        speed: Math.max(0.85, Math.min(1.12, options.rate || 1)),
        response_format: "mp3",
      });
      logProviderEvent({ route: "audio.speech", model, status: 200, voiceProfileId: options.voiceId, elapsedMs: Date.now() - startedAt });
      return response.arrayBuffer();
    } catch (error) {
      const mapped = mapOpenAiError(error);
      logProviderEvent({ route: "audio.speech", model, status: mapped.status, code: mapped.code, requestId: mapped.requestId, voiceProfileId: options.voiceId, elapsedMs: Date.now() - startedAt });
      throw mapped;
    }
  },

  async evaluate(payload) {
    const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-terra";
    const startedAt = Date.now();
    const idempotencyKey =
      payload && typeof payload === "object" && "idempotencyKey" in payload
        ? String((payload as { idempotencyKey?: unknown }).idempotencyKey || "")
        : "";
    try {
      const response = await client().responses.create({
          model,
          store: false,
          input: [
            {
              role: "system",
              content:
                "You are a cautious IELTS speaking practice evaluator. Apply the four public IELTS speaking criteria equally. Never claim this is an official score. Use Chinese for explanations and natural English for corrected or improved answers. Do not treat all informal spoken language as an error. Separate definite errors, acceptable-but-less-natural wording, upgrades, and style. Pronunciation claims must remain low confidence because only transcripts and timing features are provided; do not invent phoneme-level evidence. Preserve the learner's meaning and make improved answers only 0.5 to 1 band stronger, not Band 9 scripts.",
            },
            {
              role: "user",
              content: `Evaluate this practice session. Evidence:\n${JSON.stringify(payload)}`,
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "ielts_speaking_report",
              strict: true,
              schema: reportSchema,
            },
          },
        }, idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined);
      const parsed = scoringReportValidator.parse(
        JSON.parse(extractOutputText(response as unknown as Record<string, unknown>)),
      );
      logProviderEvent({ route: "responses.evaluate", model, status: 200, requestId: response._request_id, elapsedMs: Date.now() - startedAt });
      return parsed;
    } catch (error) {
      const mapped = mapOpenAiError(error);
      logProviderEvent({ route: "responses.evaluate", model, status: mapped.status, code: mapped.code, requestId: mapped.requestId, elapsedMs: Date.now() - startedAt });
      throw mapped;
    }
  },

  async health() {
    return {
      configured: Boolean(process.env.OPENAI_API_KEY),
      provider: "openai",
    };
  },

  async diagnose() {
    const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-terra";
    const startedAt = Date.now();
    if (!process.env.OPENAI_API_KEY)
      throw new ProviderError("OpenAI provider is not configured on the server.", 503, "missing_api_key");
    try {
      const response = await client().responses.create({
        model,
        store: false,
        input: "Reply with only OK.",
        max_output_tokens: 8,
      });
      const output = response.output_text.trim().toUpperCase();
      if (!output.includes("OK"))
        throw new ProviderError("OpenAI returned an unexpected diagnostic response.", 502, "invalid_diagnostic_response");
      return {
        configured: true,
        connected: true,
        provider: "openai",
        model,
        elapsedMs: Date.now() - startedAt,
        requestId: response._request_id ?? undefined,
      };
    } catch (error) {
      throw mapOpenAiError(error);
    }
  },
};
