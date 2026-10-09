const training = require("../../services/trainingService");
const mothers = require("../../data/motherSentences");
const ai = require("../../services/ai/index");
const ui = require("../../utils/page");
const config = require("../../config/trainingConfig");
Page({
  data: {
    busy: false,
    helperOpen: false,
    demo: ui.demo,
    max: config.inputMaxLength,
    r1Days: config.review.intervalsDays[0],
    error: "",
  },
  onLoad(q) {
    this.sid = q.sid;
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    ui.guard(() => {
      const s = training.get(this.sid);
      if (!s) {
        wx.navigateBack();
        return;
      }
      if (s.sessionType === "review") {
        wx.switchTab({ url: "/pages/review/review" });
        return;
      }
      const m = mothers.find((m) => m.id === s.motherSentenceId) || null;
      this.setData({
        session: s,
        mother: m,
        task: s.completed ? null : training.task(s),
        input: s.draft || "",
        feedback: s.feedback,
        error: "",
      });
    });
  },
  input(e) {
    this.setData({ input: e.detail.value });
    try {
      training.saveDraft(this.sid, e.detail.value);
      this.setData({ error: "" });
    } catch (err) {
      this.setData({ error: err.message });
    }
  },
  begin() {
    ui.guard(() => {
      training.begin(this.sid);
      this.refresh();
    });
  },
  helpers() {
    this.setData({ helperOpen: !this.data.helperOpen });
  },
  async submit() {
    if (this.data.busy || this.data.feedback) return;
    this.setData({ busy: true, error: "" });
    try {
      await training.submit(
        this.sid,
        this.data.input,
        this.data.session.sessionType === "free"
          ? ai.analyzeFreeExpression
          : ai.analyzeTrainingResponse,
      );
      this.refresh();
      if (this.data.session.sessionType === "free")
        wx.navigateTo({ url: "/pages/feedback/feedback?sid=" + this.sid });
    } catch (e) {
      this.setData({
        error:
          e.message === "先写下你的回答。"
            ? e.message
            : "反馈生成失败。" + e.message,
      });
    } finally {
      this.setData({ busy: false });
    }
  },
  next() {
    if (this.data.busy) return;
    ui.guard(() => {
      const s = training.advance(this.sid);
      this.setData({ helperOpen: false });
      this.refresh();
      if (s.completed && s.candidates.length)
        wx.navigateTo({
          url: "/pages/candidate-select/candidate-select?sid=" + this.sid,
        });
    });
  },
  candidates() {
    wx.navigateTo({
      url: "/pages/candidate-select/candidate-select?sid=" + this.sid,
    });
  },
  home() {
    wx.switchTab({ url: "/pages/home/home" });
  },
});
