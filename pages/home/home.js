const scheduler = require("../../services/learningScheduler");
const ui = require("../../utils/page");
Page({
  data: { demo: ui.demo },
  onShow() {
    const plan = scheduler.plan();
    this.setData({
      plan,
      current: plan.steps[0] || {
        title: "今日学习已完成",
        detail: "可以浏览学习资料，或练习自己的表达。",
      },
      upcomingSteps: plan.steps.slice(1),
    });
  },
  start: ui.today,
  mothers() {
    wx.navigateTo({ url: "/pages/mother-list/mother-list" });
  },
  functions() {
    wx.navigateTo({ url: "/pages/function-list/function-list" });
  },
});
