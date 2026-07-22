import type { AnalysisReport, CapturedSegment, HistoryRecord } from "./types";

export type RecommendationType =
  | "vocabulary"
  | "collocation"
  | "discourse-marker"
  | "sentence-pattern"
  | "grammar-focus";

export interface ExpressionRecommendation {
  id: string;
  expression: string;
  type: RecommendationType;
  meaningZh: string;
  usage: string;
  naturalness: "high" | "medium";
  difficulty: "foundation" | "intermediate" | "upper-intermediate";
  sourceRecordId: string;
  sourceQuestion: string;
  reason: string;
  originalSentence: string;
  improvedExample: string;
  newIeltsExample: string;
  suitableParts: (1 | 2 | 3)[];
  commonMistake: string;
  createdAt: string;
}

export type ExpressionStatus =
  | "to-learn"
  | "reviewing"
  | "mastered"
  | "frequently-wrong"
  | "hidden";

export interface ExpressionLibraryItem extends ExpressionRecommendation {
  status: ExpressionStatus;
  favorite: boolean;
  sourceRecordIds: string[];
  recommendationCount: number;
  successfulUses: number;
  incorrectUsesAfterMastery: number;
  lastReviewedAt?: string;
  personalExample?: string;
}

const REPLACEMENTS: Record<string, { expression: string; meaningZh: string; usage: string; example: string }> = {
  good: { expression: "beneficial", meaningZh: "有益的", usage: "解释政策、习惯或变化带来的实际好处；不用于所有泛泛的“好”。", example: "Regular feedback can be beneficial for students." },
  bad: { expression: "counterproductive", meaningZh: "适得其反的", usage: "某个做法不仅无效，反而妨碍目标时使用。", example: "Too much pressure can be counterproductive." },
  very: { expression: "particularly", meaningZh: "尤其、格外", usage: "突出某一点，不要把每个形容词都机械加强。", example: "I find the library particularly useful during exams." },
  important: { expression: "play an important role in", meaningZh: "在……中发挥重要作用", usage: "Part 3 解释某因素的作用时自然使用。", example: "Public transport plays an important role in reducing congestion." },
  interesting: { expression: "engaging", meaningZh: "吸引人的、让人投入的", usage: "描述活动、课程或内容让人持续关注。", example: "The class was engaging because we discussed real cases." },
  many: { expression: "a wide range of", meaningZh: "多种多样的", usage: "强调种类而不只是数量时使用。", example: "The city offers a wide range of cultural activities." },
  thing: { expression: "aspect", meaningZh: "方面", usage: "指一个主题的具体方面，避免反复使用含糊的 thing。", example: "The most challenging aspect is managing my time." },
  people: { expression: "individuals", meaningZh: "个人、人们", usage: "Part 3 的一般讨论中偶尔替换 people；日常 Part 1 不必刻意使用。", example: "Some individuals prefer flexible working hours." },
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 54) || "item";
}

function inferExpressionType(value: string): RecommendationType {
  const lower = value.toLowerCase();
  if (/^(actually|personally|for example|as a result|on the other hand|to some extent|what i mean is)/.test(lower)) return "discourse-marker";
  if (/^(what i|the main reason|it depends|although|one possible|this can)/.test(lower)) return "sentence-pattern";
  return value.trim().split(/\s+/).length > 1 ? "collocation" : "vocabulary";
}

function firstEvidence(segments: CapturedSegment[], needle?: string) {
  return segments.find((segment) => !needle || segment.text.toLowerCase().includes(needle.toLowerCase())) ?? segments.find((segment) => segment.text.trim()) ?? segments[0];
}

