const scheduler = require("../../services/learningScheduler");
const storage = require("../../services/storage");
const training = require("../../services/trainingService");
const ui = require("../../utils/page");
Page({
  data: { demo: ui.demo, expanded: false, statusBarHeight: 24 },
  onShow() {
    const plan = scheduler.plan();
    const active=storage.load().sessions.find(s=>!s.completed);
    const current=plan.steps[0];
    this.setData({
      currentTitle: active && active.sessionType==='training' ? `${active.motherSentenceId} · ${active.phase==='phase0'?'快速学习':active.level+' '+training.titles[active.level]}` : current ? current.title.replace(/^母句 /,'') : '今日学习已完成',
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
