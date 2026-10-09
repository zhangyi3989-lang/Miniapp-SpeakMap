const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const root = path.resolve(__dirname, "..");
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else files.push(p);
  }
}
walk(root);
let checks = 0;
function check(ok, message) {
  checks++;
  if (!ok) throw new Error(message);
}
for (const file of files) {
  if (file.endsWith(".js")) {
    const r = cp.spawnSync(process.execPath, ["--check", file], {
      encoding: "utf8",
    });
    check(r.status === 0, file + " " + r.stderr);
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
      const p = path.resolve(path.dirname(file), m[1]);
      check(
        (fs.existsSync(p) && fs.statSync(p).isFile()) ||
          fs.existsSync(p + ".js"),
        `模块文件不存在（微信不自动查找目录 index.js） ${file}: ${m[1]}`,
      );
    }
    if (!file.includes("/tests/") && !file.includes("/scripts/"))
      check(
        !/\b(window|document|localStorage|sessionStorage)\b/.test(text),
        "出现浏览器 API: " + file,
      );
  }
  if (file.endsWith(".json")) {
    JSON.parse(fs.readFileSync(file, "utf8"));
    checks++;
  }
}
const app = require("../app.json");
check(new Set(app.pages).size === app.pages.length, "页面重复");
for (const page of app.pages) {
  for (const ext of ["js", "json", "wxml", "wxss"])
    check(
      fs.existsSync(path.join(root, page + "." + ext)),
      `页面文件缺失 ${page}.${ext}`,
    );
  const text = fs.readFileSync(path.join(root, page + ".wxml"), "utf8"),
    code = fs.readFileSync(path.join(root, page + ".js"), "utf8");
  for (const m of text.matchAll(/bind(?:tap|input|change)="([^"{}]+)"/g))
    check(
      new RegExp("(?:" + m[1] + "\\s*[:(])").test(code),
      "事件方法缺失 " + page + " " + m[1],
    );
}
for (const tab of app.tabBar.list) {
  check(app.pages.includes(tab.pagePath), "底部导航引用错误");
  for (const key of ["iconPath", "selectedIconPath"])
    if (tab[key])
      check(
        fs.existsSync(path.join(root, tab[key])),
        "底部导航图标缺失 " + tab[key],
      );
}
for (const component of Object.values(app.usingComponents || {})) {
  for (const ext of ["js", "json", "wxml", "wxss"])
    check(
      fs.existsSync(path.join(root, component.slice(1) + "." + ext)),
      "组件文件缺失 " + component,
    );
}
const mothers = require("../data/motherSentences");
const functions = require("../data/functionalExpressions");
const config = require("../config/trainingConfig");
check(functions.length === 12, "功能表达应有 12 类");
check(
  new Set(mothers.map((m) => m.id)).size === mothers.length,
  "母句编号重复",
);
for (const m of mothers) {
  check(m.examples.length >= 2 && m.examples.length <= 5, "例句数量错误");
  check(
    m.l1.length >= config.training.L1.itemCount &&
      m.l2.length >= config.training.L2.itemCount &&
      m.l3.length >= config.training.L3.itemCount,
    "训练题目不足",
  );
  check(m.chain.length >= config.training.L4.defaultNodes, "逻辑地图不足");
  check(
    m.links.length >= config.training.L5.rounds &&
      m.topics.length >= config.training.L6.topics,
    "联动或话题不足",
  );
  check(m.review.length === 5, "复习提示不全");
  for (const node of m.chain)
    check(
      functions.some((f) => f.id === node[2]),
      "逻辑节点功能表达引用错误",
    );
  check(
    m.topics[0][0] !== m.topics[1][0] && !m.topics[1][2],
    "Topic 2 必须新话题且无提示",
  );
}
// 检查 WXML 标签成对、属性语法、实体转义（不替代微信编译器）。
for (const file of files.filter((f) => f.endsWith(".wxml"))) {
  const template = fs.readFileSync(file, "utf8");
  for (const src of template.matchAll(/src="(\/[^"{}]+)"/g))
    check(
      fs.existsSync(path.join(root, src[1].slice(1))),
      "本地图片缺失 " + src[1],
    );
  for (const match of template.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    const expression = match[1];
    check(
      !/&(?:amp|lt|gt|quot|apos);/.test(expression),
      "WXML 插值中不能用 HTML 实体替代运算符 " + file,
    );
    try {
      new Function("return (" + expression + ")");
      checks++;
    } catch (error) {
      throw new Error("WXML 插值语法错误 " + file + ": " + error.message);
    }
  }
  const source = fs.readFileSync(file, "utf8"),
    stack = [];
  for (const match of source.matchAll(/<\/?[\w-]+\b[^>]*>/g)) {
    const tag = match[0],
      name = /^<\/?([\w-]+)/.exec(tag)[1];
    check(
      [
        "view",
        "text",
        "button",
        "input",
        "textarea",
        "picker",
        "checkbox-group",
        "checkbox",
        "label",
        "block",
        "image",
        ...Object.keys(app.usingComponents || {}),
      ].includes(name),
      "非原生标签 " + name + " " + file,
    );
    if (tag.startsWith("</"))
      check(stack.pop() === name, "WXML 标签不匹配 " + file + " " + name);
    else if (!tag.endsWith("/>")) stack.push(name);
  }
  check(!stack.length, "WXML 未闭合 " + file);
  check(
    !/&(?!(?:amp|lt|gt|quot|apos);)/.test(
      source.replace(/\{\{[\s\S]*?\}\}/g, ""),
    ),
    "WXML 实体未转义 " + file,
  );
}
console.log(
  `检查通过：${checks} 项静态检查，${app.pages.length} 个页面，${mothers.length} 个完整母句。`,
);
