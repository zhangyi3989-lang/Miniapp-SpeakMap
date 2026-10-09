const stats = require("../../services/statsService");
const ui = require("../../utils/page");
Page({
  data: { demo: ui.demo },
  onShow() {
    this.setData({
      stats: stats.get(),
    });
  },
  start: ui.today,
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
