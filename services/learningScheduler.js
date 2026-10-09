const storage = require("./storage");
const training = require("./trainingService");
const reviews = require("./reviewService");
const mothers = require("../data/motherSentences");
const config = require("../config/trainingConfig");
function next(now = Date.now()) {
  const d = storage.load(),
    active = d.sessions.find((s) => !s.completed);
  if (active) return { kind: "session", session: active };
  const due = reviews.dueItems(now);
  if (due.length)
    return {
      kind: "session",
      session: training.create(
        "review",
        due[0].kind === "mother" ? due[0].sourceId : "",
        { reviewId: due[0].id },
      ),
    };
  if (config.quickRecall.enabled) {
    const m = mothers.find((m) => {
      const p = d.motherSentenceProgress[m.id];
      return (
        p &&
        p.firstTrainingCompletedAt &&
        !p.quickRecallDone &&
        !d.reviews.some(
          (r) => r.kind === "mother" && r.sourceId === m.id && r.history.length,
        )
      );
    });
    if (m) return { kind: "session", session: training.create("quick", m.id) };
  }
  const m = mothers.find((m) => !d.motherSentenceProgress[m.id]);
  if (m) return { kind: "session", session: training.create("training", m.id) };
  return { kind: "empty" };
}
// 只读取路径预览，不创建任务或推进进度。
function plan(now = Date.now()) {
  const d = storage.load(),
    active = d.sessions.find((s) => !s.completed),
    steps = [];
  if (active) {
    let title, detail;
    if (active.sessionType === "training") {
      title = `继续母句 ${active.motherSentenceId}`;
      const rank = Number(active.level.slice(1));
      const remaining = Array.from(
        { length: 6 - rank },
        (_, i) => "L" + (rank + i + 1),
      );
      detail =
        active.phase === "phase0"
          ? "上次停在快速学习；接下来完成 L1–L6。"
          : `上次停在 ${active.level} · ${training.titles[active.level]}；${remaining.length ? "完成当前阶段后，还需 " + remaining.join("、") : "完成当前 L6 后，本母句首次训练结束"}。`;
    } else if (active.sessionType === "review") {
      const r = d.reviews.find((r) => r.id === active.reviewId);
      title = r
        ? `${r.kind === "mother" ? "母句 " + r.sourceId : "学习库条目"} · R${r.stage + 1} 复习`
        : "继续上次复习";
      detail = "先从上次未完成的位置继续。";
    } else {
      title =
        active.sessionType === "quick"
          ? `母句 ${active.motherSentenceId} · 简短回忆检查`
          : "继续上次自由表达";
      detail = "先完成上次未结束的练习。";
    }
    steps.push({ title, detail, kind: "current" });
  }
  const due = reviews
    .dueItems(now)
    .filter((r) => !active || r.id !== active.reviewId);
  for (const r of due)
    steps.push({
      title: `${r.kind === "mother" ? "母句 " + r.sourceId : "学习库条目"} · R${r.stage + 1} 复习`,
      detail: "已到期 · 先回忆，再换场景表达。",
      kind: "review",
    });
  if (config.quickRecall.enabled) {
    if (active && active.sessionType === "training")
      steps.push({
        title: `母句 ${active.motherSentenceId} · 完成后的回忆检查`,
        detail:
          "首次训练完成后，若尚未做过正式复习，会先安排简短回忆，再进入新母句。",
        kind: "recall",
      });
    for (const m of mothers) {
      const p = d.motherSentenceProgress[m.id];
      if (
        p &&
        p.firstTrainingCompletedAt &&
        !p.quickRecallDone &&
        !d.reviews.some(
          (r) => r.kind === "mother" && r.sourceId === m.id && r.history.length,
        ) &&
        !(
          active &&
          active.sessionType === "quick" &&
          active.motherSentenceId === m.id
        )
      ) {
        steps.push({
          title: `母句 ${m.id} · 简短回忆检查`,
          detail: "检查刚完成的母句能否想起来，再进入新学习。",
          kind: "recall",
        });
      }
    }
  }
  const fresh = mothers.find((m) => !d.motherSentenceProgress[m.id]);
  if (fresh)
    steps.push({
      title: `新母句 ${fresh.id}`,
      detail: "完成前面的安排后，从核心介绍开始学习。",
      kind: "new",
    });
  const upcoming = d.reviews
    .filter((r) => !r.completed && Date.parse(r.nextReviewAt) > now)
    .sort((a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt))
    .map((r) => ({
      title: `${r.kind === "mother" ? "母句 " + r.sourceId : "学习库条目"} · R${r.stage + 1}`,
      detail: `约 ${Math.max(1, Math.ceil((Date.parse(r.nextReviewAt) - now) / 86400000))} 天后到期，届时自动安排。`,
    }));
  return { steps, upcoming };
}
module.exports = { next, plan };
