const training = require("../../services/trainingService");
const ui = require("../../utils/page");
Page({
  data: { busy: false },
  onLoad(q) {
    this.sid = q.sid;
  },
  onShow() {
    const s = training.get(this.sid);
    const f =
      s &&
      (s.feedback ||
        (s.answers.length && s.answers[s.answers.length - 1].feedback));
    this.setData({
      session: s,
      notice: ui.notice,
      feedback: f || null,
      original:
        s && s.answers.length ? s.answers[s.answers.length - 1].text : "",
    });
  },
  finish() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      const s = training.advance(this.sid);
      if (s.completed)
        wx.redirectTo({
          url: "/pages/candidate-select/candidate-select?sid=" + this.sid,
        });
      else wx.navigateBack();
    } catch (e) {
      ui.toast(e);
    } finally {
      this.setData({ busy: false });
    }
  },
  candidates() {
    wx.navigateTo({
      url: "/pages/candidate-select/candidate-select?sid=" + this.sid,
    });
  },
});
