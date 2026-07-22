"use client";

export type AiDiagnosticCode =
  | "ok"
  | "missing_api_key"
  | "invalid_api_key"
  | "project_permission_denied"
  | "insufficient_quota"
  | "rate_limited"
  | "model_or_route_not_found"
  | "timeout"
  | "network_error"
  | "invalid_response"
  | "route_missing"
  | "provider_error";

const USER_MESSAGES: Record<AiDiagnosticCode, string> = {
  ok: "OpenAI 连接正常，服务端评分路由和结构化响应均可用。",
  missing_api_key: "当前部署环境未配置 OPENAI_API_KEY。",
  invalid_api_key: "OpenAI API 密钥无效，请在服务端更换密钥。",
  project_permission_denied: "当前 OpenAI API 项目没有调用该模型的权限。",
  insufficient_quota: "OpenAI API 项目目前没有可用额度或账单未启用。",
  rate_limited: "请求过于频繁，请稍后再试。",
  model_or_route_not_found: "当前评分模型不可用，或服务端评分路由不存在。",
  timeout: "评分服务响应超时，考试记录已保留。",
  network_error: "浏览器无法连接服务端评分路由。",
  invalid_response: "评分服务返回格式无法解析。",
  route_missing: "当前是静态部署，未找到服务端评分路由。请使用 Sites 部署地址。",
  provider_error: "OpenAI 评分暂时失败，考试记录已保留。",
};

export class AiClientError extends Error {
  constructor(
    public code: AiDiagnosticCode,
    public status: number,
    public requestId?: string,
  ) {
    super(USER_MESSAGES[code]);
    this.name = "AiClientError";
  }
}

function statusCode(status: number, code?: string): AiDiagnosticCode {
  if (code && code in USER_MESSAGES) return code as AiDiagnosticCode;
  if (status === 401) return "invalid_api_key";
  if (status === 403) return "project_permission_denied";
  if (status === 404 || status === 405) return "route_missing";
  if (status === 429) return "rate_limited";
  if (status === 504) return "timeout";
  return "provider_error";
}

async function postJson<T>(body: unknown, timeoutMs = 80_000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json"))
      throw new AiClientError(
        response.status === 404 || response.status === 405
          ? "route_missing"
          : "invalid_response",
        response.status,
      );
    const data = (await response.json()) as T & { code?: string; requestId?: string };
    if (!response.ok)
      throw new AiClientError(statusCode(response.status, data.code), response.status, data.requestId);
    return data;
  } catch (error) {
    if (error instanceof AiClientError) throw error;
    if (error instanceof DOMException && error.name === "AbortError")
      throw new AiClientError("timeout", 504);
    throw new AiClientError("network_error", 0);
  } finally {
    window.clearTimeout(timeout);
  }
}

export interface OpenAiDiagnostic {
  configured: boolean;
  connected: boolean;
  provider: "openai";
  model: string;
  elapsedMs: number;
  requestId?: string;
  message: string;
}

export async function diagnoseOpenAi(): Promise<OpenAiDiagnostic> {
  const result = await postJson<Omit<OpenAiDiagnostic, "message">>({ operation: "diagnose" }, 30_000);
  return { ...result, message: USER_MESSAGES.ok };
}

const inFlightScores = new Map<string, Promise<unknown>>();

export async function evaluateWithOpenAi<T>(payload: unknown, idempotencyKey: string): Promise<T> {
  const existing = inFlightScores.get(idempotencyKey);
  if (existing) return existing as Promise<T>;
  const request = postJson<T>({
    operation: "evaluate",
    payload: { ...(payload && typeof payload === "object" ? payload : { evidence: payload }), idempotencyKey },
  }).finally(() => inFlightScores.delete(idempotencyKey));
  inFlightScores.set(idempotencyKey, request);
  return request;
}

export function diagnosticMessage(error: unknown) {
  return error instanceof AiClientError ? error.message : USER_MESSAGES.provider_error;
}
