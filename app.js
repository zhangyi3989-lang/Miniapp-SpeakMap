const config = require("./config/appConfig");
App({
  onLaunch() {
    if (config.AI_MODE === "real" && config.cloudEnv && wx.cloud)
      wx.cloud.init({ env: config.cloudEnv });
    require("./services/storage").load();
  },
});
