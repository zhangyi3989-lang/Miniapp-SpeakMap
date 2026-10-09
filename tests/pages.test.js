const answerInput = require("./answer-helper");
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
let persisted = {},
  routes = [],
  modals = [],
  clipboard = "",
  savedFailure = false;
global.wx = {
  getStorageSync: (k) => persisted[k],
  setStorageSync: (k, v) => {
    if (savedFailure) throw new Error("disk");
    persisted[k] = JSON.parse(JSON.stringify(v));
  },
  showToast: () => {},
  navigateTo: (o) => navigate("navigateTo", o.url),
  redirectTo: (o) => navigate("redirectTo", o.url),
  switchTab: (o) => navigate("switchTab", o.url),
  navigateBack: () => routes.push("back"),
  showModal: (o) => {
    modals.push(o);
  },
  setClipboardData: (o) => {
    clipboard = o.data;
    o.success && o.success();
  },
};
const storage = require("../services/storage"),
  training = require("../services/trainingService"),
  ai = require("../services/ai/index"),
  bank = require("../services/bankService");
function navigate(method, url) {
  const tabs = require("../app.json").tabBar.list.map((t) => "/" + t.pagePath);
  const isTab = tabs.includes(url.split("?")[0]);
  assert.equal(method === "switchTab", isTab, "微信 tabBar 导航 API 使用错误");
  if (isTab) assert.ok(!url.includes("?"), "switchTab 不能携带参数");
  routes.push(url);
}
function mount(name, query = {}) {
  let definition;
  global.Page = (def) => {
    definition = def;
  };
  const file = path.resolve(__dirname, `../pages/${name}/${name}.js`);
  delete require.cache[file];
  require(file);
  const instance = Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data || {})),
    setData(fields) {
      Object.assign(this.data, fields);
    },
  });
  if (instance.onLoad) instance.onLoad(query);
  if (instance.onShow) instance.onShow();
  return instance;
}
beforeEach(() => {
  persisted = {};
  routes = [];
  modals = [];
  clipboard = "";
  savedFailure = false;
  storage.resetCache();
});
test("全部页面可在模拟微信运行时加载，初始空状态无崩溃", () => {
  for (const route of require("../app.json").pages) {
    const name = route.split("/")[1];
    assert.doesNotThrow(() => mount(name));
  }
  assert.equal(mount("home").data.plan.steps[0].title, "新母句 A01");
  assert.equal(mount("bank").data.items.length, 0);
  assert.equal(mount("profile").data.records.length, 0);
});
test("首页开始 → Phase 0 → 回答 → 示例反馈 → 下一题 → 重载精确恢复", async () => {
  const home = mount("home");
  home.start();
  const s = storage.load().sessions[0];
  assert.ok(routes.at(-1).includes(s.sessionId));
  const page = mount("training", { sid: s.sessionId });
  assert.equal(page.data.session.phase, "phase0");
  page.begin();
  page.input({
    detail: {
      value: answerInput(s.sessionId, "I have been learning to cook."),
    },
  });
  await page.submit();
  assert.equal(page.data.session.answers.length, 1);
  assert.equal(page.data.feedback.mode, "demo");
  page.next();
  assert.equal(page.data.session.level, "L2");
  assert.equal(page.data.session.itemIndex, 0);
  page.input({ detail: { value: "Unfinished answer" } });
  storage.resetCache();
  const resumed = mount("training", { sid: s.sessionId });
  assert.equal(resumed.data.input, "Unfinished answer");
  assert.equal(resumed.data.session.level, "L2");
  assert.equal(resumed.data.session.itemIndex, 0);
});
test("页面错误保留输入，连续点击提交只创建一条", async () => {
  const s = training.create("training", "A01");
  training.begin(s.sessionId);
  const page = mount("training", { sid: s.sessionId });
  page.input({ detail: { value: answerInput(s.sessionId, "My answer") } });
  await Promise.all([page.submit(), page.submit()]);
  assert.equal(training.get(s.sessionId).answers.length, 1);
  page.next();
  page.input({
    detail: { value: answerInput(s.sessionId, "keep this input") },
  });
  savedFailure = true;
  await page.submit();
  assert.equal(page.data.input, answerInput(s.sessionId, "keep this input"));
  assert.match(page.data.error, /保存失败/);
  savedFailure = false;
  await page.submit();
  assert.equal(training.get(s.sessionId).answers.length, 2);
});
test("自由表达进入反馈页，完成后仅展示候选，勾选才入库", async () => {
  const free = mount("free-expression");
  free.choose({ currentTarget: { dataset: { id: "time" } } });
  const s = storage.load().sessions[0];
  const page = mount("training", { sid: s.sessionId });
  page.input({ detail: { value: "My own answer" } });
  await page.submit();
  assert.ok(routes.at(-1).includes("/feedback/"));
  const feedback = mount("feedback", { sid: s.sessionId });
  assert.equal(feedback.data.original, "My own answer");
  feedback.finish();
  const candidates = mount("candidate-select", { sid: s.sessionId });
  assert.equal(storage.load().banks.expression.length, 0);
  candidates.select({ detail: { value: [candidates.data.items[0].id] } });
  candidates.add();
  assert.equal(storage.load().banks.expression.length, 1);
  assert.equal(candidates.data.items[0].checked, false);
});
test("学习库搜索筛选、编辑后同步、删除需要确认", async () => {
  const s = training.create("free", "", {
    topic: require("../data/freeTopics")[0],
  });
  await training.submit(s.sessionId, "Answer", ai.analyzeFreeExpression);
  training.advance(s.sessionId);
  bank.add(training.get(s.sessionId).candidates, s.sessionId, "A01");
  const page = mount("bank");
  assert.equal(page.data.items.length, 1);
  page.search({ detail: { value: "no match here" } });
  assert.equal(page.data.items.length, 0);
  page.search({ detail: { value: "" } });
  page.filter({ detail: { value: "2" } });
  assert.equal(page.data.items.length, 0);
  const b = storage.load().banks.expression[0];
  const detail = mount("bank-detail", { id: b.id });
  detail.edit();
  detail.change({
    currentTarget: { dataset: { field: "text" } },
    detail: { value: "Edited expression" },
  });
  detail.save();
  assert.equal(bank.get(b.id).expression, "Edited expression");
  detail.remove();
  assert.equal(bank.get(b.id).expression, "Edited expression");
  modals.at(-1).success({ confirm: true });
  assert.equal(bank.get(b.id), null);
});
test("复习页参考隐藏、退出恢复，保存换场景、自评后同步", async () => {
  const s = training.create("free", "", {
    topic: require("../data/freeTopics")[0],
  });
  await training.submit(s.sessionId, "My answer", ai.analyzeFreeExpression);
  training.advance(s.sessionId);
  bank.add(training.get(s.sessionId).candidates, s.sessionId, "");
  storage.transact((d) => {
    d.reviews[0].nextReviewAt = "2020-01-01T00:00:00.000Z";
  });
  const page = mount("review");
  assert.equal(page.data.categories.length, 3);
  assert.equal(page.data.items.length, 0);
  page.selectBank({
    currentTarget: { dataset: { type: storage.load().reviews[0].bankType } },
  });
  assert.equal(page.data.items.length > 0, true);
  page.open({ currentTarget: { dataset: { id: page.data.items[0].id } } });
  assert.equal(page.data.session.revealed, false);
  page.input({ detail: { value: "Recall before seeing reference" } });
  page.reveal();
  assert.equal(page.data.session.revealed, true);
  page.scene({ detail: { value: "New situation" } });
  storage.resetCache();
  const resumed = mount("review", { sid: page.data.session.sessionId });
  assert.equal(resumed.data.scene, "New situation");
  assert.equal(resumed.data.session.revealed, true);
  resumed.rate({ currentTarget: { dataset: { recalled: "yes" } } });
  assert.equal(resumed.data.session, null);
  assert.equal(
    storage.load().banks.expression[0].reviewHistory[0].sceneAnswer,
    "New situation",
  );
});
test("备份使用微信剪贴板，恢复先校验并确认，清空两次确认", () => {
  const page = mount("backup");
  training.create("training", "A01");
  page.copy();
  assert.equal(JSON.parse(clipboard).formatVersion, 1);
  page.input({ detail: { value: "{bad" } });
  page.restore();
  assert.ok(page.data.error);
  assert.equal(modals.length, 0);
  page.input({ detail: { value: clipboard } });
  page.restore();
  assert.equal(modals.length, 1);
  modals.at(-1).success({ confirm: false });
  assert.equal(storage.load().sessions.length, 1);
  page.clear();
  assert.equal(storage.load().sessions.length, 1);
  modals.at(-1).success({ confirm: true });
  assert.equal(storage.load().sessions.length, 1);
  modals.at(-1).success({ confirm: true });
  assert.equal(storage.load().sessions.length, 0);
  page.input({ detail: { value: clipboard } });
  page.restore();
  modals.at(-1).success({ confirm: true });
  assert.equal(storage.load().sessions.length, 1);
});

