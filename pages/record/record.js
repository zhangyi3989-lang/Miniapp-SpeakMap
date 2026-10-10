const training = require("../../services/trainingService");
Page({
  onLoad(q) {
    const session = training.get(q.sid);
    this.setData({ session, recordings: session ? Object.values(session.voiceRecordings || {}) : [] });
  },
});
