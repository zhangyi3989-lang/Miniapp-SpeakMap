const storage = require("./storage");
const id = require("../utils/id");
const mothers = require("../data/motherSentences");
const config = require("../config/trainingConfig");
const validate = require("../utils/validation");
const review = require("./reviewService");
const bank = require("./bankService");
const levels = ["L1", "L2", "L3", "L4", "L5", "L6"];
const titles = {
  L1: "自主造句",
  L2: "中译英调取",
  L3: "关键结构变化",
  L4: "逻辑链训练",
  L5: "母句联动",
  L6: "真实话题",
};
const locks = new Set();
const submittedAt = new Map();
function get(sid) {
  return storage.load().sessions.find((s) => s.sessionId === sid);
}
function create(type, motherId, extra = {}) {
  return storage.transact((d) => {
    const active = d.sessions.find((s) => !s.completed);
    if (active) return active;
    if (type === "training" && !mothers.some((m) => m.id === motherId))
      throw new Error("母句不存在。");
    const now = new Date().toISOString();
    const s = Object.assign(
      {
        sessionId: id("session"),
        sessionType: type,
        motherSentenceId: motherId || "",
        phase:
          type === "training" && config.training.phase0Enabled
            ? "phase0"
            : "training",
        level: "L1",
        itemIndex: 0,
        logicNodeIndex: 0,
        linkRound: 0,
        topicIndex: 0,
        batchTasks: type === "training" ? makeBatchTasks(motherId) : {},
        answers: [],
        feedback: null,
        candidates: [],
        draft: "",
        createdAt: now,
        updatedAt: now,
        completed: false,
        revealed: false,
      },
      extra,
    );
    d.sessions.push(s);
    if (type === "training")
      d.motherSentenceProgress[motherId] = {
        status: "learning",
        phase0Done: !config.training.phase0Enabled,
      };
    return s;
  });
}
function makeBatchTasks(motherId) {
  const m = mothers.find((m) => m.id === motherId),
    result = {};
  for (const level of ["L1", "L2"])
    if (config.training[level].batchEnabled)
      result[level] = {
        startIndex: 0,
        count: Math.min(
          config.training[level].itemCount,
          m[level.toLowerCase()].length,
        ),
      };
  return result;
}
function prepareBatch(sid) {
  const s = get(sid);
  if (
    !s ||
    s.sessionType !== "training" ||
    s.completed ||
    s.feedback ||
    !["L1", "L2"].includes(s.level) ||
    !config.training[s.level].batchEnabled ||
    (s.batchTasks && s.batchTasks[s.level])
  )
    return s;
  return update(sid, (now) => {
    if (now.feedback) return;
    const limit = makeBatchTasks(now.motherSentenceId)[now.level].count;
    now.batchTasks = now.batchTasks || {};
    now.batchTasks[now.level] = {
      startIndex: now.itemIndex,
      count: limit - now.itemIndex,
    };
  });
}
function answerCount(s) {
  return s.answers.reduce(
    (n, a) => n + (Array.isArray(a.sentences) ? a.sentences.length : 1),
    0,
  );
}
function count(s) {
  const m = mothers.find((m) => m.id === s.motherSentenceId);
  if (s.batchTasks && s.batchTasks[s.level]) return 1;
  if (s.level === "L6")
    return Math.min(config.training.L6.topics, m.topics.length) + 1;
  const fields = { L1: "l1", L2: "l2", L3: "l3", L4: "chain", L5: "links" };
  const limit =
    s.level === "L4"
      ? config.training.L4.defaultNodes
      : s.level === "L5"
        ? config.training.L5.rounds
        : config.training[s.level].itemCount;
  return Math.min(limit, m[fields[s.level]].length);
}
function task(s) {
  if (s.sessionType === "review") {
    const r = storage.load().reviews.find((r) => r.id === s.reviewId);
    if (!r) throw new Error("复习已不存在。");
    return review.content(r);
  }
  if (s.sessionType === "quick") {
    const m = mothers.find((m) => m.id === s.motherSentenceId);
    return {
      prompt: m.review[0],
      reference: m.examples[0],
      title: "快速调取检查",
    };
  }
  if (s.sessionType === "free")
    return {
      prompt: s.topic.zh,
      en: s.topic.en,
      reference: s.topic.reference,
      title: "自由表达",
    };
  const m = mothers.find((m) => m.id === s.motherSentenceId),
    i = s.itemIndex;
  const base = {
    title: titles[s.level],
    total: count(s),
    map: [],
    helpers: [],
    reference: m.examples[0],
  };
  const batch = s.batchTasks && s.batchTasks[s.level];
  if (batch && ["L1", "L2"].includes(s.level)) {
    const prompts =
      s.level === "L2"
        ? m.l2
            .slice(batch.startIndex, batch.startIndex + batch.count)
            .map((x, j) => ({ number: batch.startIndex + j + 1, text: x[0] }))
        : [];
    return Object.assign(base, {
      batch: true,
      batchCount: batch.count,
      prompts,
      prompt:
        s.level === "L1"
          ? `根据自己的生活，用当前母句连续造 ${batch.count} 个句子。每行一句，写完后一起提交。`
          : `按顺序翻译下面 ${batch.count} 个中文句子，每行写一句英文，一次性提交。`,
      hint: batch.startIndex
        ? `之前的 ${batch.startIndex} 个回答已保留，只补剩余内容。`
        : "",
      reference:
        s.level === "L2"
          ? m.l2
              .slice(batch.startIndex, batch.startIndex + batch.count)
              .map((x, j) => `${batch.startIndex + j + 1}. ${x[1]}`)
              .join("\n")
          : m.examples.join("\n"),
      placeholder: `每行一句，共 ${batch.count} 行。可以在同一个输入框里连续写完。`,
    });
  }
  if (s.level === "L1") return Object.assign(base, { prompt: m.l1[i] });
  if (s.level === "L2" || s.level === "L3") {
    const a = m[s.level === "L2" ? "l2" : "l3"][i];
    return Object.assign(base, { prompt: a[0], reference: a[1] });
  }
  if (s.level === "L4") {
    const a = m.chain[i],
      f = require("../data/functionalExpressions").find((f) => f.id === a[2]);
    return Object.assign(base, {
      prompt: a[1],
      reference: a[3],
      map: m.chain
        .slice(0, count(s))
        .map((n, j) => ({ label: n[0], active: j === i, done: j < i })),
      helpers: f.expressions,
      action: f.action,
    });
  }
  if (s.level === "L5")
    return Object.assign(base, {
      prompt: m.links[i][0],
      reference: m.links[i][1],
    });
  const t = m.topics[i < 2 ? 0 : 1];
  return Object.assign(base, {
    prompt: t[0],
    instruction:
      i === 0
        ? "先围绕这个话题说约 30 秒：表达观点，并说明一个原因。"
        : i === 1
          ? "在刚才约 30 秒的回答基础上，补充例子与影响，把整段扩展到约 60 秒。请提交完整的一段。"
          : "",
    progressLabel:
      i === 0
        ? "话题 1 · 30 秒"
        : i === 1
          ? "话题 1 · 扩展到 60 秒"
          : "话题 2 · 自由输出",
    map:
      i < 2
        ? t[2]
            .split("→")
            .slice(0, i === 0 ? 2 : undefined)
            .map((label) => ({
              label: label.trim(),
              active: false,
              done: false,
            }))
        : [],
    previousText:
      i === 1
        ? (s.answers.find((a) => a.level === "L6" && a.itemIndex === 0) || {})
            .text || ""
        : "",
    en: t[1],
    hint: "",
    reference: t[3],
    topic: i < 2 ? "Topic 1" : "Topic 2",
  });
}
function update(sid, fn) {
  return storage.transact((d) => {
    const s = d.sessions.find((s) => s.sessionId === sid);
    if (!s) throw new Error("训练记录不存在。");
    fn(s, d);
    s.updatedAt = new Date().toISOString();
    return s;
  });
}
function saveDraft(sid, text) {
  update(sid, (s) => {
    s.draft = text;
    s.stepDrafts = s.stepDrafts || {};
    s.stepDrafts[answerKey(s)] = text;
  });
}
function begin(sid) {
  update(sid, (s, d) => {
    if (s.phase !== "phase0") return;
    s.phase = "training";
    restoreStep(s);
    d.motherSentenceProgress[s.motherSentenceId].phase0Done = true;
  });
}
const answerKey = (s) =>
  [s.level, s.itemIndex, s.logicNodeIndex, s.linkRound, s.topicIndex].join(":");
