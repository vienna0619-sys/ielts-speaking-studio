import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSpeechMetrics,
  createExamPlan,
  createExaminerProfile,
  estimateMockScores,
} from "../lib/core.mjs";
import {
  REPORT_DATA_VERSION,
  appendReportVersion,
  createReportSnapshot,
} from "../lib/reporting.ts";
import {
  buildPersonalRecommendations,
  mergeExpressionLibrary,
} from "../lib/recommendations.ts";

function fixture() {
  const plan = createExamPlan({ seed: "report-integration" });
  const examiner = createExaminerProfile({
    seed: "report-examiner",
    availableVoiceIds: ["gb-female", "gb-male", "us-female"],
  });
  const segment = {
    id: "segment-1",
    part: 2,
    question: plan.part2.title,
    text: "It was a good experience and the good thing was that people were very helpful. It was very important to me.",
    startedAt: "2026-07-22T10:00:00.000Z",
    endedAt: "2026-07-22T10:01:20.000Z",
    durationSec: 80,
    longPauses: 2,
    transcriptConfidence: "high",
    transcriptSource: "openai",
  };
  const metrics = calculateSpeechMetrics([segment]);
  const scores = estimateMockScores(metrics);
  const report = {
    ...scores,
    metrics,
    corrections: [],
    bestPoints: ["completed", "developed one point", "used an example"],
    priorities: ["add detail", "reduce repetition", "review endings"],
    nextGoal: "Add one precise example.",
    recommendedPart: "Part 2",
    recommendedTopic: plan.part2.mainTopic,
    expressions: [
      "play an important role in",
      "from my perspective",
      "what I mean is",
      "one possible explanation is that",
      "strike a balance between",
    ],
    drill: "Repeat the answer twice with one clearer example.",
    improvedAnswers: [{ part: 2, answer: segment.text, phrases: ["what I mean is"] }],
    provider: "mock",
    disclaimer: "Practice estimate only.",
  };
  const record = {
    id: "record-1",
    date: "2026-07-22T10:02:00.000Z",
    mode: "mock-exam",
    title: "Full mock",
    topics: [plan.part2.id],
    recordingSaved: true,
    segments: [segment],
    overall: report.overall,
    dimensions: report.dimensions.map(({ key, label, band }) => ({ key, label, band })),
    mainErrors: report.priorities,
    durationSec: 80,
    retried: false,
  };
  return { plan, examiner, segment, report, record };
}

test("a complete report snapshot preserves provenance and immutable versions", () => {
  const { plan, examiner, segment, report, record } = fixture();
  const recommendations = buildPersonalRecommendations(report, [segment], record.id, 7);
  const original = createReportSnapshot({
    record,
    report,
    segments: [segment],
    examinerProfile: examiner,
    examPlan: plan,
    scoringModel: "local-mock-v2",
    recommendations,
  });
  const firstEnvelope = appendReportVersion(null, original);
  const reanalysis = createReportSnapshot({
    record,
    report: { ...report, overall: Math.min(9, report.overall + 0.5) },
    segments: [segment],
    examinerProfile: examiner,
    examPlan: plan,
    scoringModel: "gpt-5.6-terra",
    recommendations,
    analysisKind: "reanalysis",
    basedOnVersionId: original.id,
  });
  const nextEnvelope = appendReportVersion(firstEnvelope, reanalysis);

  assert.equal(original.reportDataVersion, REPORT_DATA_VERSION);
  assert.equal(original.examPlan?.comboId, plan.comboId);
  assert.equal(original.examinerProfile.id, examiner.id);
  assert.equal(original.segments[0].transcriptSource, "openai");
  assert.equal(nextEnvelope.originalVersionId, original.id);
  assert.equal(nextEnvelope.versions.length, 2);
  assert.equal(nextEnvelope.versions[0].report.overall, original.report.overall);
  assert.equal(nextEnvelope.versions[1].basedOnVersionId, original.id);
});

test("personal recommendations use answer evidence and deduplicate across records", () => {
  const { segment, report } = fixture();
  const first = buildPersonalRecommendations(report, [segment], "record-1", 7);
  const second = buildPersonalRecommendations(report, [segment], "record-2", 7);
  const library = mergeExpressionLibrary(mergeExpressionLibrary([], first), second);

  assert.ok(first.some((item) => item.reason.includes("good")));
  assert.ok(first.every((item) => item.sourceQuestion === segment.question));
  assert.equal(new Set(library.map((item) => `${item.type}:${item.expression.toLowerCase()}`)).size, library.length);
  assert.ok(library.some((item) => item.recommendationCount === 2));
  assert.ok(library.length <= 16);
});
