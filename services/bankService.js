const storage = require("./storage");
const id = require("../utils/id");
const { normalize } = require("../utils/text");
const { addDays } = require("../utils/date");
const config = require("../config/trainingConfig");
const types = ["expression", "mistake", "natural_upgrade"];
const expression = (b) =>
  b.expression || b.recommendedExpression || b.naturalExpression || "";
const meaning = (b) => b.meaningZh || b.meaningOrDifference || "";
const key = (c) => c.bankType + ":" + normalize(expression(c.data || c));
function dedupe(candidates) {
  const seen = new Set();
  return candidates.filter((c) => {
    if (!types.includes(c.bankType) || !expression(c.data)) return false;
    const k = key(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function add(candidates, sourceTrainingId, sourceMotherSentenceId) {
  return storage.transact((d) => {
    let added = 0,
      duplicates = 0;
    dedupe(candidates).forEach((c) => {
      const list = d.banks[c.bankType];
      if (
        list.some(
          (b) => normalize(expression(b)) === normalize(expression(c.data)),
        )
      ) {
        duplicates++;
        return;
      }
      const now = new Date().toISOString();
      const b = Object.assign({}, c.data, {
        id: id("bank"),
        bankType: c.bankType,
        sourceTrainingId,
        sourceMotherSentenceId: sourceMotherSentenceId || "",
        createdAt: now,
        provenance: c.provenance,
        userProduced: false,
        reviewStatus: "scheduled",
        reviewStage: 0,
        nextReviewAt: addDays(now, config.review.intervalsDays[0]),
        reviewHistory: [],
        sceneAnswers: [],
      });
      b.meaningZh = meaning(b);
      list.push(b);
      d.reviews.push({
        id: id("review"),
        kind: "bank",
        bankType: c.bankType,
        sourceId: b.id,
        stage: 0,
        nextReviewAt: b.nextReviewAt,
        history: [],
        completed: false,
      });
      added++;
    });
    return { added, duplicates };
  });
}
function get(idValue) {
  const d = storage.load();
  for (const t of types) {
    const b = d.banks[t].find((x) => x.id === idValue);
    if (b) return b;
  }
  return null;
}
function edit(idValue, fields) {
  return storage.transact((d) => {
    for (const t of types) {
      const b = d.banks[t].find((x) => x.id === idValue);
      if (!b) continue;
      const next = Object.assign({}, b, fields);
      if (!expression(next).trim()) throw new Error("表达不能为空。");
      if (
        d.banks[t].some(
          (x) =>
            x.id !== idValue &&
            normalize(expression(x)) === normalize(expression(next)),
        )
      )
        throw new Error("这条内容已经在学习库中。");
      Object.assign(b, fields, { updatedAt: new Date().toISOString() });
      return b;
    }
    throw new Error("条目已删除。");
  });
}
function remove(idValue) {
  storage.transact((d) => {
    types.forEach((t) => {
      d.banks[t] = d.banks[t].filter((b) => b.id !== idValue);
    });
    const refs = d.reviews
      .filter((r) => r.sourceId === idValue)
      .map((r) => r.id);
    d.reviews = d.reviews.filter((r) => r.sourceId !== idValue);
    d.sessions = d.sessions.filter(
      (s) => s.sessionType !== "review" || !refs.includes(s.reviewId),
    );
  });
}
module.exports = { types, expression, meaning, dedupe, add, get, edit, remove };
