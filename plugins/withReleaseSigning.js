const { withAppBuildGradle } = require('@expo/config-plugins');

// Release signing for real (RuStore-bound) Android builds — same idea as Family
// Navigator's android/key.properties gate (`hasReleaseSigning`), adapted for Expo's
// Continuous Native Generation: android/ is gitignored and rebuilt fresh by every
// `expo prebuild`, so a key.properties file placed inside android/ would vanish on the
// next prebuild. Reading straight from environment variables at Gradle-eval time avoids
// needing an extra "restore this file before building" step.
//
// Without LAPGO_KEYSTORE_PATH set (e.g. plain `expo run:android` locally), Expo's
// default debug signing is used, same as always — this plugin is a no-op then.
//
// In CI (see codemagic.yaml): decode the keystore to a file, export
// LAPGO_KEYSTORE_PATH / LAPGO_KEYSTORE_PASSWORD / LAPGO_KEY_ALIAS, then
// `expo prebuild -p android` + gradle bundleRelease picks this up automatically.

const MARKER = '// LapGo release signing (plugins/withReleaseSigning.js)';

function withReleaseSigningAppGradle(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning: expected a Groovy android/app/build.gradle');
    }
    let contents = config.modResults.contents;
    if (contents.includes(MARKER)) return config;

    contents = contents.replace(
      /^(android\s*{)/m,
      `$1\n    ${MARKER}\n    def lapgoKeystorePath = System.getenv("LAPGO_KEYSTORE_PATH")\n    def lapgoHasReleaseSigning = lapgoKeystorePath != null && new File(lapgoKeystorePath).exists()\n`
    );

    contents = contents.replace(
      /(signingConfigs\s*{)/,
      `$1\n        if (lapgoHasReleaseSigning) {\n            release {\n                storeFile file(lapgoKeystorePath)\n                storePassword System.getenv("LAPGO_KEYSTORE_PASSWORD")\n                keyAlias System.getenv("LAPGO_KEY_ALIAS")\n                keyPassword System.getenv("LAPGO_KEYSTORE_PASSWORD") // PKCS12 — same as store password, see scripts/README.md\n            }\n        }`
    );

    // Expo's default release buildType points at signingConfigs.debug so
    // `./gradlew assembleRelease` works out of the box without any signing setup —
    // swap that to the real key only when one was actually provided.
    contents = contents.replace(
      /(release\s*{[^}]*?)signingConfig\s+signingConfigs\.debug/,
      `$1signingConfig lapgoHasReleaseSigning ? signingConfigs.release : signingConfigs.debug`
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withReleaseSigning(config) {
  return withReleaseSigningAppGradle(config);
};
