import type { ExamPlan, ExaminerProfile } from "./core.mjs";
import type { AnalysisReport, CapturedSegment, HistoryRecord, ProviderMode } from "./types";
import type { ExpressionRecommendation } from "./recommendations";

export const REPORT_DATA_VERSION = 2;

export interface ReportSnapshot {
  id: string;
  recordId: string;
  reportDataVersion: number;
  generatedAt: string;
  analysisKind: "original" | "reanalysis";
  basedOnVersionId?: string;
  mode: HistoryRecord["mode"];
  scoringProvider: ProviderMode;
  scoringModel: string;
  isRealOpenAi: boolean;
  examPlan?: ExamPlan;
  examinerProfile: ExaminerProfile;
  durations: { totalSec: number; part1Sec: number; part2Sec: number; part3Sec: number };
  segments: Omit<CapturedSegment, "blob" | "audioUrl">[];
  report: AnalysisReport;
  recommendations: ExpressionRecommendation[];
  recordingSaved: boolean;
  missingContent: string[];
}

export interface ReportEnvelope {
  recordId: string;
  reportDataVersion: number;
  originalVersionId: string;
  versions: ReportSnapshot[];
  updatedAt: string;
}

export function createReportSnapshot({
  record,
  report,
  segments,
  examinerProfile,
  examPlan,
  scoringModel,
  recommendations,
  analysisKind = "original",
  basedOnVersionId,
}: {
  record: HistoryRecord;
  report: AnalysisReport;
  segments: Omit<CapturedSegment, "blob" | "audioUrl">[];
  examinerProfile: ExaminerProfile;
  examPlan?: ExamPlan;
  scoringModel: string;
  recommendations: ExpressionRecommendation[];
  analysisKind?: "original" | "reanalysis";
  basedOnVersionId?: string;
}): ReportSnapshot {
  const generatedAt = new Date().toISOString();
  const durationFor = (part: number) => segments.filter((segment) => segment.part === part).reduce((sum, segment) => sum + segment.durationSec, 0);
  const missingContent: string[] = [];
  if (!segments.length) missingContent.push("录音与文字分段");
  if (segments.some((segment) => !segment.text.trim())) missingContent.push("部分文字稿");
  if (!record.recordingSaved) missingContent.push("录音（用户未开启保存）");
  return {
    id: `${record.id}:${analysisKind}:${Date.now()}`,
    recordId: record.id,
    reportDataVersion: REPORT_DATA_VERSION,
    generatedAt,
    analysisKind,
    basedOnVersionId,
    mode: record.mode,
    scoringProvider: report.provider,
    scoringModel,
    isRealOpenAi: report.provider === "openai",
    examPlan,
    examinerProfile,
    durations: { totalSec: record.durationSec, part1Sec: durationFor(1), part2Sec: durationFor(2), part3Sec: durationFor(3) },
    segments,
    report,
    recommendations,
    recordingSaved: record.recordingSaved,
    missingContent,
  };
}

export function appendReportVersion(envelope: ReportEnvelope | null, snapshot: ReportSnapshot): ReportEnvelope {
  if (!envelope) return { recordId: snapshot.recordId, reportDataVersion: REPORT_DATA_VERSION, originalVersionId: snapshot.id, versions: [snapshot], updatedAt: snapshot.generatedAt };
  return { ...envelope, versions: [...envelope.versions, snapshot], updatedAt: snapshot.generatedAt };
}

export function legacyRecordMessage(record: HistoryRecord) {
  return record.reportComplete ? "完整报告暂时无法读取。" : "该内容在旧版本中未保存。现有摘要与允许保存的录音仍可使用。";
}
