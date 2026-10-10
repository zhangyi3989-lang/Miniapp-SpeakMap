const storage = require('./storage');
let manager;
let active = null;
function recordings(sid) {
  const s = storage.load().sessions.find(s => s.sessionId === sid);
  return s ? s.voiceRecordings || {} : {};
}
function get(sid, key) { return recordings(sid)[key] || null; }
function notify(job, state, detail) { if (job.onState) job.onState(state, detail); }
function recorder() {
  if (manager) return manager;
  manager = wx.getRecorderManager();
  manager.onStart(() => {
    if (active) { active.startedAt = Date.now(); notify(active, 'recording'); if (active.stopRequested) stop(active.sid, active.key); }
  });
  manager.onError(() => {
    const job = active; active = null;
    if (job) notify(job, 'error', '录音未完成，请检查麦克风权限后重试。');
  });
  manager.onStop(result => {
    const job = active;
    if (!job || job.saving) return;
    job.saving = true;
    const duration = Number(result.duration) || Date.now() - job.startedAt;
    if (!result.tempFilePath || !Number.isFinite(duration) || duration < 500) {
      active = null; notify(job, 'error', '录音太短，请再说一次。'); return;
    }
    notify(job, 'saving');
    const path = wx.env.USER_DATA_PATH + '/speakmap-voice-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + '.mp3';
    wx.getFileSystemManager().saveFile({
      tempFilePath: result.tempFilePath, filePath: path,
      success() {
        try {
          const old = get(job.sid, job.key);
          const clip = { path, duration, seconds: Math.max(1, Math.round(duration / 1000)), at: new Date().toISOString(), step: job.key, title: job.title || '语音练习' };
          storage.transact(d => {
            const s = d.sessions.find(s => s.sessionId === job.sid);
            if (!s) throw new Error('训练记录不存在。');
            s.voiceRecordings = Object.assign({}, s.voiceRecordings, { [job.key]: clip });
          });
          if (old && old.path !== path) removeFile(old.path);
          active = null; notify(job, 'ready', clip);
        } catch (e) { removeFile(path); active = null; notify(job, 'error', '录音保存失败：' + e.message); }
      },
      fail() { active = null; notify(job, 'error', '录音保存失败，请检查本机存储空间后重试。'); }
    });
  });
  return manager;
}
function removeFile(path) {
  if (path && path.startsWith(wx.env.USER_DATA_PATH + '/speakmap-voice-'))
    wx.getFileSystemManager().unlink({ filePath: path, fail() {} });
}
function start(job) {
  if (active) throw new Error('另一个录音正在进行，请先结束它。');
  const r = recorder();
  active = job;
  try { r.start({ duration: 180000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'mp3' }); }
  catch (e) { active = null; throw e; }
}
function stop(sid, key) {
  if (active && active.sid === sid && active.key === key) {
    active.stopRequested = true;
    if (active.startedAt && !active.stopping) { active.stopping = true; manager.stop(); }
  }
}
module.exports = { get, recordings, start, stop };
