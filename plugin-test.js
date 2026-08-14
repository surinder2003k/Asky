const babel = require("@babel/core");
const src = `function* f(){ var w = yield import(/*webpackIgnore: true*/x); return w; }`;
const out = babel.transformSync(src, {
  plugins: [["@babel/plugin-syntax-dynamic-import"], ["babel-plugin-transform-dynamic-import", { method: "cjs" }]],
  filename: "test.js",
});
console.log(out.code);
