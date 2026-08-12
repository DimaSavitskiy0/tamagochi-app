const { withAndroidManifest, withProjectBuildGradle } = require('@expo/config-plugins');

// Applies RuStore's Push SDK React Native setup (rustore.ru/help/sdk/push-notifications/
// react/2-1-1) as a config plugin — same reasoning as plugins/withRuStorePay.js: the
// generated android/ folder is gitignored and rebuilt fresh by every
// `expo prebuild`/EAS Build, so hand edits there would silently vanish.
//
// Unlike Pay SDK, the Push SDK's React Native package registers itself via normal RN
// autolinking (no manual MainApplication/MainActivity edits documented) — this plugin
// only needs to add the Maven repo (for the underlying native ru.rustore.sdk:pushclient
// dependency to resolve) and the required AndroidManifest meta-data.
//
// projectId: pass via app.json plugin config, e.g.
//   ["./plugins/withRuStorePush", { "projectId": "i5UTx96jw6c1C9LvdlE4cdNrWHMNyRBt" }]
// — from RuStore Console → your app → Push-уведомления → Проекты → "ID проекта".
// [ЧЕРНОВИК] Falls back to a placeholder if omitted — push registration will fail
// until a real project is created in Console and the id is passed here.

const RUSTORE_PUSH_MAVEN_URL = 'https://artifactory-external.vkpartner.ru/artifactory/maven';
const PROJECT_ID_PLACEHOLDER = 'REPLACE_WITH_RUSTORE_PUSH_PROJECT_ID';

function withRuStorePushProjectGradle(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withRuStorePush: expected a Groovy android/build.gradle');
    }
    if (!config.modResults.contents.includes(RUSTORE_PUSH_MAVEN_URL)) {
      config.modResults.contents = config.modResults.contents.replace(
        /allprojects\s*{\s*repositories\s*{/,
        (match) => `${match}\n    maven { url '${RUSTORE_PUSH_MAVEN_URL}' } // RuStore Push SDK`
      );
    }
    return config;
  });
}

function withRuStorePushManifest(config, projectId) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    app['meta-data'] = app['meta-data'] || [];

    const setMetaData = (name, value) => {
      app['meta-data'] = app['meta-data'].filter((m) => m.$['android:name'] !== name);
      app['meta-data'].push({ $: { 'android:name': name, 'android:value': value } });
    };

    // Required — id of the "Push notifications project" created in RuStore Console for
    // this app. See rustore.ru/help/sdk/push-notifications/react/2-1-1#инициализация.
    setMetaData('ru.rustore.sdk.pushclient.project_id', projectId || PROJECT_ID_PLACEHOLDER);

    return config;
  });
}

module.exports = function withRuStorePush(config, { projectId } = {}) {
  config = withRuStorePushProjectGradle(config);
  config = withRuStorePushManifest(config, projectId);
  return config;
};
