/**
 * Config plugin: adopt the UIKit scene-based life cycle on iOS.
 *
 * iOS 27 asserts at launch (`_UIAssertForNoSceneLifecycleEnabled`) unless the
 * app declares a scene delegate. Expo SDK 57 ships `ExpoAppSceneDelegate`
 * (exported to Objective-C as `EXExpoAppSceneDelegate`), but its prebuild
 * template doesn't opt in yet. This plugin does, at prebuild time:
 *   1. Info.plist: a scene manifest pointing at EXExpoAppSceneDelegate.
 *   2. AppDelegate.swift: conform to ExpoReactNativeFactoryProvider and stop
 *      creating the window there; the scene delegate creates it and starts
 *      React Native into it (it also forwards links and lifecycle events).
 * Remove this plugin once Expo's template adopts scenes on its own.
 */
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const SCENE_DELEGATE = 'EXExpoAppSceneDelegate';

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: SCENE_DELEGATE },
        ],
      },
    };
    return cfg;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
    }
    let src = cfg.modResults.contents;

    // 1. Let the scene delegate fetch the React Native factory from the app delegate.
    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      src = src.replace(/class AppDelegate: ExpoAppDelegate\s*\{/, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    }

    // 2. Drop the template's window + startReactNative block; the scene delegate does it.
    src = src.replace(
      /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\([\s\S]*?\)\s*#endif\s*/,
      '    // Window + React Native start live in ExpoAppSceneDelegate (scene life cycle, see plugins/withSceneLifecycle.js).\n\n    ',
    );

    if (!src.includes('ExpoReactNativeFactoryProvider') || src.includes('UIWindow(frame: UIScreen.main.bounds)')) {
      throw new Error('withSceneLifecycle: AppDelegate.swift no longer matches the expected template; update the plugin.');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = (config) => withSceneAppDelegate(withSceneManifest(config));
