// Custom Metro babel transformer that forces Babel transpilation for ALL
// modules (including node_modules). This fixes Hermes compile failures
// caused by un-transpiled legacy packages (e.g. get-intrinsic / object.assign)
// that use `typeof X === 'undefined' ? undefined : X` expressions which
// Hermes' parser rejects in release builds.
const path = require("path");

const upstream = require("@react-native/metro-babel-transformer");

// Packages known to contain Hermes-incompatible syntax.
// The default Metro babel transformer skips transpilation for node_modules,
// so we keep that optimization except for the modules below.
const FORCE_TRANSPILE_PATTERNS = [
  "get-intrinsic",
  "object.assign",
  "es-set-tostringtag",
  "call-bind",
  "call-bound",
  "es-abstract",
  "object-is",
  "object-keys",
  "is-nan",
  "function-bind",
  "hasown",
  "has-proto",
  "has-symbols",
  "has-tostringtag",
  "set-function-length",
  "define-data-property",
  "gopd",
  "es-errors",
  "es-object-atoms",
  "es-define-property",
  "side-channel",
  "math-intrinsics",
  "reflect.getprototypeof",
  "es-shim-unscopables",
  "function.prototype.name",
  "functions-have-names",
  "is-arguments",
  "is-generator-function",
  "is-regex",
  "is-date-object",
  "is-symbol",
  "is-negative-zero",
  "which-typed-array",
  "safe-regex-test",
  "regexp.prototype.flags",
  "string.prototype.trim",
  "string.prototype.trimstart",
  "string.prototype.trimend",
  "typed-array-length",
  "typed-array-byte-length",
  "typed-array-byte-offset",
  "typed-array-buffer",
  "array-buffer-byte-length",
  "is-typed-array",
  "available-typed-arrays",
  "which-boxed-primitive",
  "is-boolean-object",
  "is-number-object",
  "is-string",
  "is-bigint",
  "data-view-byte-length",
  "data-view-byte-offset",
  "data-view-buffer",
  "is-shared-array-buffer",
  "unbox-primitive",
  "which-collection",
  "is-map",
  "is-set",
  "is-weakmap",
  "is-weakset",
  "globalthis",
  "es-array-method-boxes-properly",
  "array-includes",
  "array.prototype.flat",
  "array.prototype.flatmap",
  "array.prototype.findlastindex",
  "array.fromasync",
  "iterator.prototype",
  "asynciterator.prototype",
  "es-iterator-helpers",
  "string.prototype.matchall",
  "es-to-primitive",
  "fast-deep-equal",
  "util",
  "browserify-sign",
  "browserify-cipher",
  "readable-stream",
  "process",
  "buffer",
  "stream-browserify",
  "bn.js",
  "elliptic",
  "hash.js",
  "create-hash",
  "create-hmac",
  "sha.js",
  "md5.js",
  "ripemd160",
  "des.js",
  "public-encrypt",
  "diffie-hellman",
  "miller-rabin",
  "parse-asn1",
  "asn1.js",
  "assert",
  "events",
  "os-browserify",
  "path-browserify",
  "console-browserify",
  "constants-browserify",
  "crypto-browserify",
  "domain-browser",
  "https-browserify",
  "http-browserify",
  "punycode",
  "querystring-es3",
  "timers-browserify",
  "tty-browserify",
  "url",
  "vm-browserify",
  "stream-http",
  "node-libs-browser",
];

function shouldTranspile(filePath) {
  if (!filePath.includes(path.sep + "node_modules" + path.sep)) return true;
  return FORCE_TRANSPILE_PATTERNS.some((pat) =>
    filePath.includes(path.sep + "node_modules" + path.sep + pat + path.sep),
  );
}

const transformer = Object.create(upstream);

transformer.transform = async function (src, filename, options) {
  return upstream.transform(src, filename, {
    ...options,
    customTransformOptions: {
      ...(options.customTransformOptions || {}),
      dev: true, // forces babel even for node_modules when shouldTranspile
    },
    // Metro's babel transformer honors `shouldTransform` via plugin hooks;
    // the cleanest reliable override is to mark dev mode for targeted files.
    ...(shouldTranspile(filename)
      ? { dev: true }
      : {}),
  });
};

module.exports = transformer;
