const storage = require("../../services/storage");
const ui = require("../../utils/page");
Page({
  data: { text: "", error: "" },
  input(e) {
    this.setData({ text: e.detail.value, error: "" });
  },
  copy() {
    ui.guard(() => {
      const backup = storage.exportBackup();
      wx.setClipboardData({
        data: backup,
        success: () => wx.showToast({ title: "备份已复制" }),
        fail: () => ui.toast(new Error("复制失败，请重试。")),
      });
    });
  },
  restore() {
    let checked;
    try {
      checked = storage.parseBackup(this.data.text);
      this.setData({ error: "" });
    } catch (e) {
      this.setData({ error: e.message });
      return;
    }
    wx.showModal({
      title: "覆盖当前学习数据？",
      content: `即将恢复 ${checked.sessions.length} 条训练记录。当前数据会被覆盖，请先备份。`,
      success: (r) => {
        if (r.confirm)
          ui.guard(() => {
            storage.save(checked, true);
            wx.showToast({ title: "恢复成功" });
            this.setData({ text: "" });
          });
      },
    });
  },
  clear() {
    wx.showModal({
      title: "清空当前设备的所有学习数据？",
      content: "数据仅保存在当前设备。清空后无法撤销，请先复制备份。",
      confirmText: "继续清空",
      success: (r) => {
        if (!r.confirm) return;
        wx.showModal({
          title: "再次确认清空",
          content: "所有训练、学习库与复习数据都会删除。",
          confirmText: "确认清空",
          confirmColor: "#a14343",
          success: (r2) => {
            if (r2.confirm)
              ui.guard(() => {
                storage.clear();
                this.setData({ text: "" });
                wx.showToast({ title: "已清空" });
              });
          },
        });
      },
    });
  },
});
