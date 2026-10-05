/**
 * Dynamic layer over app.json. Adds native config that depends on
 * credentials only when the matching env var exists, so every build works
 * before Google / Firebase are set up (those features stay hidden).
 *
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID  → Google Sign-In URL scheme on iOS
 *   GOOGLE_SERVICES_JSON              → Firebase config for Android push (EAS file variable)
 */
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (iosClientId) {
    // Reversed client ID, e.g. com.googleusercontent.apps.1234-abcd
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
    config.plugins = [...config.plugins, ['@react-native-google-signin/google-signin', { iosUrlScheme }]];
  }
  if (process.env.GOOGLE_SERVICES_JSON) {
    config.android = { ...config.android, googleServicesFile: process.env.GOOGLE_SERVICES_JSON };
  }
  return config;
};
