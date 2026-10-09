const storage = require("../../services/storage");
const stats = require("../../services/statsService");
const ui = require("../../utils/page");
Page({
  data: { demo: ui.demo },
  onShow() {
    const d = storage.load();
    this.setData({
      stats: stats.get(),
      active: d.sessions.find((s) => !s.completed) || null,
    });
  },
  start: ui.today,
  continue() {
    if (this.data.active) ui.goSession(this.data.active);
  },
  mothers() {
    wx.navigateTo({ url: "/pages/mother-list/mother-list" });
  },
  free() {
    wx.navigateTo({ url: "/pages/free-expression/free-expression" });
  },
  reviews() {
    wx.switchTab({ url: "/pages/review/review" });
  },
});
