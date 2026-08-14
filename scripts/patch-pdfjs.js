// postinstall patch: Hermes does not support dynamic import().
// pdfjs-dist 4.x emits `await import(/*webpackIgnore: true*/this.workerSrc)`
// which crashes the hermes compiler ("Invalid expression encountered").
// Rewrite it to a require()-based Promise so Hermes can compile it.
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.mjs",
);

if (!fs.existsSync(target)) {
  console.log("[patch-pdfjs] pdf.mjs not found, skipping");
  process.exit(0);
}

let src = fs.readFileSync(target, "utf8");

const needle = "await import(/*webpackIgnore: true*/this.workerSrc)";
const replacement = "await Promise.resolve().then(() => require(this.workerSrc))";

if (src.includes(needle)) {
  src = src.replace(needle, replacement);
  fs.writeFileSync(target, src);
  console.log("[patch-pdfjs] patched dynamic import in pdf.mjs for Hermes");
} else {
  console.log("[patch-pdfjs] no dynamic import found in pdf.mjs, nothing to patch");
}
