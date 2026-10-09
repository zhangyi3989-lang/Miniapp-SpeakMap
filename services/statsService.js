const storage = require("./storage");
const { day } = require("../utils/date");
const review = require("./reviewService");
module.exports = {
  get() {
    const d = storage.load(),
      answers = d.sessions.flatMap((s) => s.answers);
    return {
      days: new Set(answers.map((a) => day(a.at))).size,
      answers: answers.length,
      started: Object.keys(d.motherSentenceProgress).length,
      completed: Object.values(d.motherSentenceProgress).filter(
        (p) => p.firstTrainingCompletedAt,
      ).length,
      stages: d.sessions
        .filter((s) => s.sessionType === "training")
        .reduce(
          (n, s) =>
            n +
            (s.completed
              ? 6
              : ["L1", "L2", "L3", "L4", "L5", "L6"].indexOf(s.level)),
          0,
        ),
      reviews: d.reviews.reduce((n, r) => n + r.history.length, 0),
      banks: Object.values(d.banks).reduce((n, list) => n + list.length, 0),
      due: review.dueItems().length,
    };
  },
};
