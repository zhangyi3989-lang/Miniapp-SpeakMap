Component({
  properties: {
    section: { type: String, value: '' },
    back: { type: Boolean, value: false },
    showSearch: { type: Boolean, value: false }
  },
  data: { statusBarHeight: 24, menuLeft: 270 },
  lifetimes: {
    attached() {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
      let menu;
      try { menu = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect(); } catch (_) {}
      this.setData({ statusBarHeight: typeof info.statusBarHeight === 'number' ? info.statusBarHeight : 24, menuLeft: menu && menu.left > 0 ? menu.left : (info.windowWidth || 375) - 100 });
    }
  },
  methods: {
    returnPage() {
      if (getCurrentPages().length > 1) wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) });
      else wx.switchTab({ url: '/pages/home/home' });
    },
    search() { this.triggerEvent('search'); }
  }
});
