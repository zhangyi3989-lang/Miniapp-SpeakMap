const stats = require("../../services/statsService");
const training = require("../../services/trainingService");
const storage = require("../../services/storage");
Page({
  data: { detailsOpen: false, recordsOpen: false },
  onShow() {
    const d = storage.load();
    this.setData({
      stats: stats.get(),
      records: d.sessions
        .slice()
        .reverse()
        .slice(0, 12)
        .map((s) => {
          const r = d.reviews.find((r) => r.id === s.reviewId);
          const event = r && r.history.find((h) => h.at === s.updatedAt);
          return Object.assign({}, s, {
            date: s.updatedAt.slice(5, 10).replace("-", "月") + "日",
            answerCount: training.answerCount(s),
            label:
              s.sessionType === "review"
                ? (s.motherSentenceId || "学习库") +
                  " · R" +
                  ((event ? event.stage : r ? r.stage : 0) + 1) +
                  " 复习"
                : s.sessionType === "training"
                  ? s.motherSentenceId +
                    " · " +
                    (s.phase === "phase0"
                      ? "快速学习"
                      : s.level + " " + training.titles[s.level])
                  : s.sessionType === "quick"
                    ? s.motherSentenceId + " · 回忆检查"
                    : "自由表达",
          });
        }),
    });
    this.setData({recentRecords:this.data.records.slice(0,2)});
  },
  toggleRecords() {
    this.setData({ recordsOpen: !this.data.recordsOpen });
  },
  toggleDetails() {
    this.setData({ detailsOpen: !this.data.detailsOpen });
  },
  backup() {
    wx.navigateTo({ url: "/pages/backup/backup" });
  },
  record(e) {
    wx.navigateTo({
      url: "/pages/record/record?sid=" + e.currentTarget.dataset.id,
    });
  },
});
