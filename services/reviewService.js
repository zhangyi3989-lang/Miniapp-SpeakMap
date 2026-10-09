const storage = require("./storage");
const id = require("../utils/id");
const { addDays, due } = require("../utils/date");
const config = require("../config/trainingConfig");
const mothers = require("../data/motherSentences");
const bank = require("./bankService");
const names = ["想得起", "换得开", "接得下", "用得活", "用得出"];
function scheduleMother(d, motherId, now = new Date().toISOString()) {
  if (d.reviews.some((r) => r.kind === "mother" && r.sourceId === motherId))
    return;
  d.reviews.push({
    id: id("review"),
    kind: "mother",
    sourceId: motherId,
    stage: 0,
    nextReviewAt: addDays(now, config.review.intervalsDays[0]),
    history: [],
    completed: false,
  });
}
function dueItems(now = Date.now()) {
  return storage
    .load()
    .reviews.filter((r) => !r.completed && due(r.nextReviewAt, now))
    .sort((a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt));
}
function content(r) {
  if (r.kind === "mother") {
    const m = mothers.find((m) => m.id === r.sourceId);
    if (!m) throw new Error("母句内容不存在。");
    return {
      title: m.id,
      prompt: m.review[r.stage],
      reference: m.examples[0],
      name: names[r.stage],
    };
  }
  const b = bank.get(r.sourceId);
  if (!b) throw new Error("学习条目已删除。");
  const prompts = [
    bank.meaning(b),
    "换一个人物或时间，用你自己的内容表达：" + bank.meaning(b),
    "围绕这个意思表达，并继续补充 2–3 句：" + bank.meaning(b),
    "在一次临时改变计划的经历中，表达这个意思：" + bank.meaning(b),
    "你会如何帮助朋友解决生活中的一个困难？独立回答。",
  ];
  return {
    title: "学习库复习",
    prompt: prompts[r.stage],
    reference: bank.expression(b),
    name: names[r.stage],
  };
}
function rate(sessionId, recalled, scene) {
  storage.transact((d) => {
    const s = d.sessions.find((s) => s.sessionId === sessionId);
    if (!s || s.completed) return;
    if (!s.revealed || !s.answers.length)
      throw new Error("请先回忆并查看参考。");
    const r = d.reviews.find((r) => r.id === s.reviewId);
    if (!r) throw new Error("复习项目已删除。");
    const now = new Date().toISOString(),
      stage = r.stage;
    const event = {
      at: now,
      stage,
      recalled: !!recalled,
      answer: s.answers[0].text,
      sceneAnswer: scene || "",
      provenance: "user",
      userProduced: false,
    };
    r.history.push(event);
    s.sceneAnswer = scene || "";
    s.completed = true;
    s.updatedAt = now;
    if (recalled && stage === 4) {
      r.completed = true;
      r.nextReviewAt = null;
    } else {
      if (recalled) r.stage++;
      r.nextReviewAt = addDays(
        now,
        recalled
          ? config.review.intervalsDays[r.stage]
          : config.review.retryAfterFailDays,
      );
    }
    if (r.kind === "mother") {
      const p = d.motherSentenceProgress[r.sourceId];
      if (p) p.status = r.completed ? "completed_review_cycle" : "reviewing";
    } else {
      const b = d.banks[r.bankType].find((b) => b.id === r.sourceId);
      if (b) {
        b.reviewStage = r.stage;
        b.nextReviewAt = r.nextReviewAt;
        b.reviewStatus = r.completed ? "completed_review_cycle" : "scheduled";
        b.reviewHistory = r.history;
        if (scene)
          b.sceneAnswers.push({
            text: scene,
            at: now,
            stage,
            sourceId: b.id,
            provenance: "user",
            userProduced: false,
          });
      }
    }
  });
}
module.exports = { names, scheduleMother, dueItems, content, rate };
