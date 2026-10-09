const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
let persisted = {},
  writeFail = false,
  readFail = false;
global.wx = {
  getStorageSync: (key) => {
    if (readFail) throw new Error("read");
    return persisted[key];
  },
  setStorageSync: (key, value) => {
    if (writeFail) throw new Error("disk full");
    persisted[key] = JSON.parse(JSON.stringify(value));
  },
  showToast: () => {},
};
const storage = require("../services/storage"),
  training = require("../services/trainingService"),
  scheduler = require("../services/learningScheduler"),
  review = require("../services/reviewService"),
  bank = require("../services/bankService"),
  stats = require("../services/statsService"),
  ai = require("../services/ai"),
  mothers = require("../data/motherSentences"),
  config = require("../config/trainingConfig");
beforeEach(() => {
  persisted = {};
  writeFail = false;
  readFail = false;
  storage.resetCache();
});
async function complete(mid) {
  let s = training.create("training", mid);
  training.begin(s.sessionId);
  while (!(s = training.get(s.sessionId)).completed) {
    await training.submit(
      s.sessionId,
      "My own real answer.",
      ai.analyzeTrainingResponse,
    );
    training.advance(s.sessionId);
  }
  return training.get(s.sessionId);
}
test("三个母句完整 Phase 0、L1–L6、手动候选入库、重启与统计", async () => {
  for (const m of mothers) {
    const s = await complete(m.id);
    assert.equal(s.answers.length, 27);
    assert.equal(s.candidates.length, bank.dedupe(s.candidates).length);
    assert.equal(storage.load().banks.expression.length, 0);
    assert.equal(
      storage.load().reviews.filter((r) => r.kind === "mother").length,
      mothers.indexOf(m) + 1,
    );
    assert.ok(
      s.answers.every(
        (a) =>
          a.text === "My own real answer." &&
          a.provenance === "user" &&
          a.userProduced === false,
      ),
    );
    assert.ok(
      s.candidates.every(
        (c) => c.provenance === "demo_reference" && !c.userProduced,
      ),
    );
  }
  const s = storage.load().sessions[0];
  const selected = s.candidates.slice(0, 2);
  assert.equal(bank.add(selected, s.sessionId, "A01").added, 2);
  assert.equal(bank.add(selected, s.sessionId, "A01").duplicates, 2);
  storage.resetCache();
  assert.equal(storage.load().banks.expression.length, 2);
  assert.equal(stats.get().answers, 81);
  assert.equal(stats.get().completed, 3);
  assert.equal(stats.get().stages, 18);
  assert.equal(stats.get().days, 1);
});
test("精确恢复 L2 第 3 题、L4 具体化节点及尚未推进的反馈", async () => {
  let s = training.create("training", "A01");
  training.begin(s.sessionId);
  while (true) {
    s = training.get(s.sessionId);
    if (s.level === "L2" && s.itemIndex === 2) break;
    await training.submit(s.sessionId, "An answer", ai.analyzeTrainingResponse);
    training.advance(s.sessionId);
  }
  training.saveDraft(s.sessionId, "unfinished draft");
  storage.resetCache();
  const resumed = scheduler.next(Date.now() + 86400000 * 10).session;
  assert.equal(resumed.itemIndex, 2);
  assert.equal(resumed.draft, "unfinished draft");
  while (true) {
    s = training.get(s.sessionId);
    if (s.level === "L4" && s.itemIndex === 2) break;
    await training.submit(s.sessionId, "My input", ai.analyzeTrainingResponse);
    training.advance(s.sessionId);
  }
  assert.equal(s.logicNodeIndex, 2);
  assert.equal(training.task(s).map[2].active, true);
  await training.submit(
    s.sessionId,
    "saved answer",
    ai.analyzeTrainingResponse,
  );
  storage.resetCache();
  s = scheduler.next().session;
  assert.equal(s.logicNodeIndex, 2);
  assert.ok(s.feedback);
  assert.equal(s.answers.at(-1).text, "saved answer");
});
test("并发和连续重复提交只保存一条，AI 失败后可重试且输入保留", async () => {
  const s = training.create("training", "E02");
  training.begin(s.sessionId);
  training.saveDraft(s.sessionId, "kept draft");
  let resolve;
  const pending = training.submit(
    s.sessionId,
    "Answer",
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await training.submit(s.sessionId, "Answer", ai.analyzeTrainingResponse);
  resolve(await ai.analyzeTrainingResponse({ reference: "Reference" }));
  await pending;
  await training.submit(s.sessionId, "Answer", ai.analyzeTrainingResponse);
  assert.equal(training.get(s.sessionId).answers.length, 1);
  training.advance(s.sessionId);
  training.saveDraft(s.sessionId, "kept on failure");
  await assert.rejects(
    training.submit(s.sessionId, "kept on failure", () =>
      Promise.reject(new Error("network")),
    ),
  );
  assert.equal(training.get(s.sessionId).draft, "kept on failure");
  assert.equal(training.get(s.sessionId).answers.length, 1);
  await training.submit(
    s.sessionId,
    "kept on failure",
    ai.analyzeTrainingResponse,
  );
  assert.equal(training.get(s.sessionId).answers.length, 2);
});
test("空输入、空格与超长输入拒绝且不保存回答", async () => {
  const s = training.create("training", "E03");
  training.begin(s.sessionId);
  for (const text of ["", "   ", "x".repeat(config.inputMaxLength + 1)])
    await assert.rejects(
      training.submit(s.sessionId, text, ai.analyzeTrainingResponse),
    );
  assert.equal(training.get(s.sessionId).answers.length, 0);
});
test("保存异常保持存储与 Session 原状，重试后成功", async () => {
  const s = training.create("training", "A01");
  training.begin(s.sessionId);
  training.saveDraft(s.sessionId, "keep me");
  writeFail = true;
  await assert.rejects(
    training.submit(s.sessionId, "keep me", ai.analyzeTrainingResponse),
    /保存失败/,
  );
  assert.equal(training.get(s.sessionId).answers.length, 0);
  assert.equal(training.get(s.sessionId).draft, "keep me");
  writeFail = false;
  await training.submit(s.sessionId, "keep me", ai.analyzeTrainingResponse);
  assert.equal(training.get(s.sessionId).answers.length, 1);
});
test("调度优先断点 > 最早到期 > Quick Recall > 新母句，完成后不伪造内容", async () => {
  let s = await complete("A01");
  assert.equal(scheduler.next().session.sessionType, "quick");
  s = storage.load().sessions.at(-1);
  await training.submit(s.sessionId, "My recall", ai.analyzeTrainingResponse);
  training.advance(s.sessionId);
  assert.equal(scheduler.next().session.motherSentenceId, "E02");
  s = storage.load().sessions.at(-1);
  training.begin(s.sessionId);
  while (!(s = training.get(s.sessionId)).completed) {
    await training.submit(s.sessionId, "An answer", ai.analyzeTrainingResponse);
    training.advance(s.sessionId);
  }
  storage.transact((d) => {
    d.reviews[0].nextReviewAt = "2020-01-01T00:00:00.000Z";
    d.reviews[1].nextReviewAt = "2021-01-01T00:00:00.000Z";
  });
  const r = scheduler.next().session;
  assert.equal(r.sessionType, "review");
  assert.equal(r.reviewId, storage.load().reviews[0].id);
  assert.equal(scheduler.next().session.sessionId, r.sessionId);
});
test("R1–R5 先回忆再查看，自评失败保留阶段次日复习，成功按集中间隔推进", async () => {
  await complete("A01");
  let r = storage.load().reviews[0];
  assert.ok(
    Math.abs(Date.parse(r.nextReviewAt) - Date.now() - 86400000) < 2000,
  );
  let s = training.create("review", "A01", { reviewId: r.id });
  assert.throws(() => review.rate(s.sessionId, true, ""), /先回忆/);
  assert.equal(training.get(s.sessionId).revealed, false);
  training.reveal(s.sessionId, "Recall");
  training.reveal(s.sessionId, "Duplicate");
  assert.equal(training.get(s.sessionId).answers.length, 1);
  review.rate(s.sessionId, false, "My new situation");
  review.rate(s.sessionId, false, "duplicate");
  r = storage.load().reviews[0];
  assert.equal(r.stage, 0);
  assert.equal(r.history.length, 1);
  assert.equal(r.history[0].sceneAnswer, "My new situation");
  assert.ok(
    Math.abs(Date.parse(r.nextReviewAt) - Date.now() - 86400000) < 2000,
  );
  for (let stage = 0; stage < 5; stage++) {
    s = training.create("review", "A01", { reviewId: r.id });
    assert.equal(
      review.content(storage.load().reviews[0]).name,
      review.names[stage],
    );
    training.reveal(s.sessionId, "Independent response");
    review.rate(s.sessionId, true, "Another scene");
    r = storage.load().reviews[0];
    if (stage < 4) {
      assert.equal(r.stage, stage + 1);
      assert.ok(
        Math.abs(
          Date.parse(r.nextReviewAt) -
            Date.now() -
            config.review.intervalsDays[stage + 1] * 86400000,
        ) < 2000,
      );
    } else assert.equal(r.completed, true);
  }
  assert.equal(r.nextReviewAt, null);
  assert.equal(
    storage.load().motherSentenceProgress.A01.status,
    "completed_review_cycle",
  );
});
test("学习库去重、编辑、删除、检索与条目复习保持同步", async () => {
  const s = await complete("E02");
  bank.add([s.candidates[0]], s.sessionId, "E02");
  const b = storage.load().banks.expression[0];
  const normalized = Object.assign({}, s.candidates[0], {
    data: {
      expression: "  " + b.expression.toUpperCase().replace(/ /g, "   ") + "  ",
      meaningZh: "meaning",
    },
  });
  assert.equal(bank.add([normalized], s.sessionId, "E02").duplicates, 1);
  bank.edit(b.id, { expression: "A new expression", meaningZh: "新意思" });
  assert.equal(bank.get(b.id).expression, "A new expression");
  const r = storage.load().reviews.find((r) => r.sourceId === b.id);
  const rs = training.create("review", "", { reviewId: r.id });
  training.reveal(rs.sessionId, "My recall");
  review.rate(rs.sessionId, true, "My scene");
  assert.equal(bank.get(b.id).reviewStage, 1);
  assert.equal(bank.get(b.id).sceneAnswers[0].text, "My scene");
  bank.remove(b.id);
  assert.equal(bank.get(b.id), null);
  assert.equal(
    storage.load().reviews.some((r) => r.sourceId === b.id),
    false,
  );
});
test("备份完整往返、恢复校验、缺失字段默认填充、未来版本保护和损坏保护", async () => {
  await complete("A01");
  const backup = storage.exportBackup();
  assert.equal(JSON.parse(backup).formatVersion, 1);
  storage.clear();
  assert.equal(storage.load().sessions.length, 0);
  storage.restore(backup);
  assert.equal(storage.load().sessions[0].answers.length, 27);
  for (const bad of [
    "{",
    "{}",
    JSON.stringify({ formatVersion: 2, data: {} }),
    JSON.stringify({
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      data: { dataVersion: 1 },
    }),
  ])
    assert.throws(() => storage.parseBackup(bad));
  const broken = JSON.parse(backup);
  broken.data.sessions[0].itemIndex = 999;
  assert.throws(() => storage.parseBackup(JSON.stringify(broken)), /超出范围/);
  assert.deepEqual(storage.validate({ banks: { expression: [] } }).banks, {
    expression: [],
    mistake: [],
    natural_upgrade: [],
  });
  persisted[storage.KEY] = { dataVersion: 99 };
  storage.resetCache();
  storage.load();
  assert.throws(
    () =>
      storage.transact((d) => {
        d.profile.name = "x";
      }),
    /保护/,
  );
  assert.equal(persisted[storage.KEY].dataVersion, 99);
  storage.restore(backup);
  assert.equal(storage.load().dataVersion, 1);
  persisted[storage.KEY] = "{";
  storage.resetCache();
  storage.load();
  assert.throws(() => storage.exportBackup(), /读取失败/);
  assert.equal(persisted[storage.KEY], "{");
});
test("自由表达和 Quick Recall 使用独立 AI 层，示例不判定任务正确与语言错误", async () => {
  const topic = require("../data/freeTopics")[0];
  const s = training.create("free", "", { topic });
  await training.submit(
    s.sessionId,
    "This is my real input",
    ai.analyzeFreeExpression,
  );
  const result = training.get(s.sessionId);
  assert.equal(result.feedback.overallFeedback.isOnTask, null);
  assert.equal(result.feedback.languageIssues.length, 0);
  assert.equal(result.feedback.naturalUpgrades.length, 0);
  assert.match(result.feedback.overallFeedback.summary, /并非 AI/);
  assert.notEqual(result.feedback.revisedAnswer, result.answers[0].text);
  training.advance(s.sessionId);
  assert.equal(training.get(s.sessionId).completed, true);
});
test("全部母句与快速检查结束且无到期，返回空调度而非伪造母句", async () => {
  for (const m of mothers) await complete(m.id);
  storage.transact((d) => {
    Object.values(d.motherSentenceProgress).forEach((p) => {
      p.quickRecallDone = true;
    });
  });
  assert.equal(scheduler.next().kind, "empty");
});

test("错误库与自然升级库保持独立，支持去重、修改、复习和删除", () => {
  const candidates = [
    {
      id: "sample_mistake",
      bankType: "mistake",
      provenance: "demo_reference",
      data: {
        meaningZh: "噪音让我无法集中注意力",
        myExpression: "Noise prevents me to focus.",
        recommendedExpression: "Noise prevents me from focusing.",
        why: "prevent sb from 后面使用动名词。",
        errorType: "grammar",
        chunk: "prevent sb from doing",
      },
    },
    {
      id: "sample_upgrade",
      bankType: "natural_upgrade",
      provenance: "demo_reference",
      data: {
        myExpression: "I need to rest and get my energy back.",
        naturalExpression: "I need to recharge.",
        meaningOrDifference: "恢复精力；更常见的简洁说法",
        why: "recharge 常用来表示休息后恢复精力。",
      },
    },
  ];
  assert.equal(bank.add(candidates, "test_session", "E03").added, 2);
  assert.equal(bank.add(candidates, "test_session", "E03").duplicates, 2);
  for (const type of ["mistake", "natural_upgrade"]) {
    const b = storage.load().banks[type][0];
    assert.equal(b.provenance, "demo_reference");
    assert.equal(b.userProduced, false);
    const field =
      type === "mistake" ? "recommendedExpression" : "naturalExpression";
    bank.edit(b.id, { [field]: "An edited " + type + " expression" });
    assert.equal(
      bank.expression(bank.get(b.id)),
      "An edited " + type + " expression",
    );
    const r = storage.load().reviews.find((r) => r.sourceId === b.id);
    const s = training.create("review", "", { reviewId: r.id });
    assert.ok(review.content(r).prompt);
    training.reveal(s.sessionId, "My recall");
    review.rate(s.sessionId, false, "My new scenario");
    assert.equal(bank.get(b.id).reviewStage, 0);
    assert.equal(bank.get(b.id).reviewHistory.length, 1);
    bank.remove(b.id);
    assert.equal(bank.get(b.id), null);
  }
});

test("真实 AI 接口未配置、请求失败或返回异常时拒绝，输入不丢失", async () => {
  const appConfig = require("../config/appConfig"),
    real = require("../services/ai/realService");
  const previous = appConfig.cloudEnv;
  appConfig.cloudEnv = "";
  try {
    await assert.rejects(
      real.analyzeTrainingResponse({ text: "kept input" }),
      /尚未配置/,
    );
    appConfig.cloudEnv = "test_env";
    wx.cloud = { callFunction: (o) => o.fail(new Error("network failure")) };
    const s = training.create("training", "A01");
    training.begin(s.sessionId);
    training.saveDraft(s.sessionId, "kept input");
    await assert.rejects(
      training.submit(s.sessionId, "kept input", real.analyzeTrainingResponse),
      /network/,
    );
    assert.equal(training.get(s.sessionId).draft, "kept input");
    assert.equal(training.get(s.sessionId).answers.length, 0);
    wx.cloud = { callFunction: (o) => o.success({ result: { mode: "real" } }) };
    await assert.rejects(
      real.analyzeTrainingResponse({ text: "kept input" }),
      /格式错误/,
    );
  } finally {
    appConfig.cloudEnv = previous;
    delete wx.cloud;
  }
});
