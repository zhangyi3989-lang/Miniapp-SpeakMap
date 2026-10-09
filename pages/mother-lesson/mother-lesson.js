const mothers = require("../../data/motherSentences");
const storage = require("../../services/storage");
const training = require("../../services/trainingService");
const ui = require("../../utils/page");
Page({
  data: { expanded: true, selected: "", checkResult: null },
  onLoad(q) {
    this.mid = q.id;
    this.fromTraining = q.from === "training";
  },
  onShow() {
    const m = mothers.find((x) => x.id === this.mid);
    if (!m) {
      wx.navigateBack();
      return;
    }
    this.setData({
      mother: m,
      lesson: require("../../data/motherLessons")[m.id] || null,
      examples: m.examples.map((en, i) => ({
        en,
        zh: m.referenceMeanings[en] || "",
        note:
          (require("../../data/motherLessons")[m.id] || { exampleNotes: [] })
            .exampleNotes[i] || "",
      })),
      progress: storage.load().motherSentenceProgress[this.mid] || null,
    });
  },
  toggleDetails() {
    this.setData({ expanded: !this.data.expanded });
  },
  check(e) {
    const option = this.data.lesson.check.options.find(
      (o) => o.id === e.currentTarget.dataset.id,
    );
    if (option) this.setData({ selected: option.id, checkResult: option });
  },
  start() {
    ui.guard(() => {
      const d = storage.load(),
        active = d.sessions.find((s) => !s.completed);
      if (active) {
        if (this.fromTraining && active.motherSentenceId === this.mid) {
          wx.navigateBack();
          return;
        }
        ui.goSession(active);
        return;
      }
      if (d.motherSentenceProgress[this.mid]) {
        wx.switchTab({ url: "/pages/review/review" });
        return;
      }
      ui.goSession(training.create("training", this.mid));
    });
  },
});
