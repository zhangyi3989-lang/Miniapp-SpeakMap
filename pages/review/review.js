const storage = require("../../services/storage");
const reviews = require("../../services/reviewService");
const training = require("../../services/trainingService");
const mothers = require("../../data/motherSentences");
const bank = require("../../services/bankService");
const ui = require("../../utils/page");
const validation = require("../../utils/validation");
const config = require("../../config/trainingConfig");
Page({
  data: {
    selectedType: "",
    session: null,
    max: config.inputMaxLength,
    input: "",
    scene: "",
    busy: false,
    error: "",
  },
  onLoad(q) {
    this.sid = q.sid || "";
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    ui.guard(() => {
      if (!this.sid) {
        const active = storage
          .load()
          .sessions.find((s) => !s.completed && s.sessionType === "review");
        if (active) this.sid = active.sessionId;
      }
      if (this.sid) {
        const s = training.get(this.sid);
        if (s && !s.completed) {
          const r = storage.load().reviews.find((r) => r.id === s.reviewId);
          this.setData({
            session: s,
            task: reviews.content(r),
            stage: r.stage,
            input: s.draft || "",
            scene: s.sceneDraft || "",
          });
          return;
        }
        this.sid = "";
      }
      const d = storage.load(),
        due = reviews.dueItems();
      this.setData({
        session: null,
        categories: [
          {
            type: "mistake",
            name: "错误库复习",
            description: "修正常见错误，让表达更准确",
          },
          {
            type: "natural_upgrade",
            name: "地道升级库复习",
            description: "用更自然的说法，提升表达质感",
          },
          {
            type: "expression",
            name: "Chunk库复习",
            description: "积累实用的地道表达片段",
          },
        ].map((c) =>
          Object.assign({}, c, {
            total: d.banks[c.type].length,
            due: due.filter((r) => r.kind === "bank" && r.bankType === c.type)
              .length,
          }),
        ),
        items: d.reviews
          .filter(
            (r) =>
              !r.completed &&
              r.kind === "bank" &&
              r.bankType === this.data.selectedType,
          )
          .sort(
            (a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt),
          )
          .map((r) =>
            Object.assign({}, r, {
              isDue: due.some((x) => x.id === r.id),
              date: r.nextReviewAt.slice(0, 10),
              label:
                r.kind === "mother"
                  ? r.sourceId
                  : bank.expression(bank.get(r.sourceId) || {}) || "学习库",
            }),
          ),
        dueCount: due.length,
        practiceMothers: mothers.filter(
          (m) =>
            d.motherSentenceProgress[m.id] &&
            d.motherSentenceProgress[m.id].firstTrainingCompletedAt,
        ),
      });
    });
  },
  startBank(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ selectedType: type });
    this.refresh();
    const due = this.data.items && this.data.items.find((r) => r.isDue);
    if (due) this.open({ currentTarget: { dataset: { id: due.id } } });
  },
  selectBank(e) {
    this.setData({ selectedType: e.currentTarget.dataset.type });
    this.refresh();
  },
  open(e) {
    ui.guard(() => {
      const r = storage
        .load()
        .reviews.find((r) => r.id === e.currentTarget.dataset.id);
      if (!r || Date.parse(r.nextReviewAt) > Date.now()) return;
      const active = storage.load().sessions.find((s) => !s.completed);
      if (active) {
        if (active.sessionType !== "review") {
          ui.goSession(active);
          return;
        }
        this.sid = active.sessionId;
      } else
        this.sid = training.create(
          "review",
          r.kind === "mother" ? r.sourceId : "",
          { reviewId: r.id },
        ).sessionId;
      this.refresh();
    });
  },
  continue() {
    const s = storage.load().sessions.find((s) => !s.completed);
    if (s) {
      if (s.sessionType === "review") {
        this.sid = s.sessionId;
        this.refresh();
      } else ui.goSession(s);
    } else {
      ui.today();
      this.refresh();
    }
  },
  voiceState(e) { this.setData({ voiceBusy: e.detail.busy }); },
  input(e) {
    this.setData({ input: e.detail.value });
    try {
      training.saveDraft(this.sid, e.detail.value);
      this.setData({ error: "" });
    } catch (err) {
      this.setData({ error: err.message });
    }
  },
  scene(e) {
    this.setData({ scene: e.detail.value });
    try {
      training.update(this.sid, (s) => {
        s.sceneDraft = e.detail.value;
      });
    } catch (err) {
      this.setData({ error: err.message });
    }
  },
  reveal() {
    if (this.data.voiceBusy) return;
    ui.guard(() => {
      training.reveal(this.sid, this.data.input);
      this.refresh();
    });
  },
  rate(e) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      let scene = this.data.scene.trim();
      if (scene) scene = validation.input(scene);
      reviews.rate(this.sid, e.currentTarget.dataset.recalled === "yes", scene);
      this.sid = "";
      this.setData({ input: "", scene: "", error: "" });
      this.refresh();
      wx.showToast({ title: "已记录自评", icon: "success" });
    } catch (err) {
      this.setData({ error: err.message });
    } finally {
      this.setData({ busy: false });
    }
  },
  practice(e) {
    ui.guard(() => {
      ui.goSession(
        training.create("free", e.currentTarget.dataset.id, {
          topic: {
            zh: "换一个你之前没练过的场景，写一个自己的新句子。",
            en: "Describe a new situation in your own words.",
            reference: mothers.find((m) => m.id === e.currentTarget.dataset.id)
              .examples[0],
          },
        }),
      );
    });
  },
});
