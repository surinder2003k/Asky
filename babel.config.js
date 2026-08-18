module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  plugins.push("react-native-worklets/plugin");
  // Hermes does not support dynamic import(). pdfjs-dist emits
  // `yield import(...)` which crashes the hermes compiler with
  // "Invalid expression encountered". Transform it to require() instead.
  plugins.push(["babel-plugin-transform-dynamic-import", { method: "cjs" }]);

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind", unstable_transformImportMeta: true }],
      "nativewind/babel",
    ],
    plugins,
  };
};
