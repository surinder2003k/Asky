// Bundle shim for Gradle: copies the verified prebuilt JS bundle and sourcemap
// (produced by `expo export:embed` which always generates the correct bundle —
// Gradle's own Metro run was producing a stale transform output) into the
// output locations requested by react.gradle's createBundleReleaseJsAndAssets.
const fs = require("fs");
const path = require("path");

const PREBUILT_BUNDLE = path.resolve(
  __dirname,
  "../android/app/build/generated/assets/prebuilt/index.android.bundle"
);

const args = process.argv.slice(2);
let bundleOutput = "";
let sourcemapOutput = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--bundle-output" && args[i + 1]) {
    bundleOutput = args[i + 1];
  } else if (
    (args[i] === "--sourcemap-output" || args[i] === "--sourcemapPath" || args[i] === "--sourcemap-path") &&
    args[i + 1]
  ) {
    sourcemapOutput = args[i + 1];
  }
}

if (bundleOutput) {
  fs.mkdirSync(path.dirname(bundleOutput), { recursive: true });
  fs.copyFileSync(PREBUILT_BUNDLE, bundleOutput);
  console.log(
    `Writing prebuilt bundle to: ${bundleOutput} (${fs.statSync(PREBUILT_BUNDLE).size} bytes)`
  );
  // Sentinel: Gradle's react.gradle runs Metro AFTER this shim exits and can
  // overwrite the output path. Appending a distinct sentinel makes it trivial
  // to detect a stale Metro bundle post-build (the verified prebuilt bundle
  // must be the ONLY thing in the APK).
  fs.appendFileSync(
    bundleOutput,
    "// BUNDLE_SHIM_SENTINEL " + fs.statSync(PREBUILT_BUNDLE).mtimeMs + "\n"
  );
}

if (sourcemapOutput) {
  const prebuiltMap = PREBUILT_BUNDLE + ".map";
  if (fs.existsSync(prebuiltMap)) {
    fs.mkdirSync(path.dirname(sourcemapOutput), { recursive: true });
    fs.copyFileSync(prebuiltMap, sourcemapOutput);
    console.log(`Writing prebuilt sourcemap to: ${sourcemapOutput}`);
  }
}