test("首页自动调度复习使用 switchTab，无参数仍能精确恢复断点", async () => {
  const s = training.create("free", "", {
    topic: require("../data/freeTopics")[0],
  });
  await training.submit(s.sessionId, "Answer", ai.analyzeFreeExpression);
  training.advance(s.sessionId);
  bank.add(training.get(s.sessionId).candidates, s.sessionId, "");
  storage.transact((d) => {
    d.reviews[0].nextReviewAt = "2020-01-01T00:00:00.000Z";
  });
  mount("home").start();
  assert.equal(routes.at(-1), "/pages/review/review");
  const page = mount("review");
  assert.equal(page.data.session.sessionType, "review");
  page.input({ detail: { value: "Unfinished recall" } });
  storage.resetCache();
  const resumed = mount("review");
  assert.equal(resumed.data.input, "Unfinished recall");
  assert.equal(resumed.data.session.revealed, false);
});

test("34个母句详细资料完整展示，阅读不改变训练进度", () => {
  const catalog = require("../data/motherCatalog");
  assert.equal(catalog.length, 34);
  for (const mother of catalog) {
    const page = mount("mother-lesson", { id: mother.id });
    assert.equal(page.data.mother.id, mother.id);
    assert.ok(page.data.blocks.length > 80);
    assert.ok(page.data.examples.every((e) => e.zh));
    assert.equal(storage.load().sessions.length, 0);
  }
});

