const fs = require('fs');
const path = require('path');
const {
  createRunOncePlugin,
  withAppBuildGradle,
  withDangerousMod,
  withGradleProperties,
  withProjectBuildGradle,
} = require('expo/config-plugins');

const PACKAGE_NAME = 'withAndroidRelease';
const PACKAGE_VERSION = '2.0.0';

const CREDENTIALS_REL = 'credentials/android';
const KEYSTORE_FILE = 'release.keystore';
const KEYSTORE_PROPS = 'keystore.properties';
/** APK base name: <APP_PREFIX>-v{version}-{abi}-release.apk */
const APP_PREFIX = 'yummy';

const SPLITS_START = '// @generated begin release-abi-splits';
const SPLITS_END = '// @generated end release-abi-splits';
const ARCHIVES_START = '// @generated begin release-archives-name';
const ARCHIVES_END = '// @generated end release-archives-name';
const NDK_FORCE_START = '// @generated begin release-force-ndk';
const NDK_FORCE_END = '// @generated end release-force-ndk';

function withAndroidRelease(config) {
  config = withAssertReleaseCredentials(config);
  config = withReleaseSigningAndSplits(config);
  config = withReleaseGradleProperties(config);
  config = withForceNdkVersion(config);
  return config;
}

function withAssertReleaseCredentials(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const credDir = path.join(projectRoot, ...CREDENTIALS_REL.split('/'));
      const appDir = path.join(config.modRequest.platformProjectRoot, 'app');

      for (const name of [KEYSTORE_FILE, KEYSTORE_PROPS]) {
        const leftover = path.join(appDir, name);
        if (fs.existsSync(leftover)) {
          fs.unlinkSync(leftover);
          console.warn(`[${PACKAGE_NAME}] Removed leftover android/app/${name}`);
        }
      }

      if (
        !fs.existsSync(path.join(credDir, KEYSTORE_FILE)) ||
        !fs.existsSync(path.join(credDir, KEYSTORE_PROPS))
      ) {
        console.warn(
          `[${PACKAGE_NAME}] Missing ${CREDENTIALS_REL}/${KEYSTORE_FILE} and/or ${KEYSTORE_PROPS}`
        );
      }
      return config;
    },
  ]);
}

function withReleaseGradleProperties(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;
    const setProp = (key, value) => {
      const idx = props.findIndex((i) => i.type === 'property' && i.key === key);
      if (idx >= 0) props[idx].value = value;
      else props.push({ type: 'property', key, value });
    };
    setProp('android.enableMinifyInReleaseBuilds', 'true');
    setProp('android.enableShrinkResourcesInReleaseBuilds', 'true');
    setProp('android.builder.sdkDownload', 'false');
    return config;
  });
}

function withForceNdkVersion(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = stripGeneratedBlock(
      config.modResults.contents,
      NDK_FORCE_START,
      NDK_FORCE_END
    );
    const block = `
${NDK_FORCE_START}
subprojects { subproject ->
    def pinNdk = {
        if (rootProject.hasProperty("ndkVersion") && rootProject.ext.ndkVersion != null) {
            subproject.android.ndkVersion rootProject.ext.ndkVersion
        }
    }
    subproject.pluginManager.withPlugin("com.android.library", pinNdk)
    subproject.pluginManager.withPlugin("com.android.application", pinNdk)
}
${NDK_FORCE_END}
`;
    config.modResults.contents = contents.trimEnd() + '\n' + block;
    return config;
  });
}

function withReleaseSigningAndSplits(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    contents = patchReleaseSigning(contents);
    contents = ensureAbiSplits(contents);
    contents = ensureArchivesName(contents);
    config.modResults.contents = contents;
    return config;
  });
}

const RELEASE_SIGNING_CONFIG = `release {
            def credDir = rootProject.file("../${CREDENTIALS_REL}")
            def keystorePropertiesFile = new File(credDir, "${KEYSTORE_PROPS}")
            if (keystorePropertiesFile.exists()) {
                def keystoreProperties = new Properties()
                keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
                storeFile new File(credDir, keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }`;

function patchReleaseSigning(contents) {
  if (contents.includes(`../${CREDENTIALS_REL}`)) {
    return ensureReleaseUsesReleaseSigning(contents);
  }

  const legacy = new RegExp(
    String.raw`release\s*\{\s*if\s*\(project\.hasProperty\('RELEASE_STORE_FILE'\)\)\s*\{[\s\S]*?\}\s*\}`
  );
  if (legacy.test(contents)) {
    return ensureReleaseUsesReleaseSigning(contents.replace(legacy, RELEASE_SIGNING_CONFIG));
  }

  const debugKey = 'signingConfigs {';
  const debugIdx = contents.indexOf(debugKey);
  if (debugIdx === -1) return contents;

  const afterDebug = contents.indexOf('debug {', debugIdx);
  if (afterDebug === -1) return contents;

  let i = contents.indexOf('{', afterDebug);
  let depth = 0;
  for (; i < contents.length; i++) {
    if (contents[i] === '{') depth++;
    else if (contents[i] === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  let j = i;
  while (j < contents.length && /\s/.test(contents[j])) j++;
  if (contents[j] !== '}') return contents;

  contents =
    contents.slice(0, i) + `\n        ${RELEASE_SIGNING_CONFIG}\n` + contents.slice(i);
  return ensureReleaseUsesReleaseSigning(contents);
}

function ensureReleaseUsesReleaseSigning(contents) {
  return contents.replace(
    /(release\s*\{\s*\/\/ Caution![\s\S]*?)signingConfig\s+signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release'
  );
}

function ensureAbiSplits(contents) {
  contents = stripGeneratedBlock(contents, SPLITS_START, SPLITS_END);
  const block = `
    ${SPLITS_START}
    splits {
        abi {
            reset()
            enable true
            universalApk true
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }
    }
    ${SPLITS_END}
`;
  return contents.replace(/namespace\s+'[^']+'\s*\n/, (m) => `${m}${block}`);
}

function ensureArchivesName(contents) {
  contents = stripGeneratedBlock(contents, ARCHIVES_START, ARCHIVES_END);
  const block = `
    ${ARCHIVES_START}
    base {
        archivesName = "${APP_PREFIX}-v\${defaultConfig.versionName}"
    }
    ${ARCHIVES_END}
`;
  return contents.replace(/defaultConfig\s*\{[\s\S]*?\n    \}/, (m) => `${m}\n${block}`);
}

function stripGeneratedBlock(contents, startMarker, endMarker) {
  const start = contents.indexOf(startMarker);
  if (start === -1) return contents;
  const end = contents.indexOf(endMarker);
  if (end === -1) return contents;
  let sliceEnd = end + endMarker.length;
  while (sliceEnd < contents.length && (contents[sliceEnd] === '\n' || contents[sliceEnd] === '\r')) {
    sliceEnd++;
  }
  return contents.slice(0, start) + contents.slice(sliceEnd);
}

module.exports = createRunOncePlugin(withAndroidRelease, PACKAGE_NAME, PACKAGE_VERSION);
