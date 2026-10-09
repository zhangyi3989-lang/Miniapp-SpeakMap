const config = require("../config/trainingConfig");
module.exports = {
  input(text) {
    if (typeof text !== "string" || !text.trim())
      throw new Error("先写下你的回答。");
    if (text.length > config.inputMaxLength)
      throw new Error(`最多输入 ${config.inputMaxLength} 字符。`);
    return text.trim();
  },
};