async function submit(sid, text, analyzer) {
  if (locks.has(sid)) return get(sid);
  const last = submittedAt.get(sid);
  if (last && Date.now() - last < config.submissionGuardMs && get(sid).feedback)
    return get(sid);
  const cleaned = validate.input(text);
  locks.add(sid);
  try {
    const s = get(sid);
    if (!s || s.completed || s.phase === "phase0")
      throw new Error("当前不能提交。");
    const key = answerKey(s);
    if (s.answers.some((a) => a.key === key)) return s;
    const current = task(s);
    const sentences = current.batch
      ? cleaned
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      : null;
    if (sentences && sentences.length !== current.batchCount)
      throw new Error(
        `请每行写一句，共填写 ${current.batchCount} 行。现在有 ${sentences.length} 行。`,
      );
    const feedback = await analyzer({
      text: cleaned,
      reference: current.reference,
      meaningZh:
        (
          mothers.find((m) => m.id === s.motherSentenceId) || {
            referenceMeanings: {},
          }
        ).referenceMeanings[current.reference] ||
        (s.topic && s.topic.meaningZh) ||
        current.prompt,
      motherSentenceId: s.motherSentenceId,
      sessionId: sid,
      trainingState: {
        phase: s.phase,
        level: s.level,
        itemIndex: s.itemIndex,
        logicNodeIndex: s.logicNodeIndex,
        linkRound: s.linkRound,
        topicIndex: s.topicIndex,
        completed: false,
      },
    });
    const result = update(sid, (now) => {
      if (
        now.completed ||
        answerKey(now) !== key ||
        now.answers.some((a) => a.key === key)
      )
        return;
      now.answers.push({
        id: id("answer"),
        key,
        text: cleaned,
        ...(sentences ? { sentences } : {}),
        at: new Date().toISOString(),
        level: now.level,
        itemIndex: now.itemIndex,
        provenance: "user",
        userProduced: false,
        feedback,
      });
      now.feedback = feedback;
      now.draft = cleaned;
      now.candidates = bank.dedupe(
        now.candidates.concat(feedback.bankCandidates || []),
      );
    });
    submittedAt.set(sid, Date.now());
    return result;
  } finally {
    locks.delete(sid);
  }
}
function advance(sid) {
  return update(sid, (s, d) => {
    if (!s.feedback || s.completed) return;
    s.feedback = null;
    s.draft = "";
    if (s.sessionType !== "training") {
      s.completed = true;
      s.phase = "completed";
      if (s.sessionType === "quick")
        d.motherSentenceProgress[s.motherSentenceId].quickRecallDone = true;
      return;
    }
    if (s.itemIndex + 1 < count(s)) s.itemIndex++;
    else {
      const n = levels.indexOf(s.level) + 1;
      if (n < levels.length) {
        s.level = levels[n];
        s.itemIndex = 0;
      } else {
        s.completed = true;
        s.phase = "completed";
        const p = d.motherSentenceProgress[s.motherSentenceId];
        p.status = "reviewing";
        p.firstTrainingCompletedAt = new Date().toISOString();
        review.scheduleMother(d, s.motherSentenceId);
      }
    }
    s.logicNodeIndex = s.level === "L4" ? s.itemIndex : 0;
    s.linkRound = s.level === "L5" ? s.itemIndex : 0;
    s.topicIndex = s.level === "L6" ? (s.itemIndex < 2 ? 0 : 1) : 0;
    const currentRank = levels.indexOf(s.level),
      highestRank = levels.indexOf(s.highestLevel || s.level);
    s.highestLevel = levels[Math.max(currentRank, highestRank)];
    if (!s.completed) restoreStep(s);
  });
}
function syncCursor(s) {
  s.logicNodeIndex = s.level === "L4" ? s.itemIndex : 0;
  s.linkRound = s.level === "L5" ? s.itemIndex : 0;
  s.topicIndex = s.level === "L6" ? (s.itemIndex < 2 ? 0 : 1) : 0;
}
function restoreStep(s) {
  const answer = s.answers.find((a) => a.key === answerKey(s));
  s.feedback = answer ? answer.feedback : null;
  s.draft = answer ? answer.text : (s.stepDrafts || {})[answerKey(s)] || "";
}
function canGoBack(s) {
  return (
    !!s &&
    !s.completed &&
    s.sessionType === "training" &&
    s.phase !== "phase0" &&
    (s.level !== "L1" ||
      (!(s.batchTasks && s.batchTasks.L1) && s.itemIndex > 0) ||
      config.training.phase0Enabled)
  );
}
function back(sid) {
  if (locks.has(sid)) throw new Error("正在保存，请稍候。");
  return update(sid, (s) => {
    if (!canGoBack(s)) return;
    if (!s.highestLevel) s.highestLevel = s.level;
    s.stepDrafts = s.stepDrafts || {};
    s.stepDrafts[answerKey(s)] = s.draft || "";
    if (
      s.level === "L1" &&
      ((s.batchTasks && s.batchTasks.L1) || s.itemIndex === 0)
    ) {
      s.phase = "phase0";
      s.feedback = null;
      return;
    }
    if (s.itemIndex > 0 && !(s.batchTasks && s.batchTasks[s.level]))
      s.itemIndex--;
    else {
      s.level = levels[levels.indexOf(s.level) - 1];
      const plan = s.batchTasks && s.batchTasks[s.level];
      s.itemIndex = plan ? plan.startIndex : count(s) - 1;
    }
    syncCursor(s);
    restoreStep(s);
  });
}
function reveal(sid, text) {
  const clean = validate.input(text);
  return update(sid, (s) => {
    if (s.completed || s.revealed) return;
    s.answers.push({
      id: id("answer"),
      key: "recall",
      text: clean,
      at: new Date().toISOString(),
      provenance: "user",
      userProduced: false,
    });
    s.draft = clean;
    s.revealed = true;
  });
}
module.exports = {
  get,
  create,
  count,
  task,
  titles,
  saveDraft,
  begin,
  submit,
  advance,
  reveal,
  update,
  answerKey,
  prepareBatch,
  answerCount,
  back,
  canGoBack,
};
