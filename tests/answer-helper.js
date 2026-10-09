// 测试输入遵守整组任务的真实行数要求，单题仍提交一条。
const training = require("../services/trainingService");
module.exports = (sid, text) => {
  const s = training.get(sid);
  const t = training.task(s);
  return t.batch
    ? Array.from({ length: t.batchCount }, () => text).join("\n")
    : text;
};
