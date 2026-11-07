// Local release builds: sign with the dedicated TURVIO keystore (the one stored in EAS
// credentials) when it is provided through the environment, otherwise keep the template's
// debug signing. EAS cloud builds inject their own signing and are not affected.
//
//   TURVIO_ANDROID_KEYSTORE=/abs/path/turvio-preview.jks
//   TURVIO_ANDROID_KEYSTORE_PASSWORD=...        (store and key password)
//   TURVIO_ANDROID_KEY_ALIAS=turvio-preview      (optional)
//
// Nothing secret is written into the project: build.gradle reads the values at build time.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// turvio-release-signing";

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARKER)) return cfg;
    src = src.replace(
      /signingConfigs \{\n(\s*)debug \{/,
      (m, indent) =>
        `signingConfigs {\n${indent}${MARKER}\n${indent}release {\n` +
        `${indent}    def ks = System.getenv('TURVIO_ANDROID_KEYSTORE')\n` +
        `${indent}    if (ks) {\n` +
        `${indent}        storeFile file(ks)\n` +
        `${indent}        storePassword System.getenv('TURVIO_ANDROID_KEYSTORE_PASSWORD')\n` +
        `${indent}        keyAlias System.getenv('TURVIO_ANDROID_KEY_ALIAS') ?: 'turvio-preview'\n` +
        `${indent}        keyPassword System.getenv('TURVIO_ANDROID_KEYSTORE_PASSWORD')\n` +
        `${indent}    }\n${indent}}\n${indent}debug {`,
    );
    src = src.replace(
      /(release \{\n\s*\/\/ Caution![^\n]*\n\s*\/\/ see [^\n]*\n\s*)signingConfig signingConfigs\.debug/,
      "$1signingConfig System.getenv('TURVIO_ANDROID_KEYSTORE') ? signingConfigs.release : signingConfigs.debug",
    );
    cfg.modResults.contents = src;
    return cfg;
  });
};
