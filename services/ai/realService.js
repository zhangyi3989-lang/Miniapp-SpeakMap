const config = require("../../config/appConfig");
function analyze(payload) {
  return new Promise((resolve, reject) => {
    if (!config.cloudEnv || !wx.cloud) {
      reject(new Error("尚未配置安全云端 AI 服务。"));
      return;
    }
    wx.cloud.callFunction({
      name: config.aiFunctionName,
      data: { action: "analyze", payload },
      success: (res) => {
        const f = res.result;
        if (
          !f ||
          f.mode !== "real" ||
          !f.overallFeedback ||
          !Array.isArray(f.languageIssues) ||
          !Array.isArray(f.naturalUpgrades) ||
          !Array.isArray(f.bankCandidates) ||
          typeof f.revisedAnswer !== "string"
        ) {
          reject(new Error("AI 返回格式错误。"));
          return;
        }
        f.bankCandidates = f.bankCandidates.map((c) =>
          Object.assign({}, c, { provenance: "ai", userProduced: false }),
        );
        resolve(f);
      },
      fail: reject,
    });
  });
}
module.exports = {
  analyzeTrainingResponse: analyze,
  analyzeFreeExpression: analyze,
  generateBankCandidates: (p) => analyze(p).then((f) => f.bankCandidates),
};
