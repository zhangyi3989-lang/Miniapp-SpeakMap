const scheduler = require("../../services/learningScheduler");
const ui = require("../../utils/page");
Page({
  data: { demo: ui.demo, expanded: false, statusBarHeight: 24 },
  onShow() {
    const plan = scheduler.plan();
    this.setData({
      statusBarHeight: wx.getWindowInfo
        ? wx.getWindowInfo().statusBarHeight
        : 24,
      plan,
      current: plan.steps[0] || {
        title: "今日学习已完成",
        detail: "可以浏览学习资料，或练习自己的表达。",
      },
      upcomingSteps: plan.steps.slice(1),
      previewSteps: plan.steps.slice(1, 4),
      pendingCount: plan.steps.slice(1).length + plan.upcoming.length,
    });
  },
  togglePlan() {
    this.setData({ expanded: !this.data.expanded });
  },
  start: ui.today,
  mothers() {
    wx.navigateTo({ url: "/pages/mother-list/mother-list" });
  },
  functions() {
    wx.navigateTo({ url: "/pages/function-list/function-list" });
  },
});
