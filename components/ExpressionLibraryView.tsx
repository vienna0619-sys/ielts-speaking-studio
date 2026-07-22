"use client";

import { useMemo, useState } from "react";
import type { ExpressionLibraryItem, ExpressionStatus } from "@/lib/recommendations";
import { Icon } from "./Icons";

const STATUS_LABELS: Record<ExpressionStatus, string> = {
  "to-learn": "待学习",
  reviewing: "正在复习",
  mastered: "已掌握",
  "frequently-wrong": "经常用错",
  hidden: "已隐藏",
};

export function ExpressionLibraryView({
  items,
  onUpdate,
  onDelete,
  onSpeak,
  onOpenSource,
}: {
  items: ExpressionLibraryItem[];
  onUpdate: (id: string, changes: Partial<ExpressionLibraryItem>) => void;
  onDelete: (id: string) => void;
  onSpeak: (text: string) => void;
  onOpenSource: (recordId: string) => void;
}) {
  const [filter, setFilter] = useState<ExpressionStatus | "all">("all");
  const [type, setType] = useState("all");
  const visible = useMemo(() => items.filter((item) => (filter === "all" || item.status === filter) && (type === "all" || item.type === type)), [items, filter, type]);
  return (
    <section className="page-section expression-library-page">
      <div className="page-heading simple">
        <div><span className="eyebrow">MY LANGUAGE BANK</span><h1>我的表达库</h1><p>推荐来自你的真实回答；状态会跨练习保留，后续再次用错会重新提醒。</p></div>
        <span className="count-pill">{items.length} 条</span>
      </div>
      <div className="library-filters">
        <select value={filter} onChange={(event) => setFilter(event.target.value as ExpressionStatus | "all")}><option value="all">全部状态</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        <select value={type} onChange={(event) => setType(event.target.value)}><option value="all">全部类型</option><option value="vocabulary">词汇替换</option><option value="collocation">词组与搭配</option><option value="discourse-marker">连接表达</option><option value="sentence-pattern">实用句型</option><option value="grammar-focus">语法专项</option></select>
      </div>
      {visible.length ? <div className="library-grid">{visible.map((item) => (
        <article className="panel library-card" key={item.id}>
          <header><div><span>{item.type} · {STATUS_LABELS[item.status]}</span><h2>{item.expression}</h2></div><button className={item.favorite ? "icon-button favorite active" : "icon-button favorite"} onClick={() => onUpdate(item.id, { favorite: !item.favorite })} title="收藏"><Icon name="spark" /></button></header>
          <p className="library-meaning">{item.meaningZh}</p>
          <dl><div><dt>为什么推荐</dt><dd>{item.reason}</dd></div><div><dt>使用场景</dt><dd>{item.usage}</dd></div><div><dt>我的原句</dt><dd>{item.originalSentence}</dd></div><div><dt>更自然示例</dt><dd>{item.improvedExample}</dd></div><div><dt>新 IELTS 例句</dt><dd>{item.newIeltsExample}</dd></div><div><dt>常见错误</dt><dd>{item.commonMistake}</dd></div></dl>
          <label>我的造句<textarea value={item.personalExample ?? ""} onChange={(event) => onUpdate(item.id, { personalExample: event.target.value })} placeholder="用这个表达写一句自己的口语句子…" /></label>
          <footer>
            <button className="ghost" onClick={() => onSpeak(item.expression)}><Icon name="volume" />听发音</button>
            <button className="ghost" onClick={() => onOpenSource(item.sourceRecordId)}>查看来源</button>
            <select value={item.status} onChange={(event) => onUpdate(item.id, { status: event.target.value as ExpressionStatus, lastReviewedAt: new Date().toISOString() })}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
            <button className="icon-button danger" onClick={() => onDelete(item.id)} title="删除"><Icon name="trash" /></button>
          </footer>
          <small>适用 Part {item.suitableParts.join(" / ")} · 推荐 {item.recommendationCount} 次 · 成功使用 {item.successfulUses} 次</small>
        </article>
      ))}</div> : <div className="empty-panel"><Icon name="note" size={34} /><h2>这里还没有匹配的推荐</h2><p>完成练习后，系统会根据你的回答、重复用词和纠错生成少量建议。</p></div>}
    </section>
  );
}
