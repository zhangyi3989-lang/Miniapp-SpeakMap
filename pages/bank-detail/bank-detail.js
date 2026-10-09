const bank = require("../../services/bankService");
const ui = require("../../utils/page");
const config = require("../../config/trainingConfig");
Page({
  data: { editing: false, max: config.inputMaxLength },
  onLoad(q) {
    this.bid = q.id;
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const b = bank.get(this.bid);
    if (!b) {
      wx.navigateBack();
      return;
    }
    this.setData({
      item: b,
      text: bank.expression(b),
      meaning: bank.meaning(b),
      why: b.why || "",
      myExpression: b.myExpression || "",
      example: b.example || "",
    });
  },
  edit() {
    this.setData({ editing: true });
  },
  change(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },
  cancel() {
    this.setData({ editing: false });
    this.refresh();
  },
  save() {
    ui.guard(() => {
      const b = this.data.item,
        fields = { meaningZh: this.data.meaning.trim() };
      const field =
        b.bankType === "expression"
          ? "expression"
          : b.bankType === "mistake"
            ? "recommendedExpression"
            : "naturalExpression";
      fields[field] = this.data.text.trim();
      if (b.bankType !== "expression") {
        fields.myExpression = this.data.myExpression.trim();
        fields.why = this.data.why.trim();
      } else fields.example = this.data.example.trim();
      bank.edit(this.bid, fields);
      this.setData({ editing: false });
      this.refresh();
      wx.showToast({ title: "已保存", icon: "success" });
    });
  },
  remove() {
    wx.showModal({
      title: "删除这条学习内容？",
      content: "相关复习安排也会删除。",
      success: (r) => {
        if (r.confirm)
          ui.guard(() => {
            bank.remove(this.bid);
            wx.navigateBack();
          });
      },
    });
  },
});
