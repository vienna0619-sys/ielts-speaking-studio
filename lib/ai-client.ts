"use client";

export type AiFailureCode =
  | "route_missing"
  | "server_unreachable"
  | "cors_blocked"
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
  | "payload_too_large"
  | "provider_error"
  | "unknown_error";

export interface AiDiagnosticResult {
  ok: boolean;
  provider: "openai";
  configured: boolean;
  model: string;
  transcriptionModel: string;
  speechModel: string;
  schemaValid?: boolean;
  requestId?: string;
  diagnosticId?: string;
  code?: AiFailureCode;
  message?: string;
}

export interface OpenAiDiagnostic extends AiDiagnosticResult {
  connected: boolean;
  elapsedMs: number;
  message: string;
}

interface ErrorPayload {
  error?: string;
  message?: string;
  code?: AiFailureCode;
  requestId?: string;
  diagnosticId?: string;
  retryable?: boolean;
}

const configuredBase = (import.meta.env.VITE_AI_API_BASE_URL as
  | string
  | undefined)?.replace(/\/+$/, "");

export function getAiApiUrl() {
  return `${configuredBase || ""}/api/ai`;
}

export function getAiApiBaseLabel() {
  if (configuredBase) return configuredBase;
  if (typeof window !== "undefined") return window.location.origin;
  return "same-origin";
}

export function createAiRequestId(prefix = "score") {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function clientMessage(code: AiFailureCode, fallback?: string) {
  const messages: Record<AiFailureCode, string> = {
    route_missing:
      "未找到服务端评分路由。当前静态前端需要连接已部署的 Vocalis AI 服务。",
    server_unreachable: "无法连接评分服务，请检查服务端地址或网络。",
    cors_blocked: "评分服务拒绝了当前前端地址，请检查允许的站点配置。",
    missing_api_key: "服务端尚未配置 OPENAI_API_KEY。",
    invalid_api_key: "服务端的 OpenAI API 密钥无效或已撤销。",
    permission_denied: "OpenAI 项目没有访问当前模型的权限。",
    insufficient_quota: "OpenAI API 项目当前没有可用额度或账单未启用。",
    rate_limited: "评分请求过于频繁，请稍后重试。",
    model_unavailable: "当前评分模型不可用，请检查服务端模型配置。",
    request_timeout: "评分服务响应超时，请稍后重试。",
    empty_transcript: "没有可评分的文字稿，请先完成录音或转写。",
    invalid_json: "评分模型返回的内容无法解析。",
    schema_validation_failed: "评分结果格式未通过验证。",
    payload_too_large: "提交的数据过大，请缩短录音或分段重试。",
    provider_error: "OpenAI 评分服务暂时失败。",
    unknown_error: "AI 评分发生未知错误。",
  };
  return fallback || messages[code];
}

export class AiClientError extends Error {
  code: AiFailureCode;
  status: number;
  requestId?: string;
  diagnosticId?: string;
  retryable: boolean;

  constructor(
    code: AiFailureCode,
    status = 500,
    options: {
      message?: string;
      requestId?: string;
      diagnosticId?: string;
      retryable?: boolean;
    } = {},
  ) {
    super(clientMessage(code, options.message));
    this.name = "AiClientError";
    this.code = code;
    this.status = status;
    this.requestId = options.requestId;
    this.diagnosticId = options.diagnosticId;
    this.retryable =
      options.retryable ?? (status >= 500 || status === 429);
  }
}

async function parseError(response: Response): Promise<AiClientError> {
  let payload: ErrorPayload = {};
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const code: AiFailureCode =
      response.status === 404 ? "route_missing" : "server_unreachable";
    return new AiClientError(code, response.status);
  }
  try {
    payload = (await response.json()) as ErrorPayload;
  } catch {
    return new AiClientError("invalid_json", response.status);
  }
  return new AiClientError(payload.code || "provider_error", response.status, {
    message: payload.message || payload.error,
    requestId: payload.requestId,
    diagnosticId: payload.diagnosticId,
    retryable: payload.retryable,
  });
}

async function request(
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(getAiApiUrl(), {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) throw await parseError(response);
    return response;
  } catch (error) {
    if (error instanceof AiClientError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AiClientError("request_timeout", 504, { retryable: true });
    }
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    throw new AiClientError(
      message.includes("cors") ? "cors_blocked" : "server_unreachable",
      0,
      { retryable: true },
    );
  } finally {
    window.clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function checkAiHealth(): Promise<AiDiagnosticResult> {
  const response = await request(
    { method: "GET", headers: { accept: "application/json" } },
    10_000,
  );
  return (await response.json()) as AiDiagnosticResult;
}

export async function diagnoseAiConnection(): Promise<AiDiagnosticResult> {
  const requestId = createAiRequestId("diagnose");
  const response = await request(
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ operation: "diagnose", requestId }),
    },
    30_000,
  );
  return (await response.json()) as AiDiagnosticResult;
}

// Compatibility exports used by the existing settings, exam, history and
// re-analysis screens. They deliberately share the same request path as every
// other AI operation so diagnostics and real scoring cannot drift apart.
export async function diagnoseOpenAi(): Promise<OpenAiDiagnostic> {
  const startedAt = performance.now();
  const result = await diagnoseAiConnection();
  return {
    ...result,
    connected: result.ok,
    elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
    message:
      result.message ||
      "OpenAI 连接正常，服务端评分路由和结构化响应均可用。",
  };
}

export async function evaluateWithAi<T>(
  payload: unknown,
  requestId = createAiRequestId(),
): Promise<T> {
  const response = await request(
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
        "idempotency-key": requestId,
      },
      body: JSON.stringify({ operation: "evaluate", payload, requestId }),
    },
    90_000,
  );
  return (await response.json()) as T;
}

export async function evaluateWithOpenAi<T>(
  payload: unknown,
  idempotencyKey: string,
): Promise<T> {
  return evaluateWithAi<T>(payload, idempotencyKey);
}

export async function requestSpeech(
  text: string,
  options: {
    accent: string;
    voiceId: string;
    rate: number;
    requestId?: string;
    signal?: AbortSignal;
  },
) {
  const requestId = options.requestId || createAiRequestId("speech");
  return request(
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        operation: "speech",
        text,
        accent: options.accent,
        voiceId: options.voiceId,
        rate: options.rate,
        requestId,
      }),
      signal: options.signal,
    },
    45_000,
  );
}

export async function requestTranscription(blob: Blob) {
  const requestId = createAiRequestId("transcribe");
  const form = new FormData();
  form.append("operation", "transcribe");
  form.append(
    "audio",
    blob,
    blob.type.includes("mp4") ? "answer.mp4" : "answer.webm",
  );
  const response = await request(
    {
      method: "POST",
      headers: { "x-request-id": requestId },
      body: form,
    },
    90_000,
  );
  const data = (await response.json()) as { text?: string };
  return data.text?.trim() || "";
}

export function diagnosticMessage(error: unknown) {
  if (error instanceof AiClientError) return error.message;
  return error instanceof Error ? error.message : "OpenAI 评分暂时失败。";
}
