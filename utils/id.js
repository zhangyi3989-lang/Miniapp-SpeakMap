let sequence = 0;
module.exports = (prefix) =>
  `${prefix}_${Date.now()}_${++sequence}_${Math.random().toString(36).slice(2, 8)}`;
