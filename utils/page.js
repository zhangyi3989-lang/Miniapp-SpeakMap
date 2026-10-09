const config = require("../config/appConfig");
function toast(error) {
  wx.showToast({ title: error.message || String(error), icon: "none" });
}
function guard(action) {
  try {
    return action();
  } catch (e) {
    toast(e);
  }
}
function goSession(s) {
  if (s.sessionType === "review") {
    wx.switchTab({ url: "/pages/review/review" });
    return;
  }
  wx.navigateTo({ url: `/pages/training/training?sid=${s.sessionId}` });
}
function today() {
  guard(() => {
    const task = require("../services/learningScheduler").next();
    if (task.kind === "empty") {
      wx.showModal({
        title: "今天没有到期复习",
        content: "可以自由表达、浏览学习库，或在复习页换场景练习。",
        showCancel: false,
      });
      return;
    }
    goSession(task.session);
  });
}
module.exports = {
  toast,
  guard,
  goSession,
  today,
  demo: config.AI_MODE === "demo",
  notice: config.demoNotice,
};
