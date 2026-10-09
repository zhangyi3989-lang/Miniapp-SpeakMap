const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const appConfig = require('../app.json');

// 模拟微信的文件模块解析：省略扩展名仅补 .js，不查找目录 index.js。
function runtime(legacyTraining = false) {
  const cache = new Map(), pages = new Map();
  let currentPage;
  let application;
  const context = vm.createContext({
    wx: { getStorageSync: () => '', setStorageSync: () => {}, showToast: () => {} },
    Page: definition => pages.set(currentPage, definition),
    App: definition => { application = definition; }
  });
  function load(file) {
    const filename = path.extname(file) ? file : file + '.js';
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile())
      throw new Error('微信模块未定义: ' + path.relative(root, filename));
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    let source = fs.readFileSync(filename, 'utf8');
    if (legacyTraining && filename.endsWith('/pages/training/training.js')) {
      source = source.replace('../../services/ai/index', '../../services/ai');
    }
    const wrapper = vm.runInContext('(function(require,module,exports){\n'+source+'\n})', context, {filename});
    wrapper(request => {
      if (!request.startsWith('.')) throw new Error('小程序不能使用 Node 内置模块');
      return load(path.resolve(path.dirname(filename), request));
    }, module, module.exports);
    return module.exports;
  }
  return {
    pages,
    boot() {
      load(path.join(root, 'app.js'));
      application.onLaunch();
      for (const route of appConfig.pages) {
        currentPage = route;
        load(path.join(root, route + '.js'));
      }
    }
  };
}

test('复现旧目录引用中断注册，修复后 13 个页面按微信文件解析规则全部注册', () => {
  const broken = runtime(true);
  assert.throws(() => broken.boot(), /services\/ai\.js/);
  assert.equal(broken.pages.has('pages/profile/profile'), false);
  const fixed = runtime();
  fixed.boot();
  assert.equal(fixed.pages.size, 13);
  for (const tab of appConfig.tabBar.list) {
    const definition = fixed.pages.get(tab.pagePath);
    assert.ok(definition, tab.pagePath + ' 必须注册');
    const instance = Object.assign({}, definition, {
      data: JSON.parse(JSON.stringify(definition.data || {})),
      setData(fields) { Object.assign(this.data, fields); }
    });
    if (instance.onLoad) instance.onLoad({});
    assert.doesNotThrow(() => instance.onShow());
    if (tab.pagePath.endsWith('/profile')) assert.equal(instance.data.stats.answers, 0);
    if (tab.pagePath.endsWith('/bank')) assert.equal(instance.data.items.length, 0);
    if (tab.pagePath.endsWith('/review')) assert.equal(instance.data.dueCount, 0);
  }
});
