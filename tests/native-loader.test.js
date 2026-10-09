const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const appConfig = require("../app.json");

// 模拟微信的文件模块解析：省略扩展名仅补 .js，不查找目录 index.js。
function runtime(legacyTraining = false) {
  const cache = new Map(),
    pages = new Map(),
    components = new Map();
  let currentPage;
  let application;
  const context = vm.createContext({
    wx: {
      getStorageSync: () => "",
      setStorageSync: () => {},
      showToast: () => {},
    },
    Page: (definition) => pages.set(currentPage, definition),
    App: (definition) => {
      application = definition;
    },
    Component: (definition) => components.set(currentPage, definition),
  });
  function load(file) {
    const filename = path.extname(file) ? file : file + ".js";
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile())
      throw new Error("微信模块未定义: " + path.relative(root, filename));
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    let source = fs.readFileSync(filename, "utf8");
    if (legacyTraining && filename.endsWith("/pages/training/training.js")) {
      source = source.replace("../../services/ai/index", "../../services/ai");
    }
    const wrapper = vm.runInContext(
      "(function(require,module,exports){\n" + source + "\n})",
      context,
      { filename },
    );
    wrapper(
      (request) => {
        if (!request.startsWith("."))
          throw new Error("小程序不能使用 Node 内置模块");
        return load(path.resolve(path.dirname(filename), request));
      },
      module,
      module.exports,
    );
    return module.exports;
  }
  return {
    pages,
    components,
    boot() {
      load(path.join(root, "app.js"));
      application.onLaunch();
      for (const component of new Set(appConfig.pages.flatMap(route => Object.values(JSON.parse(fs.readFileSync(path.join(root,route + ".json"), "utf8")).usingComponents || {})))) {
        currentPage = component;
        load(path.join(root, component.slice(1) + ".js"));
      }
      for (const route of appConfig.pages) {
        currentPage = route;
        load(path.join(root, route + ".js"));
      }
    },
  };
}

test("复现旧目录引用中断注册，修复后 15 个页面按微信文件解析规则全部注册", () => {
  const broken = runtime(true);
  assert.throws(() => broken.boot(), /services\/ai\.js/);
  assert.equal(broken.pages.has("pages/profile/profile"), false);
  const fixed = runtime();
  fixed.boot();
  assert.equal(fixed.pages.size, 15);
  assert.equal(fixed.components.size, 2);
  assert.equal(
    fixed.components.get("/components/brand-mascot/brand-mascot").properties
      .compact.type.name,
    "Boolean",
  );
  for (const tab of appConfig.tabBar.list) {
    const definition = fixed.pages.get(tab.pagePath);
    assert.ok(definition, tab.pagePath + " 必须注册");
    const instance = Object.assign({}, definition, {
      data: JSON.parse(JSON.stringify(definition.data || {})),
      setData(fields) {
        Object.assign(this.data, fields);
      },
    });
    if (instance.onLoad) instance.onLoad({});
    assert.doesNotThrow(() => instance.onShow());
    if (tab.pagePath.endsWith("/profile"))
      assert.equal(instance.data.stats.answers, 0);
    if (tab.pagePath.endsWith("/bank"))
      assert.equal(instance.data.items.length, 0);
    if (tab.pagePath.endsWith("/review"))
      assert.equal(instance.data.dueCount, 0);
  }
});

test('品牌组件按页面注册，依赖图不包含自引用或相互递归', () => {
  assert.equal(appConfig.usingComponents, undefined);
  for (const route of appConfig.pages) {
    const pageConfig=JSON.parse(fs.readFileSync(path.join(root,route+'.json'),'utf8'));
    assert.ok(pageConfig.usingComponents['brand-header']);
    const visiting=new Set(),visited=new Set();
    function visit(component) {
      assert.ok(!visiting.has(component),'组件依赖不能递归: '+component);
      if(visited.has(component))return;
      visiting.add(component);
      const config=JSON.parse(fs.readFileSync(path.join(root,component.slice(1)+'.json'),'utf8'));
      Object.values(config.usingComponents||{}).forEach(visit);
      visiting.delete(component);visited.add(component);
    }
    Object.values(pageConfig.usingComponents).forEach(visit);
  }
});
