const config = require("../../config/appConfig");
function service() {
  if (config.AI_MODE === "demo") return require("./demoService");
  if (config.AI_MODE === "real") return require("./realService");
  throw new Error("未知 AI 模式。");
}
module.exports = {
  analyzeTrainingResponse: (p) => service().analyzeTrainingResponse(p),
  analyzeFreeExpression: (p) => service().analyzeFreeExpression(p),
  generateBankCandidates: (p) => service().generateBankCandidates(p),
};
