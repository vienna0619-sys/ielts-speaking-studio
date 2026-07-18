import test from "node:test";
import assert from "node:assert/strict";
import {
  EXAM_STATES,
  PART2_SETS,
  buildPracticeFeedback,
  calculateSpeechMetrics,
  createExamPlan,
  estimateMockScores,
  formatTime,
  microphoneErrorMessage,
  nextCountdown,
  prependHistoryRecord,
  providerErrorStatus,
  timerReachedLimit,
  transitionExam,
} from "../lib/core.mjs";

test("exam state machine completes the official three-part flow", () => {
  const events = [
    "START", "INTRO_COMPLETE", "PART1_COMPLETE", "INSTRUCTIONS_COMPLETE",
    "PREPARATION_COMPLETE", "SPEAKING_COMPLETE", "FOLLOW_UP_COMPLETE",
    "PART3_COMPLETE", "ANALYSE", "ANALYSIS_COMPLETE",
  ];
  let state = "SETUP";
  const visited = [state];
  for (const event of events) {
    state = transitionExam(state, event);
    visited.push(state);
  }
  assert.equal(state, "RESULTS");
  assert.deepEqual(visited, EXAM_STATES);
});

test("invalid state transitions fail loudly", () => {
  assert.throws(() => transitionExam("PART1", "START"), /Invalid exam transition/);
});

test("Part 2 countdown and speaking limits have stable boundaries", () => {
  assert.equal(nextCountdown(60), 59);
  assert.equal(nextCountdown(1), 0);
  assert.equal(nextCountdown(0), 0);
  assert.equal(timerReachedLimit(119, 120), false);
  assert.equal(timerReachedLimit(120, 120), true);
  assert.equal(formatTime(60), "01:00");
  assert.equal(formatTime(120), "02:00");
});

test("question selection avoids recent topics when alternatives exist", () => {
  const recent = ["p1-studies", "p1-hometown", "p2-useful-object"];
  const plan = createExamPlan({ seed: "dedupe", recentTopicIds: recent });
  assert.equal(plan.part1.some((topic) => recent.includes(topic.id)), false);
  assert.notEqual(plan.part2.id, "p2-useful-object");
  assert.equal(new Set(plan.part1.map((topic) => topic.id)).size, 2);
  assert.equal(new Set(plan.part1.flatMap((topic) => topic.questions.map((question) => question.id))).size, 6);
});

test("Part 3 questions are linked to the selected Part 2 topic", () => {
  for (const part2 of PART2_SETS) {
    const plan = createExamPlan({ seed: part2.id, recentTopicIds: PART2_SETS.filter((item) => item.id !== part2.id).map((item) => item.id) });
    assert.equal(plan.part2.id, part2.id);
    assert.ok(plan.part3.every((question) => question.relatedPart2Topic === part2.id));
    assert.ok(plan.part3.every((question) => part2.relatedPart3Themes.includes(question.mainTopic) || question.mainTopic === "technology"));
  }
});

test("speech metrics and mock scoring remain cautious", () => {
  const metrics = calculateSpeechMetrics([
    { part: 1, text: "Um I like reading because it helps me relax. For example I read on weekends.", durationSec: 20, longPauses: 1 },
    { part: 2, text: "I mean the place is useful because people meet there and spend time together.", durationSec: 85, longPauses: 2 },
  ]);
  assert.ok(metrics.wordCount > 20);
  assert.equal(metrics.part2SpeakingSeconds, 85);
  assert.ok(metrics.fillerCount >= 2);
  const report = estimateMockScores(metrics);
  assert.ok(report.overall >= 1 && report.overall <= 9);
  assert.equal(report.dimensions.length, 4);
  assert.equal(report.dimensions.find((item) => item.key === "pronunciation")?.confidence, "low");
  assert.ok(report.dimensions.every((item) => item.range[1] - item.range[0] >= 0.5));
});

test("practice feedback distinguishes short and developed answers", () => {
  const short = buildPracticeFeedback("Yes, I do.", 4, 1);
  const developed = buildPracticeFeedback("I enjoy it because it helps me relax. For example, I often do it after a busy school day.", 18, 1);
  assert.equal(short.tooShort, true);
  assert.equal(developed.tooShort, false);
  assert.ok(developed.band >= short.band);
});

test("history persistence helper replaces duplicate ids and enforces limits", () => {
  const original = [{ id: "a", score: 5 }, { id: "b", score: 6 }];
  const next = prependHistoryRecord(original, { id: "a", score: 6.5 }, 2);
  assert.deepEqual(next, [{ id: "a", score: 6.5 }, { id: "b", score: 6 }]);
});

test("provider and microphone failures map to explicit user-facing errors", () => {
  assert.match(providerErrorStatus(401), /密钥/);
  assert.match(providerErrorStatus(429), /额度|频繁/);
  assert.match(providerErrorStatus(503), /暂时不可用/);
  assert.match(microphoneErrorMessage("NotAllowedError"), /权限/);
  assert.match(microphoneErrorMessage("NotFoundError"), /没有找到/);
});
