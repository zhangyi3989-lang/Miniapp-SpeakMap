const voice = require('../../services/voiceService');
Component({
  properties: {
    sessionId: String, stepKey: String, title: String,
    disabled: Boolean, readOnly: Boolean, clip: Object
  },
  data: { state: 'idle', saved: null, seconds: 0, message: '', permissionDenied: false },
  observers: { 'sessionId, stepKey, clip': function () { this.refresh(); } },
  lifetimes: {
    attached() {
      this.alive = true;
      this.audio = wx.createInnerAudioContext();
      this.audio.onEnded(() => this.state('ready'));
      this.audio.onError(() => this.state('error', '无法播放录音。录音只保存在录制时的设备上。'));
      this.refresh();
    },
    detached() { this.alive = false; this.cleanup(); if (this.audio) this.audio.destroy(); }
  },
  pageLifetimes: { hide() { this.cleanup(); }, show() { this.hidden = false; this.refresh(); } },
  methods: {
    refresh() {
      if (['recording', 'saving', 'starting', 'authorizing'].includes(this.data.state)) return;
      const saved = this.data.clip || (this.data.sessionId && voice.get(this.data.sessionId, this.data.stepKey));
      this.setData({ saved: saved || null, state: saved ? 'ready' : 'idle', message: '' });
    },
    state(state, detail) {
      clearInterval(this.timer);
      if (!this.alive) return;
      const busy = ['recording', 'saving', 'starting', 'authorizing'].includes(state);
      this.setData({ state, message: state === 'error' ? detail : '' });
      this.triggerEvent('statechange', { busy });
      if (state === 'recording') {
        const start = Date.now();
        this.setData({ seconds: 0 });
        this.timer = setInterval(() => this.setData({ seconds: Math.floor((Date.now() - start) / 1000) }), 500);
      }
      if (state === 'ready' && detail) {
        this.setData({ saved: detail }); this.triggerEvent('saved', { clip: detail });
      }
    },
    start() {
      if (this.data.disabled || this.data.readOnly || ['recording', 'saving', 'starting', 'authorizing'].includes(this.data.state)) return;
      if (this.audio) this.audio.stop();
      if (this.data.saved) wx.showModal({ title: '重新录制', content: '新录音保存成功后，会替换本题的原录音。', success: r => { if (r.confirm) this.authorize(); } });
      else this.authorize();
    },
    authorize() {
      this.state('authorizing');
      wx.authorize({ scope: 'scope.record', success: () => {
        if (!this.alive || this.hidden) { this.state(this.data.saved ? 'ready' : 'idle'); return; }
        this.setData({ permissionDenied: false }); this.state('starting');
        this.job = { sid: this.data.sessionId, key: this.data.stepKey, title: this.data.title, onState: (s, d) => this.state(s, d) };
        try { voice.start(this.job); }
        catch (e) { this.state('error', e.message); }
      }, fail: () => { if (!this.alive) return; this.setData({ permissionDenied: true }); this.state('error', '需要允许使用麦克风才能录音。'); } });
    },
    permissions() { wx.openSetting({ success: r => { if (r.authSetting['scope.record']) { this.setData({ permissionDenied: false }); this.refresh(); } } }); },
    stop() { if (this.job) voice.stop(this.job.sid, this.job.key); },
    play() {
      if (!this.data.saved || !this.audio) return;
      if (this.data.state === 'playing') { this.audio.stop(); this.state('ready'); return; }
      this.audio.src = this.data.saved.path; this.audio.play(); this.state('playing');
    },
    cleanup() { this.hidden = true; clearInterval(this.timer); this.stop(); if (this.audio) this.audio.stop(); },
  }
});
