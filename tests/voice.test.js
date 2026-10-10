const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../services/storage');
const voice = require('../services/voiceService');
let data, callbacks = {}, fsCallbacks, saveFails, writesFail, states, unlinked;
const originalLoad = storage.load, originalTransact = storage.transact;
const manager = {
  onStart(fn) { callbacks.start = fn; }, onStop(fn) { callbacks.stop = fn; }, onError(fn) { callbacks.error = fn; },
  start(options) { assert.equal(options.format, 'mp3'); assert.equal(options.duration, 180000); },
  stop() { callbacks.stop({ tempFilePath: '/tmp/audio', duration: 1200 }); }
};
global.wx = {
  env: { USER_DATA_PATH: '/user' }, getRecorderManager: () => manager,
  getFileSystemManager: () => ({ saveFile(options) { fsCallbacks = options; if (saveFails) options.fail(); else options.success(); }, unlink(o) { unlinked.push(o.filePath); } })
};
test.beforeEach(() => {
  data = { sessions: [{ sessionId: 's1', voiceRecordings: {} }] }; states = []; unlinked = []; saveFails = false; writesFail = false;
  storage.load = () => JSON.parse(JSON.stringify(data));
  storage.transact = fn => { if (writesFail) throw new Error('disk full'); fn(data); };
});
test.after(() => { storage.load = originalLoad; storage.transact = originalTransact; });
function start() { voice.start({ sid: 's1', key: 'L1-0', onState: (state, value) => states.push({ state, value }) }); }
test('recording saves a durable file and remains available after reading session data again', () => {
  start(); callbacks.start(); voice.stop('s1', 'L1-0');
  assert.equal(states.at(-1).state, 'ready');
  assert.ok(voice.get('s1', 'L1-0').path.startsWith('/user/speakmap-voice-'));
  assert.equal(voice.get('s1', 'L1-0').duration, 1200);
  assert.equal(fsCallbacks.tempFilePath, '/tmp/audio');
});
test('failed replacement keeps the previous recording and unlocks recorder', () => {
  data.sessions[0].voiceRecordings['L1-0'] = { path: '/user/speakmap-voice-old.mp3' };
  saveFails = true; start(); callbacks.start(); voice.stop('s1', 'L1-0');
  assert.equal(states.at(-1).state, 'error'); assert.equal(voice.get('s1', 'L1-0').path, '/user/speakmap-voice-old.mp3');
  assert.equal(unlinked.length, 0);
  saveFails = false; start(); callbacks.start(); voice.stop('s1', 'L1-0');
  assert.ok(unlinked.includes('/user/speakmap-voice-old.mp3'));
});
test('storage failure removes the orphaned audio and preserves prior session', () => {
  writesFail = true; start(); callbacks.start(); voice.stop('s1', 'L1-0');
  assert.equal(states.at(-1).state, 'error'); assert.equal(voice.get('s1', 'L1-0'), null); assert.equal(unlinked.length, 1);
});
test('leaving before recorder start requests stop when start arrives, and concurrent recording is refused', () => {
  start(); assert.throws(start, /另一个录音/); voice.stop('s1', 'L1-0'); callbacks.start();
  assert.equal(states.at(-1).state, 'ready');
});
test('short recording and native recorder errors do not save a clip', () => {
  start(); callbacks.start(); callbacks.stop({ tempFilePath: '/tmp/audio', duration: 100 });
  assert.equal(voice.get('s1', 'L1-0'), null); assert.equal(states.at(-1).state, 'error');
  start(); callbacks.error(); assert.equal(states.at(-1).state, 'error');
});
