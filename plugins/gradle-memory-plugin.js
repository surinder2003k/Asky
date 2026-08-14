/**
 * gradle-memory-plugin
 *
 * Expo config plugin that patches android/gradle.properties during prebuild
 * to reduce peak memory during release builds. Without this, the Metro JS
 * bundle step (createBundleReleaseJsAndAssets) can be OOM-killed on
 * memory-constrained build runners, which surfaces as
 * "Gradle build failed with unknown error" in the Run gradlew phase.
 *
 * This runs as part of the prebuild phase, so the settings travel with
 * the committed project to EAS (unlike raw android/gradle.properties,
 * which is gitignored).
 */
const { AndroidConfig, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const TUNING = {
  "org.gradle.jvmargs":
    "-Xmx768m -XX:MaxMetaspaceSize=256m -Dkotlin.daemon.jvm.options=-Xmx384m",
  "org.gradle.daemon": "false",
};

const NODE_EXEC_ARGS_LINE =
  '    nodeExecutableAndArgs = ["node", "--max-old-space-size=768"]';

function applyTuning(contents) {
  let lines = contents.split("\n");
  let changed = false;
  for (const [key, value] of Object.entries(TUNING)) {
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (idx >= 0) {
      if (lines[idx] !== `${key}=${value}`) {
        lines[idx] = `${key}=${value}`;
        changed = true;
      }
    } else {
      lines.push(`${key}=${value}`);
      changed = true;
    }
  }
  return { contents: lines.join("\n"), changed };
}

function patchBuildGradle(buildGradlePath) {
  const raw = fs.readFileSync(buildGradlePath, "utf-8");
  if (/^[ \t]*nodeExecutableAndArgs\s*=\s*\[/m.test(raw)) {
    return raw;
  }
  const anchor = "autolinkLibrariesWithApp()";
  const idx = raw.indexOf(anchor);
  if (idx < 0) {
    return raw;
  }
  return raw.slice(0, idx) + NODE_EXEC_ARGS_LINE + "\n    " + raw.slice(idx);
}

module.exports = function withGradleMemory(config) {
  return withDangerousMod(config, [
    "android",
    async (mod) => {
      const gradlePropsPath = path.join(
        mod.modRequest.platformProjectRoot,
        "gradle.properties"
      );
      if (fs.existsSync(gradlePropsPath)) {
        const raw = fs.readFileSync(gradlePropsPath, "utf-8");
        const { contents, changed } = applyTuning(raw);
        if (changed) {
          fs.writeFileSync(gradlePropsPath, contents);
        }
      }
      const buildGradlePath = path.join(
        mod.modRequest.platformProjectRoot,
        "app",
        "build.gradle"
      );
      if (fs.existsSync(buildGradlePath)) {
        fs.writeFileSync(buildGradlePath, patchBuildGradle(buildGradlePath));
      }
      return mod;
    },
  ]);
};
