const scheduler = require("../../services/learningScheduler");
const ui = require("../../utils/page");
Page({
  data: { demo: ui.demo },
  onShow() {
    this.setData({
      plan: scheduler.plan(),
    });
  },
  start: ui.today,
  mothers() {
    wx.navigateTo({ url: "/pages/mother-list/mother-list" });
  },
  free() {
    wx.navigateTo({ url: "/pages/free-expression/free-expression" });
  },
});
