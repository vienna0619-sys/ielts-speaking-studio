import "server-only";

const API_BASE = process.env.OPENAI_API_BASE?.replace(/\/$/, "") || "https://api.openai.com/v1";

export class ProviderError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ProviderError("OpenAI provider is not configured on the server.", 503);
  return key;
}

async function openAiFetch(path: string, init: RequestInit, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey()}`, ...(init.headers || {}) },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      let providerMessage = "";
      try {
        providerMessage = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? "";
      } catch {
        providerMessage = "";
      }
      throw new ProviderError(providerMessage || `OpenAI request failed (${response.status}).`, response.status);
    }
    return response;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new ProviderError("OpenAI request timed out.", 504);
    throw new ProviderError("Unable to reach OpenAI.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export interface AiProvider {
  transcribe(audio: File): Promise<string>;
  synthesize(text: string, accent: string, rate: number): Promise<ArrayBuffer>;
  evaluate(payload: unknown): Promise<unknown>;
  health(): Promise<{ configured: boolean; provider: string }>;
}

function extractOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string") return data.output_text;
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    for (const block of content) {
      if (block && typeof block === "object" && typeof (block as { text?: unknown }).text === "string") {
        return (block as { text: string }).text;
      }
    }
  }
  throw new ProviderError("The scoring model returned no readable output.", 502);
}

const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["overall", "range", "dimensions", "corrections", "bestPoints", "priorities", "nextGoal", "recommendedPart", "recommendedTopic", "expressions", "drill", "improvedAnswers"],
  properties: {
    overall: { type: "number", minimum: 1, maximum: 9, multipleOf: 0.5 },
    range: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
    dimensions: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "label", "band", "range", "confidence", "explanation", "evidence", "priority"],
        properties: {
          key: { type: "string", enum: ["fluency", "lexical", "grammar", "pronunciation"] },
          label: { type: "string" },
          band: { type: "number", minimum: 1, maximum: 9, multipleOf: 0.5 },
          range: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
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
        required: ["original", "suggestion", "type", "explanationZh", "naturalVersion", "affectsUnderstanding", "dimension", "practice", "certainty"],
        properties: {
          original: { type: "string" }, suggestion: { type: "string" }, type: { type: "string" },
          explanationZh: { type: "string" }, naturalVersion: { type: "string" }, affectsUnderstanding: { type: "boolean" },
          dimension: { type: "string" }, practice: { type: "string" },
          certainty: { type: "string", enum: ["error", "acceptable", "upgrade", "style"] },
        },
      },
    },
    bestPoints: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
    priorities: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
    nextGoal: { type: "string" }, recommendedPart: { type: "string" }, recommendedTopic: { type: "string" },
    expressions: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } },
    drill: { type: "string" },
    improvedAnswers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["part", "answer", "phrases"],
        properties: { part: { type: "integer", minimum: 1, maximum: 3 }, answer: { type: "string" }, phrases: { type: "array", items: { type: "string" } } },
      },
    },
  },
};

export const openAiProvider: AiProvider = {
  async transcribe(audio) {
    const form = new FormData();
    form.append("file", audio, audio.name || "answer.webm");
    form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe-2025-12-15");
    form.append("language", "en");
    form.append("response_format", "json");
    const response = await openAiFetch("/audio/transcriptions", { method: "POST", body: form }, 60_000);
    const data = (await response.json()) as { text?: string };
    if (!data.text) throw new ProviderError("Transcription returned no text.", 502);
    return data.text;
  },

  async synthesize(text, accent, rate) {
    const accentInstruction = accent === "en-US" ? "Use a neutral American English accent." : accent === "en-AU" ? "Use a neutral Australian English accent." : "Use a neutral British English accent.";
    const response = await openAiFetch("/audio/speech", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts-2025-12-15",
        voice: process.env.OPENAI_TTS_VOICE || "marin",
        input: text,
        instructions: `${accentInstruction} Speak as a formal, neutral and restrained language examiner. Do not sound overly cheerful.`,
        speed: Math.max(0.75, Math.min(1.25, rate || 1)),
        response_format: "mp3",
      }),
    });
    return response.arrayBuffer();
  },

  async evaluate(payload) {
    const response = await openAiFetch("/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || "gpt-5.4-mini",
        store: false,
        input: [
          {
            role: "system",
            content: "You are a cautious IELTS speaking practice evaluator. Apply the four public IELTS speaking criteria equally. Never claim this is an official score. Use Chinese for explanations and natural English for corrected or improved answers. Do not treat all informal spoken language as an error. Separate definite errors, acceptable-but-less-natural wording, upgrades, and style. Pronunciation claims must remain low confidence because only transcripts and timing features are provided; do not invent phoneme-level evidence. Preserve the learner's meaning and make improved answers only 0.5 to 1 band stronger, not Band 9 scripts.",
          },
          { role: "user", content: `Evaluate this practice session. Evidence:\n${JSON.stringify(payload)}` },
        ],
        text: { format: { type: "json_schema", name: "ielts_speaking_report", strict: true, schema: reportSchema } },
      }),
    }, 75_000);
    const data = (await response.json()) as Record<string, unknown>;
    return JSON.parse(extractOutputText(data));
  },

  async health() {
    return { configured: Boolean(process.env.OPENAI_API_KEY), provider: "openai" };
  },
};
