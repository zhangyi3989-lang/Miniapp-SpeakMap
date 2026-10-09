const mothers = require("../../data/motherSentences");
const storage = require("../../services/storage");
const training = require("../../services/trainingService");
const ui = require("../../utils/page");
Page({
  onLoad(q) {
    this.mid = q.id;
  },
  onShow() {
    const m = mothers.find((x) => x.id === this.mid);
    if (!m) {
      wx.navigateBack();
      return;
    }
    this.setData({
      mother: m,
      progress: storage.load().motherSentenceProgress[this.mid] || null,
    });
  },
  start() {
    ui.guard(() => {
      const d = storage.load(),
        active = d.sessions.find((s) => !s.completed);
      if (active) {
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
