const training = require("../../services/trainingService");
const bank = require("../../services/bankService");
const ui = require("../../utils/page");
Page({
  data: { selected: [], busy: false },
  onLoad(q) {
    this.sid = q.sid;
  },
  onShow() {
    const s = training.get(this.sid);
    this.setData({
      selected: [],
      session: s,
      items:
        s && s.completed
          ? bank
              .dedupe(s.candidates)
              .map((c) =>
                Object.assign({}, c, {
                  text: bank.expression(c.data),
                  meaning: bank.meaning(c.data),
                  checked: false,
                  typeName: {
                    expression: "Expression Bank",
                    mistake: "Mistake Bank",
                    natural_upgrade: "Natural Upgrade",
                  }[c.bankType],
                }),
              )
          : [],
    });
  },
  select(e) {
    this.setData({
      selected: e.detail.value,
      items: this.data.items.map((c) =>
        Object.assign({}, c, { checked: e.detail.value.includes(c.id) }),
      ),
    });
  },
  add() {
    if (this.data.busy) return;
    if (!this.data.selected.length) {
      wx.showToast({ title: "请先勾选想学习的内容", icon: "none" });
      return;
    }
    this.setData({ busy: true });
    try {
      const items = this.data.items.filter((c) =>
        this.data.selected.includes(c.id),
      );
      const result = bank.add(
        items,
        this.sid,
        this.data.session.motherSentenceId,
      );
      wx.showModal({
        title: "入库结果",
        content: `已加入 ${result.added} 条；${result.duplicates} 条已经在学习库中。`,
        showCancel: false,
      });
      this.setData({
        selected: [],
        items: this.data.items.map((c) =>
          Object.assign({}, c, { checked: false }),
        ),
      });
    } catch (e) {
      ui.toast(e);
    } finally {
      this.setData({ busy: false });
    }
  },
  home() {
    wx.switchTab({ url: "/pages/home/home" });
  },
});