test("训练页上一步保留 L2 草稿，Phase 0 可查看教学后返回原训练", async () => {
  const s = training.create("training", "E02"),
    page = mount("training", { sid: s.sessionId });
  page.explain();
  assert.ok(routes.at(-1).includes("from=training"));
  const lesson = mount("mother-detail", { id: "E02", from: "training" });
  lesson.start();
  assert.equal(routes.at(-1), "back");
  page.begin();
  page.input({
    detail: { value: answerInput(s.sessionId, "My own sentence") },
  });
  await page.submit();
  page.next();
  page.input({ detail: { value: "Half finished translation" } });
  page.previous();
  assert.equal(page.data.session.level, "L1");
  assert.ok(page.data.feedback);
  page.next();
  assert.equal(page.data.session.level, "L2");
  assert.equal(page.data.input, "Half finished translation");
});

test("核心介绍提供独立详细学习入口，保留母句编号", () => {
  const page = mount("mother-detail", { id: "E02" });
  page.details();
  assert.equal(routes.at(-1), "/pages/mother-lesson/mother-lesson?id=E02");
  const detail = mount("mother-lesson", { id: "E02" });
  assert.equal(detail.data.mother.id, "E02");
  assert.ok(detail.data.blocks.length > 80);
});

test("正式资料34个编号顺序正确，功能表达包含主动与辅助分类，C首页显示选定文案", () => {
  const catalog = require("../data/motherCatalog"),
    fs = require("node:fs");
  assert.equal(new Set(catalog.map((m) => m.id)).size, 34);
  assert.ok(catalog.every((m, i) => i === 0 || m.order > catalog[i - 1].order));
  assert.equal(catalog[0].id, "A01");
  assert.equal(catalog[1].id, "A02");
  const functions = mount("function-list");
  assert.equal(functions.data.items.length, 12);
  assert.ok(
    functions.data.items.every(
      (f) => f.primary.length > 0 && Array.isArray(f.supporting),
    ),
  );
  assert.match(
    fs.readFileSync(path.resolve(__dirname, "../pages/home/home.wxml"), "utf8"),
    /每一次学习都是靠近更好的你/,
  );
  const home = mount("home");
  assert.equal(home.data.current.title, home.data.plan.steps[0].title);
});
