module.exports = {
  normalize: (text) =>
    String(text || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " "),
};
