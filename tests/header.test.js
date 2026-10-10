const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function header(stackSize) {
  let definition, calls = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'components/brand-header/brand-header.js'), 'utf8'), {
    Component: d => { definition = d; },
    getCurrentPages: () => Array(stackSize).fill({}),
    wx: {
      getWindowInfo: () => ({ statusBarHeight: 47, windowWidth: 390 }),
      getMenuButtonBoundingClientRect: () => ({ left: 281 }),
      navigateBack: o => { calls.push('back'); },
      switchTab: o => { calls.push(o.url); }
    }
  });
  return { definition, calls };
}
test('shared header uses device safe inset and capsule position', () => {
  const { definition } = header(1);
  const component = { data: {}, setData(d) { Object.assign(this.data, d); } };
  definition.lifetimes.attached.call(component);
  assert.equal(component.data.statusBarHeight, 47);
  assert.equal(component.data.menuLeft, 281);
});
test('back button returns to prior page or opens homepage for a direct entry', () => {
  const nested = header(2); nested.definition.methods.returnPage(); assert.deepEqual(nested.calls, ['back']);
  const direct = header(1); direct.definition.methods.returnPage(); assert.deepEqual(direct.calls, ['/pages/home/home']);
});
test('every registered page uses custom navigation so native empty bar cannot split the background', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json')));
  for (const route of app.pages) {
    const config = JSON.parse(fs.readFileSync(path.join(root, route + '.json')));
    assert.equal(config.navigationStyle, 'custom', route);
    if (route !== 'pages/home/home') assert.ok(fs.readFileSync(path.join(root, route + '.wxml'), 'utf8').startsWith('<brand-header'), route);
  }
});
