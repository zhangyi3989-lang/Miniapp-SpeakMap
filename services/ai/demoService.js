const config = require("../../config/appConfig");
const id = require("../../utils/id");
function analyze(payload) {
  const ref = payload.reference || "For me, small changes make a difference.";
  return Promise.resolve({
    mode: "demo",
    overallFeedback: { isOnTask: null, summary: config.demoNotice },
    languageIssues: [],
    naturalUpgrades: [],
    revisedAnswer: ref,
    bankCandidates: [
      {
        id: id("candidate"),
        bankType: "expression",
        data: {
          expression: ref,
          meaningZh: payload.meaningZh || "一种小改变能带来不同的真实场景。",
          example: ref,
        },
        provenance: "demo_reference",
        userProduced: false,
        label: "示例候选",
      },
    ],
    trainingState: payload.trainingState || null,
  });
}
module.exports = {
  analyzeTrainingResponse: analyze,
  analyzeFreeExpression: analyze,
  generateBankCandidates: (payload) =>
    analyze(payload).then((f) => f.bankCandidates),
};