export function buildPersonalRecommendations(
  report: AnalysisReport,
  segments: CapturedSegment[],
  sourceRecordId: string,
  targetBand: number,
): ExpressionRecommendation[] {
  const createdAt = new Date().toISOString();
  const transcript = segments.map((segment) => segment.text.toLowerCase()).join(" ");
  const words = transcript.match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
  const counts = new Map<string, number>();
  words.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
  const difficulty = targetBand >= 7 ? "upper-intermediate" : "intermediate";
  const items: ExpressionRecommendation[] = [];

  Object.entries(REPLACEMENTS)
    .filter(([word]) => (counts.get(word) ?? 0) >= 2)
    .sort(([a], [b]) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, 5)
    .forEach(([word, replacement]) => {
      const evidence = firstEvidence(segments, word);
      items.push({
        id: `${sourceRecordId}:vocab:${slug(replacement.expression)}`,
        expression: replacement.expression,
        type: "vocabulary",
        meaningZh: replacement.meaningZh,
        usage: replacement.usage,
        naturalness: "high",
        difficulty,
        sourceRecordId,
        sourceQuestion: evidence?.question ?? "本次练习",
        reason: `你在本次回答中使用了 ${counts.get(word)} 次 “${word}”；建议只在合适语境替换其中一部分。`,
        originalSentence: evidence?.text ?? word,
        improvedExample: replacement.example,
        newIeltsExample: replacement.example,
        suitableParts: [2, 3],
        commonMistake: "不要为显得高级而替换所有简单词；准确和自然优先。",
        createdAt,
      });
    });

  report.expressions.slice(0, 8).forEach((expression, index) => {
    const evidence = firstEvidence(segments);
    const type = inferExpressionType(expression);
    items.push({
      id: `${sourceRecordId}:${type}:${slug(expression)}`,
      expression,
      type,
      meaningZh: "结合本次语境学习的自然口语表达",
      usage: type === "discourse-marker" ? "用于自然推进、举例、比较或澄清；一段回答使用一两个即可。" : "用于扩展本次回答中的观点，先练准确，再练速度。",
      naturalness: "high",
      difficulty,
      sourceRecordId,
      sourceQuestion: evidence?.question ?? "本次练习",
      reason: `来自本次报告的第 ${index + 1} 个优先表达，与你当时回答的主题直接相关。`,
      originalSentence: evidence?.text ?? "该次回答没有可靠文字稿。",
      improvedExample: report.improvedAnswers.find((answer) => answer.part === evidence?.part)?.answer ?? `I would use “${expression}” only where it fits the meaning naturally.`,
      newIeltsExample: `In an IELTS answer, “${expression}” can help develop one relevant point naturally.`,
      suitableParts: type === "discourse-marker" ? [1, 2, 3] : [2, 3],
      commonMistake: "不要背成固定模板，也不要在每句话中重复使用。",
      createdAt,
    });
  });

  report.corrections.slice(0, 2).forEach((correction) => {
    const evidence = firstEvidence(segments, correction.original);
    items.push({
      id: `${sourceRecordId}:grammar:${slug(correction.type)}:${slug(correction.suggestion)}`,
      expression: correction.suggestion,
      type: "grammar-focus",
      meaningZh: correction.explanationZh,
      usage: correction.practice,
      naturalness: "high",
      difficulty: "foundation",
      sourceRecordId,
      sourceQuestion: evidence?.question ?? "本次练习",
      reason: `本次报告在 ${correction.dimension} 维度识别到 ${correction.type} 问题。`,
      originalSentence: correction.original,
      improvedExample: correction.naturalVersion,
      newIeltsExample: correction.suggestion,
      suitableParts: evidence?.part ? [evidence.part as 1 | 2 | 3] : [1, 2, 3],
      commonMistake: correction.explanationZh,
      createdAt,
    });
  });

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.expression.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 16);
}

export function mergeExpressionLibrary(
  current: ExpressionLibraryItem[],
  incoming: ExpressionRecommendation[],
): ExpressionLibraryItem[] {
  const byKey = new Map(current.map((item) => [`${item.type}:${item.expression.trim().toLowerCase()}`, item]));
  incoming.forEach((recommendation) => {
    const key = `${recommendation.type}:${recommendation.expression.trim().toLowerCase()}`;
    const existing = byKey.get(key);
    if (existing) {
      const newSource = !existing.sourceRecordIds.includes(recommendation.sourceRecordId);
      byKey.set(key, {
        ...existing,
        sourceRecordIds: newSource ? [recommendation.sourceRecordId, ...existing.sourceRecordIds] : existing.sourceRecordIds,
        recommendationCount: existing.recommendationCount + (newSource ? 1 : 0),
        status: existing.status === "mastered" && recommendation.type === "grammar-focus" ? "frequently-wrong" : existing.status,
        incorrectUsesAfterMastery: existing.incorrectUsesAfterMastery + (existing.status === "mastered" && recommendation.type === "grammar-focus" ? 1 : 0),
      });
    } else {
      byKey.set(key, { ...recommendation, status: "to-learn", favorite: false, sourceRecordIds: [recommendation.sourceRecordId], recommendationCount: 1, successfulUses: 0, incorrectUsesAfterMastery: 0 });
    }
  });
  return [...byKey.values()].sort((a, b) => b.recommendationCount - a.recommendationCount || b.createdAt.localeCompare(a.createdAt));
}

export function buildLongTermSignals(history: HistoryRecord[], library: ExpressionLibraryItem[]) {
  const issues = new Map<string, number>();
  history.forEach((record) => record.mainErrors.forEach((issue) => issues.set(issue, (issues.get(issue) ?? 0) + 1)));
  return {
    frequentIssues: [...issues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    weeklyExpressions: library.filter((item) => item.status !== "mastered" && item.status !== "hidden").slice(0, 5),
    improvedExpressions: library.filter((item) => item.successfulUses > 0).sort((a, b) => b.successfulUses - a.successfulUses).slice(0, 3),
  };
}
