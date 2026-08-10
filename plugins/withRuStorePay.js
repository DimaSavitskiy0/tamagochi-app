const {
  withAndroidManifest,
  withMainActivity,
  withMainApplication,
  withAppBuildGradle,
  withProjectBuildGradle,
  withStringsXml,
} = require('@expo/config-plugins');

// Applies the manual "Подготовка к работе" steps from RuStore's Pay SDK React Native
// docs (rustore.ru/help/sdk/pay/react-native/10-3-1) as an Expo config plugin, instead
// of hand-editing the generated android/ folder (which is gitignored and gets
// regenerated fresh by every `expo prebuild`/EAS Build — hand edits there would
// silently vanish on the next build). See lib/rustorePay.ts (JS side) and
// server/README.md §3 (server side + RuStore Console setup) for the rest of the story.
//
// [ЧЕРНОВИК] CONSOLE_APPLICATION_ID stays a placeholder until the app is uploaded to
// RuStore Console — see strings.xml mod below.

const RUSTORE_MAVEN_URL = 'https://nexus-external.vkteam.ru/repository/maven-rustore-exposed/';
const RUSTORE_PAY_DEPENDENCY = 'ru.rustore.sdk-wrapper.react-native:pay:10.3.1';
const PAY_ACTIVITY_NAME = 'ru.rustore.sdk.pay.internal.presentation.ui.PayActivity';
const CONSOLE_APP_ID_PLACEHOLDER = 'REPLACE_WITH_RUSTORE_CONSOLE_APP_ID';

function withRuStorePayProjectGradle(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withRuStorePay: expected a Groovy android/build.gradle');
    }
    if (!config.modResults.contents.includes(RUSTORE_MAVEN_URL)) {
      config.modResults.contents = config.modResults.contents.replace(
        /allprojects\s*{\s*repositories\s*{/,
        (match) => `${match}\n    maven { url '${RUSTORE_MAVEN_URL}' } // RuStore Pay SDK`
      );
    }
    return config;
  });
}

function withRuStorePayAppGradle(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withRuStorePay: expected a Groovy android/app/build.gradle');
    }
    if (!config.modResults.contents.includes(RUSTORE_PAY_DEPENDENCY)) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*{/,
        (match) => `${match}\n    implementation("${RUSTORE_PAY_DEPENDENCY}") // RuStore Pay SDK`
      );
    }
    return config;
  });
}

function withRuStorePayManifest(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];

    app.activity = app.activity || [];
    if (!app.activity.some((a) => a.$['android:name'] === PAY_ACTIVITY_NAME)) {
      app.activity.push({
        $: {
          'android:name': PAY_ACTIVITY_NAME,
          'android:exported': 'false',
          'android:launchMode': 'singleTask',
          'tools:replace': 'android:launchMode',
        },
      });
    }

    app['meta-data'] = app['meta-data'] || [];
    const addMetaData = (name, value) => {
      if (!app['meta-data'].some((m) => m.$['android:name'] === name)) {
        app['meta-data'].push({ $: { 'android:name': name, 'android:value': value } });
      }
    };
    // Must match app.json's top-level "scheme" — the same value the app's own
    // intent-filter already registers, so bank-app (СБП/SberPay) redirects land here.
    addMetaData('sdk_pay_scheme_value', config.scheme || '');
    addMetaData('console_app_id_value', '@string/CONSOLE_APPLICATION_ID');

    return config;
  });
}

function withRuStorePayMainApplication(config) {
  return withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withRuStorePay: expected Kotlin MainApplication.kt (Expo default)');
    }
    let contents = config.modResults.contents;
    if (!contents.includes('RuStoreReactPayPackage')) {
      contents = contents.replace(
        /(import expo\.modules\.ExpoReactHostFactory)/,
        `$1\n\nimport ru.rustore.react.pay.RuStoreReactPayPackage`
      );
      contents = contents.replace(
        /(PackageList\(this\)\.packages\.apply\s*{)/,
        `$1\n          // RuStore Pay SDK — see lib/rustorePay.ts\n          add(RuStoreReactPayPackage())`
      );
    }
    config.modResults.contents = contents;
    return config;
  });
}

function withRuStorePayMainActivity(config) {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withRuStorePay: expected Kotlin MainActivity.kt (Expo default)');
    }
    let contents = config.modResults.contents;
    if (!contents.includes('RuStoreReactPayModule')) {
      contents = contents.replace(
        /(import expo\.modules\.ReactActivityDelegateWrapper)/,
        `$1\n\nimport android.content.Intent\nimport ru.rustore.react.pay.RuStoreReactPayModule`
      );
      // Forward the launch intent too (not just onNewIntent) — Expo always calls
      // super.onCreate(null), so gate on the real savedInstanceState parameter instead.
      contents = contents.replace(
        /(super\.onCreate\(null\)\n)/,
        `$1    // RuStore Pay SDK: a bank-app (СБП/SberPay) return via deeplink can relaunch\n    // this singleTask activity fresh, not just deliver onNewIntent.\n    if (savedInstanceState == null) {\n      intent?.let { RuStoreReactPayModule.processIntent(it) }\n    }\n`
      );
      // Append onNewIntent override right before the class's final closing brace.
      contents = contents.replace(
        /\n}\s*$/,
        `\n  override fun onNewIntent(intent: Intent) {\n    super.onNewIntent(intent)\n    // RuStore Pay SDK — see lib/rustorePay.ts and server/README.md §3.\n    intent.let { RuStoreReactPayModule.processIntent(it) }\n  }\n}\n`
      );
    }
    config.modResults.contents = contents;
    return config;
  });
}

function withRuStorePayStrings(config) {
  return withStringsXml(config, (config) => {
    const strings = config.modResults.resources.string || [];
    if (!strings.some((s) => s.$.name === 'CONSOLE_APPLICATION_ID')) {
      strings.push({ $: { name: 'CONSOLE_APPLICATION_ID' }, _: CONSOLE_APP_ID_PLACEHOLDER });
    }
    config.modResults.resources.string = strings;
    return config;
  });
}

module.exports = function withRuStorePay(config) {
  config = withRuStorePayProjectGradle(config);
  config = withRuStorePayAppGradle(config);
  config = withRuStorePayManifest(config);
  config = withRuStorePayMainApplication(config);
  config = withRuStorePayMainActivity(config);
  config = withRuStorePayStrings(config);
  return config;
};
