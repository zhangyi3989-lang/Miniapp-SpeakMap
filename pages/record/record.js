const training = require("../../services/trainingService");
Page({
  onLoad(q) {
    this.setData({ session: training.get(q.sid) });
  },
});
