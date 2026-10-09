const topics = require("../../data/freeTopics");
const training = require("../../services/trainingService");
const ui = require("../../utils/page");
Page({
  data: { topics },
  choose(e) {
    ui.guard(() => {
      ui.goSession(
        training.create("free", "", {
          topic: topics.find((t) => t.id === e.currentTarget.dataset.id),
        }),
      );
    });
  },
});
