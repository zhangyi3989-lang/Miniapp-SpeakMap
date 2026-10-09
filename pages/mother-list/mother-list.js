const mothers = require("../../data/motherSentences");
const storage = require("../../services/storage");
const review = require("../../services/reviewService");
Page({
  onShow() {
    const d = storage.load(),
      due = review.dueItems();
    const labels = {
      learning: "学习中",
      reviewing: "复习中",
      completed_review_cycle: "完成复习周期",
    };
    this.setData({
      items: mothers.map((m) =>
        Object.assign({}, m, {
          status: due.some((r) => r.kind === "mother" && r.sourceId === m.id)
            ? "待复习"
            : labels[(d.motherSentenceProgress[m.id] || {}).status] || "未开始",
        }),
      ),
    });
  },
  open(e) {
    wx.navigateTo({
      url:
        "/pages/mother-detail/mother-detail?id=" + e.currentTarget.dataset.id,
    });
  },
});
