const mothers = require("../../data/motherSentences");
const catalog = require("../../data/motherCatalog");
const storage = require("../../services/storage");
const training = require("../../services/trainingService");
const ui = require("../../utils/page");
Page({
  data: {},
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
      mother: Object.assign(
        {},
        m,
        catalog.find((x) => x.id === m.id),
      ),
      blocks: (catalog.find((x) => x.id === m.id) || {}).blocks || [],
      examples: (catalog.find((x) => x.id === m.id).pairs || []).slice(0, 3),
      progress: storage.load().motherSentenceProgress[this.mid] || null,
    });
  },
  details() {
    wx.navigateTo({
      url:
        "/pages/mother-lesson/mother-lesson?id=" +
        this.mid +
        (this.fromTraining ? "&from=training" : ""),
    });
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
        ui.today();
        return;
      }
      ui.goSession(training.create("training", this.mid));
    });
  },
});
