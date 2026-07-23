import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const SCORING_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-terra";
const TRANSCRIPTION_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
const SPEECH_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";

export type ProviderFailureCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "permission_denied"
  | "insufficient_quota"
  | "rate_limited"
  | "model_unavailable"
  | "request_timeout"
  | "empty_transcript"
  | "invalid_json"
  | "schema_validation_failed"
  | "provider_error";

export class ProviderError extends Error {
  status: number;
  code: ProviderFailureCode;
  requestId?: string;
  retryable: boolean;

  constructor(
    message: string,
    status = 502,
    code: ProviderFailureCode = "provider_error",
    options: { requestId?: string; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.code = code;
    this.requestId = options.requestId;
    this.retryable =
      options.retryable ?? (status === 429 || status >= 500);
  }
}

function configuredApiKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new ProviderError(
      "OpenAI API key is not configured on the server.",
      503,
      "missing_api_key",
      { retryable: false },
    );
  }
  return key;
}

function client(timeout = 75_000) {
  return new OpenAI({
    apiKey: configuredApiKey(),
    timeout,
    maxRetries: 1,
  });
}

function sanitizeProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new ProviderError(
      "OpenAI request timed out.",
      504,
      "request_timeout",
      { retryable: true },
    );
  }
  if (error instanceof OpenAI.APIError) {
    const status = error.status || 502;
    const requestId = error.requestID || undefined;
    const providerCode =
      typeof error.code === "string" ? error.code.toLowerCase() : "";
    if (status === 401) {
      return new ProviderError(
        "The OpenAI API key is invalid or has been revoked.",
        401,
        "invalid_api_key",
        { requestId, retryable: false },
      );
    }
    if (status === 403) {
      return new ProviderError(
        "The OpenAI project does not have permission for this request.",
        403,
        "permission_denied",
        { requestId, retryable: false },
      );
    }
    if (status === 404 || providerCode.includes("model")) {
      return new ProviderError(
        "The configured OpenAI model is unavailable.",
        404,
        "model_unavailable",
        { requestId, retryable: false },
      );
    }
    if (status === 429 && providerCode.includes("quota")) {
      return new ProviderError(
        "The OpenAI API project has no available quota.",
        429,
        "insufficient_quota",
        { requestId, retryable: false },
      );
    }
    if (status === 429) {
      return new ProviderError(
        "OpenAI rate limit reached.",
        429,
        "rate_limited",
        { requestId, retryable: true },
      );
    }
    return new ProviderError(
      "OpenAI could not complete the request.",
      status,
      "provider_error",
      { requestId, retryable: status >= 500 },
    );
  }
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.toLowerCase().includes("timeout"))
  ) {
    return new ProviderError(
      "OpenAI request timed out.",
      504,
      "request_timeout",
      { retryable: true },
    );
  }
  return new ProviderError(
    "Unable to reach OpenAI.",
    502,
    "provider_error",
    { retryable: true },
  );
}

const confidenceSchema = z.enum(["low", "medium", "high"]);
const bandSchema = z.number().min(1).max(9).multipleOf(0.5);
const rangeSchema = z.tuple([z.number(), z.number()]);

export const scoringReportSchema = z.object({
  overall: bandSchema,
  range: rangeSchema,
  dimensions: z
    .array(
      z.object({
        key: z.enum(["fluency", "lexical", "grammar", "pronunciation"]),
        label: z.string(),
        band: bandSchema,
        range: rangeSchema,
        confidence: confidenceSchema,
        explanation: z.string(),
        evidence: z.array(z.string()),
        priority: z.string(),
      }),
    )
    .length(4),
  corrections: z.array(
    z.object({
      original: z.string(),
      suggestion: z.string(),
      type: z.string(),
      explanationZh: z.string(),
      naturalVersion: z.string(),
      affectsUnderstanding: z.boolean(),
      dimension: z.string(),
      practice: z.string(),
      certainty: z.enum(["error", "acceptable", "upgrade", "style"]),
    }),
  ),
  bestPoints: z.array(z.string()).length(3),
  priorities: z.array(z.string()).length(3),
  nextGoal: z.string(),
  recommendedPart: z.string(),
  recommendedTopic: z.string(),
  expressions: z.array(z.string()).length(5),
  drill: z.string(),
  improvedAnswers: z.array(
    z.object({
      part: z.number().int().min(1).max(3),
      answer: z.string(),
      phrases: z.array(z.string()),
    }),
  ),
});

const diagnosticSchema = z.object({
  ok: z.literal(true),
  schemaValid: z.literal(true),
});

export type ScoringReportPayload = z.infer<typeof scoringReportSchema>;

export interface AiProvider {
  transcribe(audio: File): Promise<string>;
  synthesize(
    text: string,
    options: { accent: string; voiceId: string; rate: number },
  ): Promise<{ audio: ArrayBuffer; resolvedVoice: string }>;
  evaluate(
    payload: unknown,
    options?: { requestId?: string },
  ): Promise<{
    report: ScoringReportPayload;
    model: string;
    providerRequestId?: string;
  }>;
  diagnose(options?: { requestId?: string }): Promise<{
    ok: true;
    schemaValid: true;
    model: string;
    providerRequestId?: string;
  }>;
  health(): {
    configured: boolean;
    provider: "openai";
    model: string;
    transcriptionModel: string;
    speechModel: string;
  };
}

