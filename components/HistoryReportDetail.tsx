"use client";

import type { HistoryRecord } from "@/lib/types";
import type { ReportEnvelope, ReportSnapshot } from "@/lib/reporting";
import { ACCENT_LABELS } from "@/lib/examiner-voices";
import { formatTime } from "@/lib/core.mjs";
import { Icon } from "./Icons";
import { MockExamExaminer } from "./MockExamExaminer";
import { PracticeExaminer } from "./PracticeExaminer";

function confidenceLabel(value: string) {
  return value === "high" ? "高" : value === "medium" ? "中等" : "低";
}

function VersionSelector({
  envelope,
  selectedId,
  onChange,
}: {
  envelope: ReportEnvelope;
  selectedId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="report-version-tabs" aria-label="报告分析版本">
      {envelope.versions.map((version, index) => (
        <button
          key={version.id}
          className={version.id === selectedId ? "active" : ""}
          onClick={() => onChange(version.id)}
        >
          {version.analysisKind === "original" ? "原始报告" : `重新分析 ${index}`}
          <small>{new Date(version.generatedAt).toLocaleString("zh-CN")}</small>
        </button>
      ))}
    </div>
  );
}

function SnapshotReport({
  snapshot,
  onReplay,
}: {
  snapshot: ReportSnapshot;
  onReplay: (segmentId: string) => void;
}) {
  const { report } = snapshot;
  return (
    <>
      <section className="result-hero history-result-hero">
        <div>
          <span className="eyebrow">SAVED REPORT SNAPSHOT</span>
          <h1>{snapshot.mode === "mock-exam" ? "全真模拟完整报告" : "日常练习完整报告"}</h1>
          <p>
            {new Date(snapshot.generatedAt).toLocaleString("zh-CN")} · {snapshot.scoringModel}
          </p>
        </div>
        <div className="overall-score">
          <span>综合估分</span>
          <strong>{report.overall.toFixed(1)}</strong>
          <small>区间 {report.range[0].toFixed(1)}–{report.range[1].toFixed(1)}</small>
        </div>
      </section>

      <div className="report-meta-grid">
        <article className="panel report-examiner-summary">
          {snapshot.mode === "mock-exam" ? (
            <MockExamExaminer
              compact
              activity="idle"
              avatarId={snapshot.examinerProfile.avatarId}
              displayName={snapshot.examinerProfile.displayName}
            />
          ) : (
            <PracticeExaminer compact activity="idle" speechLevel={0} viseme="rest" />
          )}
          <div>
            <span className="eyebrow">EXAMINER & VOICE</span>
            <h2>{snapshot.examinerProfile.displayName}</h2>
            <p>
              {ACCENT_LABELS[snapshot.examinerProfile.accent]} · voiceId: {snapshot.examinerProfile.voiceId}
              <br />provider: {snapshot.examinerProfile.voiceProvider}
            </p>
          </div>
        </article>
        <article className="panel report-session-meta">
          <span className="eyebrow">REPORT PROVENANCE</span>
          <dl>
            <div><dt>评分类型</dt><dd>{snapshot.isRealOpenAi ? "真实 OpenAI API" : "Mock / 本地估算"}</dd></div>
            <div><dt>评分模型</dt><dd>{snapshot.scoringModel}</dd></div>
            <div><dt>数据版本</dt><dd>v{snapshot.reportDataVersion}</dd></div>
            <div><dt>练习时长</dt><dd>{formatTime(snapshot.durations.totalSec)}</dd></div>
            <div><dt>Part 1 / 2 / 3</dt><dd>{formatTime(snapshot.durations.part1Sec)} / {formatTime(snapshot.durations.part2Sec)} / {formatTime(snapshot.durations.part3Sec)}</dd></div>
          </dl>
        </article>
      </div>

      {snapshot.missingContent.length > 0 && (
        <div className="alert warning">
          <Icon name="warning" />
          <span>未保存内容：{snapshot.missingContent.join("、")}。不会为缺失内容生成假数据。</span>
        </div>
      )}

      {snapshot.examPlan && (
        <section className="panel saved-questions-panel">
          <div className="panel-title"><div><span className="eyebrow">QUESTIONS</span><h2>当时使用的完整题目</h2></div></div>
          <div className="saved-question-grid">
            <article>
              <strong>Part 1</strong>
              {snapshot.examPlan.part1.flatMap((topic) => topic.questions).map((question) => <p key={question.id}>{question.question}</p>)}
            </article>
            <article>
              <strong>Part 2 Cue Card</strong>
              <p>{snapshot.examPlan.part2.title}</p>
              <ul>{snapshot.examPlan.part2.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
            </article>
            <article>
              <strong>Part 3</strong>
              {snapshot.examPlan.part3.map((question) => <p key={question.id}>{question.question}</p>)}
            </article>
          </div>
        </section>
      )}

      <section className="result-grid">
        <article className="panel score-panel">
          <div className="panel-title"><div><span className="eyebrow">FOUR CRITERIA</span><h2>四项评分与证据</h2></div></div>
          <div className="dimension-cards history-dimensions">
            {report.dimensions.map((dimension) => (
              <article key={dimension.key}>
                <div><h3>{dimension.label}</h3><b>{dimension.band.toFixed(1)}</b></div>
                <small>区间 {dimension.range[0].toFixed(1)}–{dimension.range[1].toFixed(1)} · {confidenceLabel(dimension.confidence)}置信度</small>
                <p>{dimension.explanation}</p>
                <ul>{dimension.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul>
                <strong>提高方向：{dimension.priority}</strong>
              </article>
            ))}
          </div>
        </article>
        <article className="panel metrics-panel">
          <div className="panel-title"><div><span className="eyebrow">SPEECH METRICS</span><h2>辅助语音指标</h2></div></div>
          <div className="metric-grid">
            <div><strong>{report.metrics.wordsPerMinute}</strong><span>词 / 分钟</span></div>
            <div><strong>{formatTime(report.metrics.totalSpeakingSeconds)}</strong><span>讲话时间</span></div>
            <div><strong>{report.metrics.longPauses}</strong><span>长停顿</span></div>
            <div><strong>{report.metrics.fillerCount}</strong><span>填充词</span></div>
            <div><strong>{report.metrics.selfCorrections}</strong><span>自我修正</span></div>
            <div><strong>{formatTime(report.metrics.part2SpeakingSeconds)}</strong><span>Part 2 连续讲话</span></div>
          </div>
          <p className="confidence-note"><Icon name="warning" />仅凭文字稿时，发音评分置信度有限。</p>
        </article>
      </section>

      <section className="panel transcript-panel">
        <div className="panel-title"><div><span className="eyebrow">TIMED TRANSCRIPT</span><h2>问题、完整回答与录音</h2></div><span>{snapshot.segments.length} 段</span></div>
        <div className="transcript-list">
          {snapshot.segments.map((segment, index) => (
            <article key={segment.id} id={`saved-segment-${segment.id}`}>
              <button className="play-button" disabled={!snapshot.recordingSaved} onClick={() => onReplay(segment.id)} title={snapshot.recordingSaved ? "播放保存的录音" : "本次未保存录音"}><Icon name="play" /></button>
              <div>
                <div className="transcript-meta"><strong>{segment.part ? `Part ${segment.part}` : "Introduction"} · Answer {index + 1}</strong><span>{formatTime(segment.durationSec)}</span></div>
                <small>{new Date(segment.startedAt).toLocaleTimeString("zh-CN")} · 转写：{segment.transcriptSource ?? "旧版未记录"} · 置信度：{segment.transcriptConfidence ?? "未记录"}</small>
                <p className="question-line">{segment.question}</p>
                <p>{segment.text || "该段没有可靠文字稿。"}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="result-grid">
        <article className="panel">
          <div className="panel-title"><div><span className="eyebrow">ALL CORRECTIONS</span><h2>全部纠错</h2></div><span>{report.corrections.length} 条</span></div>
          {report.corrections.length ? report.corrections.map((correction, index) => {
            const source = snapshot.segments.find((segment) => segment.text.toLowerCase().includes(correction.original.toLowerCase().slice(0, 20)));
            return (
              <div className="correction" key={`${correction.original}-${index}`}>
                <div><span className={`certainty ${correction.certainty}`}>{correction.certainty}</span><span>{correction.type}</span></div>
                <p><del>{correction.original}</del></p>
                <p><strong>{correction.naturalVersion}</strong></p>
                <small>{correction.explanationZh}</small>
                <footer>{source ? `Part ${source.part} · ${new Date(source.startedAt).toLocaleTimeString("zh-CN")} · ` : ""}{correction.dimension} · {correction.practice}</footer>
              </div>
            );
          }) : <p className="empty-state">没有足够证据生成纠错，未补造内容。</p>}
        </article>
        <article className="panel">
          <div className="panel-title"><div><span className="eyebrow">ACTION PLAN</span><h2>完整改进计划</h2></div></div>
          <h3 className="subheading">做得最好的地方</h3>
          <ol className="number-list good">{report.bestPoints.map((item) => <li key={item}>{item}</li>)}</ol>
          <h3 className="subheading">最需要改进</h3>
          <ol className="number-list">{report.priorities.map((item) => <li key={item}>{item}</li>)}</ol>
          <div className="core-goal"><span>下一次目标</span><strong>{report.nextGoal}</strong></div>
          <p><strong>推荐：</strong>{report.recommendedPart} · {report.recommendedTopic}</p>
          <div className="drill"><Icon name="clock" /><p><strong>10–15 分钟针对训练</strong>{report.drill}</p></div>
        </article>
      </section>

      <section className="panel improved-panel">
        <div className="panel-title"><div><span className="eyebrow">BETTER ANSWERS</span><h2>各 Part 改进版回答</h2></div></div>
        <div className="improved-grid">{report.improvedAnswers.map((answer) => <article key={answer.part}><span>PART {answer.part}</span><p>{answer.answer}</p><div>{answer.phrases.map((phrase) => <mark key={phrase}>{phrase}</mark>)}</div></article>)}</div>
      </section>

      <section className="panel recommendation-snapshot">
        <div className="panel-title"><div><span className="eyebrow">PERSONALISED LEARNING</span><h2>当时生成的个性化表达推荐</h2></div><span>{snapshot.recommendations.length} 条</span></div>
        <div className="recommendation-grid">{snapshot.recommendations.map((item) => <article key={item.id}><header><span>{item.type}</span><b>{item.expression}</b></header><p>{item.meaningZh}</p><small>{item.reason}</small><blockquote>{item.originalSentence}</blockquote><strong>{item.improvedExample}</strong><footer>适用 Part {item.suitableParts.join(" / ")} · {item.difficulty}</footer></article>)}</div>
      </section>

      <div className="disclaimer"><Icon name="shield" /><p>{report.disclaimer}</p></div>
    </>
  );
}

export function HistoryReportDetail({
  record,
  envelope,
  selectedVersionId,
  loading,
  onBack,
  onVersionChange,
  onReplay,
  onReanalyze,
}: {
  record: HistoryRecord;
  envelope: ReportEnvelope | null;
  selectedVersionId: string;
  loading: boolean;
  onBack: () => void;
  onVersionChange: (id: string) => void;
  onReplay: (segmentId: string) => void;
  onReanalyze: () => void;
}) {
  const snapshot = envelope?.versions.find((item) => item.id === selectedVersionId) ?? envelope?.versions[0];
  return (
    <section className="page-section history-detail-page">
      <div className="history-detail-toolbar">
        <button className="back-link" onClick={onBack}><span>←</span> 返回历史记录</button>
        <button className="secondary" disabled={loading || !snapshot} onClick={onReanalyze}><Icon name="refresh" />{loading ? "正在分析…" : "使用当前评分系统重新分析"}</button>
      </div>
      <p className="cost-note">重新分析由你主动触发，不覆盖原始报告；OpenAI 模式可能产生 API 费用。</p>
      {loading && !snapshot ? <div className="empty-panel"><span className="spinner" /><h2>正在读取完整报告</h2></div> : snapshot && envelope ? <><VersionSelector envelope={envelope} selectedId={snapshot.id} onChange={onVersionChange} /><SnapshotReport snapshot={snapshot} onReplay={onReplay} /></> : <div className="empty-panel legacy-empty"><Icon name="warning" size={34} /><h2>{record.title}</h2><p>该内容在旧版本中未保存。不会为旧记录伪造评分证据、纠错或建议。</p></div>}
    </section>
  );
}
