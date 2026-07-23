import { NextResponse } from "next/server";
import {
  openAiProvider,
  ProviderError,
} from "@/lib/ai/providers.server";
import { EXAMINER_VOICE_PRESETS } from "@/lib/core.mjs";

export const runtime = "edge";

const MAX_JSON_BYTES = 1024 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const DEFAULT_ALLOWED_ORIGINS = [
  "https://vienna0619-sys.github.io",
  "https://ielts-speaking-studio.vienna0619.chatgpt.site",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "https://terminal.local",
];

interface CachedEvaluation {
  expiresAt: number;
  value: unknown;
}
const evaluationCache = new Map<string, CachedEvaluation>();

function allowedOrigins() {
  const configured =
    process.env.AI_ALLOWED_ORIGINS?.split(",")
      .map((value) => value.trim().replace(/\/+$/, ""))
      .filter(Boolean) || [];
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function requestOrigin(request: Request) {
  return request.headers.get("origin")?.replace(/\/+$/, "") || "";
}

function corsHeaders(request: Request) {
  const origin = requestOrigin(request);
  const headers = new Headers({
    vary: "Origin",
    "cache-control": "no-store",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers":
      "Content-Type, X-Request-Id, Idempotency-Key",
    "access-control-max-age": "86400",
  });
  if (origin && allowedOrigins().has(origin)) {
    headers.set("access-control-allow-origin", origin);
  }
  return headers;
}

function trustedRequest(request: Request) {
  const origin = requestOrigin(request);
  return !origin || allowedOrigins().has(origin);
}

function requestId(request: Request, fromBody?: string) {
  return (
    request.headers.get("x-request-id")?.slice(0, 160) ||
    fromBody?.slice(0, 160) ||
    `request-${crypto.randomUUID()}`
  );
}

function diagnosticId() {
  return `VAI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function json(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
) {
  const headers = corsHeaders(request);
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  }
  return NextResponse.json(body, { status, headers });
}

function failure(
  request: Request,
  options: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
    diagnosticId?: string;
    retryable?: boolean;
    providerRequestId?: string;
  },
) {
  return json(
    request,
    {
      ok: false,
      error: options.message,
      message: options.message,
      code: options.code,
      requestId: options.requestId,
      diagnosticId: options.diagnosticId,
      retryable: options.retryable ?? options.status >= 500,
      providerRequestId: options.providerRequestId,
    },
    options.status,
  );
}

function errorResponse(
  request: Request,
  error: unknown,
  ids: { requestId?: string; diagnosticId?: string } = {},
) {
  if (error instanceof ProviderError) {
    console.error("[vocalis-ai]", {
      route: "/api/ai",
      status: error.status,
      code: error.code,
      requestId: ids.requestId,
      providerRequestId: error.requestId,
      retryable: error.retryable,
    });
    return failure(request, {
      status: error.status,
      code: error.code,
      message: error.message,
      requestId: ids.requestId,
      diagnosticId: ids.diagnosticId,
      retryable: error.retryable,
      providerRequestId: error.requestId,
    });
  }
  console.error("[vocalis-ai]", {
    route: "/api/ai",
    status: 500,
    code: "provider_error",
    requestId: ids.requestId,
  });
  return failure(request, {
    status: 500,
    code: "provider_error",
    message: "Unexpected AI provider error.",
    requestId: ids.requestId,
    diagnosticId: ids.diagnosticId,
    retryable: true,
  });
}

function validatedVoiceProfile(voiceId: string) {
  return EXAMINER_VOICE_PRESETS.find(
    (voice) =>
      voice.id === voiceId &&
      voice.enabled &&
      voice.qualityStatus === "verified" &&
      voice.verifiedGenderPresentation === voice.genderPresentation,
  );
}

function transcriptPresent(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  if (
    typeof value.transcript === "string" &&
    value.transcript.trim().length > 0
  ) {
    return true;
  }
  if (!Array.isArray(value.segments)) return false;
  return value.segments.some(
    (segment) =>
      segment &&
      typeof segment === "object" &&
      typeof (segment as { text?: unknown }).text === "string" &&
      Boolean((segment as { text: string }).text.trim()),
  );
}

export async function OPTIONS(request: Request) {
  if (!trustedRequest(request)) {
    return failure(request, {
      status: 403,
      code: "cors_blocked",
      message: "This frontend origin is not allowed.",
      retryable: false,
    });
  }
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  if (!trustedRequest(request)) {
    return failure(request, {
      status: 403,
      code: "cors_blocked",
      message: "This frontend origin is not allowed.",
      retryable: false,
    });
  }
  return json(request, { ok: true, ...openAiProvider.health() });
}

export async function POST(request: Request) {
  const diagId = diagnosticId();
  let currentRequestId = requestId(request);
  if (!trustedRequest(request)) {
    return failure(request, {
      status: 403,
      code: "cors_blocked",
      message: "This frontend origin is not allowed.",
      requestId: currentRequestId,
      diagnosticId: diagId,
      retryable: false,
    });
  }

  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      if (contentLength > MAX_AUDIO_BYTES + 512 * 1024) {
        return failure(request, {
          status: 413,
          code: "payload_too_large",
          message: "Audio files must be 25 MB or smaller.",
          requestId: currentRequestId,
          diagnosticId: diagId,
          retryable: false,
        });
      }
      const form = await request.formData();
      if (form.get("operation") !== "transcribe") {
        return failure(request, {
          status: 400,
          code: "provider_error",
          message: "Unsupported operation.",
          requestId: currentRequestId,
          diagnosticId: diagId,
          retryable: false,
        });
      }
      const audio = form.get("audio");
      if (!(audio instanceof File) || audio.size === 0) {
        return failure(request, {
          status: 422,
          code: "empty_transcript",
          message: "An audio file is required.",
          requestId: currentRequestId,
          diagnosticId: diagId,
          retryable: false,
        });
      }
      if (audio.size > MAX_AUDIO_BYTES) {
        return failure(request, {
          status: 413,
          code: "payload_too_large",
          message: "Audio files must be 25 MB or smaller.",
          requestId: currentRequestId,
          diagnosticId: diagId,
          retryable: false,
        });
      }
      return json(request, {
        ok: true,
        text: await openAiProvider.transcribe(audio),
        requestId: currentRequestId,
        diagnosticId: diagId,
      });
    }

    if (contentLength > MAX_JSON_BYTES) {
      return failure(request, {
        status: 413,
        code: "payload_too_large",
        message: "The analysis request is too large.",
        requestId: currentRequestId,
        diagnosticId: diagId,
        retryable: false,
      });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) {
      return failure(request, {
        status: 413,
        code: "payload_too_large",
        message: "The analysis request is too large.",
        requestId: currentRequestId,
        diagnosticId: diagId,
        retryable: false,
      });
    }
    let body: {
      operation?: string;
      text?: string;
      accent?: string;
      voiceId?: string;
      rate?: number;
      payload?: unknown;
      requestId?: string;
    };
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      return failure(request, {
        status: 400,
        code: "invalid_json",
        message: "The request body is not valid JSON.",
        requestId: currentRequestId,
        diagnosticId: diagId,
        retryable: false,
      });
    }
    currentRequestId = requestId(request, body.requestId);

    if (body.operation === "diagnose") {
      const result = await openAiProvider.diagnose({
        requestId: currentRequestId,
      });
      return json(request, {
        configured: true,
        provider: "openai",
        transcriptionModel: openAiProvider.health().transcriptionModel,
        speechModel: openAiProvider.health().speechModel,
        requestId: currentRequestId,
        diagnosticId: diagId,
        ...result,
      });
    }

    if (body.operation === "speech") {
      if (!body.text?.trim()) {
        return failure(request, {
          status: 400,
          code: "provider_error",
          message: "Speech text is required.",
          requestId: currentRequestId,
          diagnosticId: diagId,
          retryable: false,
        });
      }
      const profile = validatedVoiceProfile(body.voiceId || "");
      if (!profile) {
        return failure(request, {
          status: 422,
          code: "provider_error",
          message: "The requested examiner voice is disabled or unverified.",
          requestId: currentRequestId,
          diagnosticId: diagId,
          retryable: false,
        });
      }
      const speech = await openAiProvider.synthesize(body.text.slice(0, 4096), {
        accent: profile.locale,
        voiceId: profile.id,
        rate: body.rate || 1,
      });
      const headers = corsHeaders(request);
      headers.set("content-type", "audio/mpeg");
      headers.set("x-vocalis-resolved-voice", speech.resolvedVoice);
      headers.set("x-request-id", currentRequestId);
      return new Response(speech.audio, { headers });
    }

    if (body.operation === "evaluate") {
      if (!transcriptPresent(body.payload)) {
        return failure(request, {
          status: 422,
          code: "empty_transcript",
          message: "No usable transcript was supplied for scoring.",
          requestId: currentRequestId,
          diagnosticId: diagId,
          retryable: false,
        });
      }
      const now = Date.now();
      for (const [key, value] of evaluationCache) {
        if (value.expiresAt <= now) evaluationCache.delete(key);
      }
      const cached = evaluationCache.get(currentRequestId);
      if (cached) return json(request, cached.value);
      const result = await openAiProvider.evaluate(body.payload, {
        requestId: currentRequestId,
      });
      const responseBody = {
        ok: true,
        ...result.report,
        scoringProvider: "openai",
        scoringModel: result.model,
        scoringRequestId: currentRequestId,
        providerRequestId: result.providerRequestId,
        scoringDiagnosticId: diagId,
        scoringGeneratedAt: new Date().toISOString(),
      };
      evaluationCache.set(currentRequestId, {
        expiresAt: now + IDEMPOTENCY_TTL_MS,
        value: responseBody,
      });
      return json(request, responseBody);
    }

    return failure(request, {
      status: 400,
      code: "provider_error",
      message: "Unsupported operation.",
      requestId: currentRequestId,
      diagnosticId: diagId,
      retryable: false,
    });
  } catch (error) {
    return errorResponse(request, error, {
      requestId: currentRequestId,
      diagnosticId: diagId,
    });
  }
}
