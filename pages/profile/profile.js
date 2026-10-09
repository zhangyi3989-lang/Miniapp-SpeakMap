const stats = require("../../services/statsService");
const storage = require("../../services/storage");
Page({
  onShow() {
    const d = storage.load();
    this.setData({
      stats: stats.get(),
      records: d.sessions
        .slice()
        .reverse()
        .slice(0, 12)
        .map((s) => Object.assign({}, s, { date: s.updatedAt.slice(0, 10) })),
    });
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
