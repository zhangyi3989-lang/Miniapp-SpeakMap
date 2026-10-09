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
function count(s) {
  const m = mothers.find((m) => m.id === s.motherSentenceId);
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
    prompt: i === 1 ? "沿刚才的思路继续增加具体信息，不要重复上一段。" : t[0],
    en: t[1],
    hint: i < 2 ? t[2] : "",
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
  });
}
function begin(sid) {
  update(sid, (s, d) => {
    if (s.phase !== "phase0") return;
    s.phase = "training";
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
};