const voiceEnvironmentNames: Record<string, string> = {
  "gb-female": "OPENAI_TTS_VOICE_GB_FEMALE",
  "gb-male": "OPENAI_TTS_VOICE_GB_MALE",
  "us-female": "OPENAI_TTS_VOICE_US_FEMALE",
};
function resolvedOpenAiTtsVoice(voiceId: string) {
  const configuredName = voiceEnvironmentNames[voiceId];
  const configured = configuredName
    ? process.env[configuredName]?.trim()
    : undefined;
  if (configured) return configured;
  return voiceId.endsWith("-male") ? "cedar" : "marin";
}

function examinerSpeechInstruction(accent: string) {
  const accentInstruction =
    accent === "en-US"
      ? "Use clear, natural North American English."
      : "Use clear, natural standard British English.";
  return `${accentInstruction} Speak like a calm, alert, courteous adult IELTS-style practice examiner. Keep a neutral professional tone and a natural conversational pace. Avoid a hoarse, elderly, breathy, strained, theatrical, announcer-like, or overly cheerful delivery. Do not imitate a real person.`;
}

function requestOptions(requestId?: string) {
  return requestId
    ? {
        headers: {
          "Idempotency-Key": requestId,
          "X-Client-Request-Id": requestId,
        },
      }
    : undefined;
}

export const openAiProvider: AiProvider = {
  async transcribe(audio) {
    try {
      const result = await client(90_000).audio.transcriptions.create({
        file: audio,
        model: TRANSCRIPTION_MODEL,
        language: "en",
        response_format: "json",
      });
      const text = result.text?.trim();
      if (!text) {
        throw new ProviderError(
          "Transcription returned no text.",
          422,
          "empty_transcript",
          { retryable: false },
        );
      }
      return text;
    } catch (error) {
      throw sanitizeProviderError(error);
    }
  },

  async synthesize(text, options) {
    const resolvedVoice = resolvedOpenAiTtsVoice(options.voiceId);
    try {
      const speech = await client(60_000).audio.speech.create({
        model: SPEECH_MODEL,
        voice: resolvedVoice,
        input: text,
        instructions: examinerSpeechInstruction(options.accent),
        speed: Math.max(0.88, Math.min(1.1, options.rate || 1)),
        response_format: "mp3",
      });
      return {
        audio: await speech.arrayBuffer(),
        resolvedVoice,
      };
    } catch (error) {
      throw sanitizeProviderError(error);
    }
  },

  async evaluate(payload, options = {}) {
    try {
      const response = await client(90_000).responses.parse(
        {
          model: SCORING_MODEL,
          store: false,
          reasoning: { effort: "low" },
          input: [
            {
              role: "system",
              content:
                "You are a cautious IELTS speaking practice evaluator. Apply the four public IELTS speaking criteria equally. Never call the estimate an official IELTS score. Use Chinese for explanations and natural English for corrected or improved answers. Distinguish definite errors, acceptable but less natural wording, upgrades, and style. Pronunciation confidence must remain low when only transcripts and timing data are available; never invent acoustic or phoneme evidence. Preserve the learner's meaning and make improved answers only about 0.5 to 1 band stronger, not memorized Band 9 scripts.",
            },
            {
              role: "user",
              content: `Evaluate this practice session from the supplied evidence. If evidence is missing, state the limitation rather than inventing it.\n${JSON.stringify(payload)}`,
            },
          ],
          text: {
            format: zodTextFormat(scoringReportSchema, "ielts_speaking_report"),
          },
        },
        requestOptions(options.requestId),
      );
      if (!response.output_parsed) {
        throw new ProviderError(
          "The scoring result did not match the required schema.",
          502,
          "schema_validation_failed",
          { requestId: response._request_id ?? undefined, retryable: true },
        );
      }
      return {
        report: response.output_parsed,
        model: SCORING_MODEL,
        providerRequestId: response._request_id || undefined,
      };
    } catch (error) {
      throw sanitizeProviderError(error);
    }
  },

  async diagnose(options = {}) {
    try {
      const response = await client(30_000).responses.parse(
        {
          model: SCORING_MODEL,
          store: false,
          reasoning: { effort: "none" },
          max_output_tokens: 80,
          input: "Return the requested connection diagnostic object.",
          text: {
            format: zodTextFormat(diagnosticSchema, "vocalis_diagnostic"),
          },
        },
        requestOptions(options.requestId),
      );
      if (!response.output_parsed) {
        throw new ProviderError(
          "OpenAI returned an invalid diagnostic result.",
          502,
          "schema_validation_failed",
          { requestId: response._request_id ?? undefined, retryable: true },
        );
      }
      return {
        ...response.output_parsed,
        model: SCORING_MODEL,
        providerRequestId: response._request_id || undefined,
      };
    } catch (error) {
      throw sanitizeProviderError(error);
    }
  },

  health() {
    return {
      configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      provider: "openai",
      model: SCORING_MODEL,
      transcriptionModel: TRANSCRIPTION_MODEL,
      speechModel: SPEECH_MODEL,
    };
  },
};
