const bank = require("../../services/bankService");
const storage = require("../../services/storage");
const mothers = require("../../data/motherSentences");
Page({
  data: {
    type: "expression",
    query: "",
    filter: 0,
    motherOptions: ["全部母句"].concat(mothers.map((m) => m.id)),
    tabs: [
      { id: "expression", name: "表达 / Chunk" },
      { id: "mistake", name: "错误库" },
      { id: "natural_upgrade", name: "自然升级" },
    ],
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const d = storage.load(),
      mid = this.data.filter ? mothers[this.data.filter - 1].id : "";
    const q = this.data.query.trim().toLowerCase();
    this.setData({
      items: d.banks[this.data.type]
        .filter(
          (b) =>
            (!mid || b.sourceMotherSentenceId === mid) &&
            (!q ||
              [bank.expression(b), bank.meaning(b), b.myExpression || ""]
                .join(" ")
                .toLowerCase()
                .includes(q)),
        )
        .map((b) =>
          Object.assign({}, b, {
            text: bank.expression(b),
            meaning: bank.meaning(b),
            date: b.nextReviewAt ? b.nextReviewAt.slice(0, 10) : "周期完成",
          }),
        ),
    });
  },
  tab(e) {
    this.setData({ type: e.currentTarget.dataset.id });
    this.refresh();
  },
  search(e) {
    this.setData({ query: e.detail.value });
    this.refresh();
  },
  filter(e) {
    this.setData({ filter: Number(e.detail.value) });
    this.refresh();
  },
  open(e) {
    wx.navigateTo({
      url: "/pages/bank-detail/bank-detail?id=" + e.currentTarget.dataset.id,
    });
  },
});
