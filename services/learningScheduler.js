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
module.exports = { next };
