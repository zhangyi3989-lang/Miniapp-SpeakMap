module.exports = {
  inputMaxLength: 1000,
  submissionGuardMs: 400,
  training: {
    phase0Enabled: true,
    L1: { itemCount: 6 },
    L2: { itemCount: 6 },
    L3: { itemCount: 5 },
    L4: { defaultNodes: 5 },
    L5: { rounds: 2 },
    L6: { topics: 2 },
  },
  review: { intervalsDays: [1, 3, 7, 14, 30], retryAfterFailDays: 1 },
  quickRecall: { enabled: true },
};
