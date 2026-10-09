const CURRENT_DATA_VERSION = 1;
const KEY = "speakmap_learning_v1";
let cache = null;
let blocked = false;
const copy = (value) => JSON.parse(JSON.stringify(value));
const object = (v) => v && typeof v === "object" && !Array.isArray(v);
function initial() {
  return {
    dataVersion: CURRENT_DATA_VERSION,
    profile: {},
    sessions: [],
    motherSentenceProgress: {},
    banks: { expression: [], mistake: [], natural_upgrade: [] },
    reviews: [],
    settings: {},
  };
}
function validate(data, strict = false) {
  if (!object(data)) throw new Error("学习数据格式错误。");
  if (strict && data.dataVersion !== CURRENT_DATA_VERSION)
    throw new Error("备份数据版本不受支持。");
  if (
    data.dataVersion !== undefined &&
    (!Number.isInteger(data.dataVersion) ||
      data.dataVersion > CURRENT_DATA_VERSION ||
      data.dataVersion < 1)
  )
    throw new Error("数据版本不受支持，请保留原数据并使用适配版本。");
  const base = initial();
  for (const key of ["sessions", "reviews"]) {
    if (strict && !Array.isArray(data[key])) throw new Error("备份缺少 " + key);
    if (data[key] !== undefined && !Array.isArray(data[key]))
      throw new Error(key + " 格式错误");
  }
  for (const key of [
    "profile",
    "motherSentenceProgress",
    "banks",
    "settings",
  ]) {
    if (strict && !object(data[key])) throw new Error("备份缺少 " + key);
    if (data[key] !== undefined && !object(data[key]))
      throw new Error(key + " 格式错误");
  }
  const result = Object.assign(base, data, {
    dataVersion: CURRENT_DATA_VERSION,
  });
  result.banks = Object.assign(initial().banks, data.banks || {});
  for (const type of ["expression", "mistake", "natural_upgrade"]) {
    if (!Array.isArray(result.banks[type])) throw new Error("学习库格式错误");
    result.banks[type].forEach((b) => {
      if (object(b)) {
        if (b.bankType === undefined) b.bankType = type;
        if (b.sceneAnswers === undefined) b.sceneAnswers = [];
      }

      if (
        !object(b) ||
        typeof b.id !== "string" ||
        typeof b.meaningZh !== "string" ||
        b.bankType !== type ||
        !Array.isArray(b.sceneAnswers) ||
        !Array.isArray(b.reviewHistory) ||
        !Number.isInteger(b.reviewStage) ||
        b.reviewStage < 0 ||
        b.reviewStage > 4
      )
        throw new Error("学习库条目格式错误");
      const field =
        type === "expression"
          ? "expression"
          : type === "mistake"
            ? "recommendedExpression"
            : "naturalExpression";
      if (typeof b[field] !== "string" || !b[field].trim())
        throw new Error("学习库表达缺失");
    });
  }
  result.sessions.forEach((s) => {
    if (
      !object(s) ||
      typeof s.sessionId !== "string" ||
      !["training", "free", "review", "quick"].includes(s.sessionType) ||
      typeof s.completed !== "boolean" ||
      !Number.isFinite(Date.parse(s.createdAt)) ||
      !Number.isFinite(Date.parse(s.updatedAt)) ||
      (s.draft !== undefined && typeof s.draft !== "string") ||
      !Array.isArray(s.answers) ||
      !Array.isArray(s.candidates) ||
      !Number.isInteger(s.itemIndex) ||
      s.itemIndex < 0
    )
      throw new Error("训练记录格式错误");
    if (
      s.sessionType === "training" &&
      (!["phase0", "training", "completed"].includes(s.phase) ||
        !["L1", "L2", "L3", "L4", "L5", "L6"].includes(s.level))
    )
      throw new Error("训练阶段格式错误");
    if (new Set(s.answers.map((a) => a && a.key)).size !== s.answers.length)
      throw new Error("备份包含重复提交记录");
    s.answers.forEach((a) => {
      if (
        !object(a) ||
        typeof a.text !== "string" ||
        typeof a.key !== "string" ||
        !Number.isFinite(Date.parse(a.at))
      )
        throw new Error("回答记录格式错误");
    });
  });
  result.reviews.forEach((r) => {
    if (
      !object(r) ||
      typeof r.id !== "string" ||
      !["mother", "bank"].includes(r.kind) ||
      typeof r.sourceId !== "string" ||
      typeof r.completed !== "boolean" ||
      !Number.isInteger(r.stage) ||
      r.stage < 0 ||
      r.stage > 4 ||
      !Array.isArray(r.history) ||
      (r.nextReviewAt !== null && !Number.isFinite(Date.parse(r.nextReviewAt)))
    )
      throw new Error("复习记录格式错误");
  });
  for (const [mid, p] of Object.entries(result.motherSentenceProgress)) {
    if (
      !object(p) ||
      !["learning", "reviewing", "completed_review_cycle"].includes(p.status)
    )
      throw new Error("母句进度格式错误");
  }
  const mothers = require("../data/motherSentences");
  result.sessions.forEach((s) => {
    if (
      ["training", "quick"].includes(s.sessionType) &&
      !mothers.some((m) => m.id === s.motherSentenceId)
    )
      throw new Error("训练引用了不存在的母句");
    if (
      s.sessionType === "free" &&
      (!object(s.topic) ||
        typeof s.topic.zh !== "string" ||
        typeof s.topic.reference !== "string")
    )
      throw new Error("话题格式错误");
    if (
      s.sessionType === "review" &&
      !result.reviews.some((r) => r.id === s.reviewId)
    )
      throw new Error("复习训练缺少关联项目");
    if (s.sessionType === "training") {
      const m = mothers.find((m) => m.id === s.motherSentenceId);
      const fields = { L1: "l1", L2: "l2", L3: "l3", L4: "chain", L5: "links" };
      const limit =
        s.level === "L6" ? m.topics.length + 1 : m[fields[s.level]].length;
      if (s.itemIndex >= limit) throw new Error("训练断点超出范围");
    }
    if (
      s.feedback !== null &&
      s.feedback !== undefined &&
      (!object(s.feedback) ||
        typeof s.feedback.revisedAnswer !== "string" ||
        !object(s.feedback.overallFeedback))
    )
      throw new Error("反馈格式错误");
    s.candidates.forEach((c) => {
      if (
        !object(c) ||
        !["expression", "mistake", "natural_upgrade"].includes(c.bankType) ||
        !object(c.data)
      )
        throw new Error("候选格式错误");
    });
  });
  result.reviews.forEach((r) => {
    if (r.kind === "mother" && !mothers.some((m) => m.id === r.sourceId))
      throw new Error("复习引用了不存在的母句");
    if (
      r.kind === "bank" &&
      (!["expression", "mistake", "natural_upgrade"].includes(r.bankType) ||
        !result.banks[r.bankType].some((b) => b.id === r.sourceId))
    )
      throw new Error("复习引用了不存在的学习条目");
  });
  if (result.sessions.filter((s) => !s.completed).length > 1)
    throw new Error("备份包含多个未完成任务");
  const bankIds = Object.values(result.banks).flatMap((list) =>
    list.map((b) => b.id),
  );
  if (new Set(bankIds).size !== bankIds.length)
    throw new Error("备份包含重复学习条目编号");
  const ids = result.sessions
    .map((s) => s.sessionId)
    .concat(result.reviews.map((r) => r.id));
  if (new Set(ids).size !== ids.length) throw new Error("备份包含重复记录编号");
  return copy(result);
}
function warn(message) {
  if (typeof wx !== "undefined" && wx.showToast)
    wx.showToast({ title: message, icon: "none" });
}
function load() {
  if (cache) return copy(cache);
  try {
    const raw = wx.getStorageSync(KEY);
    cache = raw
      ? validate(typeof raw === "string" ? JSON.parse(raw) : raw)
      : initial();
  } catch (error) {
    blocked = true;
    cache = initial();
    warn("读取失败，原数据已保留。请恢复有效备份。");
  }
  return copy(cache);
}
function save(data, allowReplace = false) {
  if (blocked && !allowReplace)
    throw new Error("原数据读取失败，已保护原数据。请先恢复备份或确认清空。");
  const checked = validate(data);
  try {
    wx.setStorageSync(KEY, checked);
    cache = checked;
    blocked = false;
  } catch (error) {
    throw new Error("保存失败，请重试。");
  }
  return copy(cache);
}
function transact(fn) {
  const data = load();
  const result = fn(data);
  save(data);
  return result;
}
function exportBackup() {
  if (blocked) throw new Error("原数据读取失败，无法导出；原存储仍保留。");
  return JSON.stringify(
    { formatVersion: 1, exportedAt: new Date().toISOString(), data: load() },
    null,
    2,
  );
}
function parseBackup(text) {
  if (typeof text !== "string" || text.length > 5 * 1024 * 1024)
    throw new Error("备份文本过大或格式错误。");
  let backup;
  try {
    backup = JSON.parse(text);
  } catch (_) {
    throw new Error("不是有效的 JSON 备份。");
  }
  if (
    !object(backup) ||
    backup.formatVersion !== 1 ||
    typeof backup.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(backup.exportedAt))
  )
    throw new Error("备份格式版本或日期错误。");
  return validate(backup.data, true);
}
module.exports = {
  CURRENT_DATA_VERSION,
  KEY,
  load,
  save,
  transact,
  validate,
  initial,
  exportBackup,
  parseBackup,
  restore: (text) => save(parseBackup(text), true),
  clear: () => save(initial(), true),
  resetCache: () => {
    cache = null;
    blocked = false;
  },
};
