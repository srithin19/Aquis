/**
 * Build-time config on top of app.json.
 *
 * Google Sign-In's native plugin needs the iOS URL scheme, which is derived
 * from the iOS OAuth client ID. It is only added when that ID is set (in .env),
 * so the app still builds and runs — without Google — before the IDs exist.
 * See README → "Google sign-in".
 */

const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** "123-abc.apps.googleusercontent.com" → "com.googleusercontent.apps.123-abc" */
function iosUrlScheme(clientId) {
  const prefix = clientId.replace(/\.apps\.googleusercontent\.com$/, '');
  return `com.googleusercontent.apps.${prefix}`;
}

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ...(IOS_CLIENT_ID
      ? [['@react-native-google-signin/google-signin', { iosUrlScheme: iosUrlScheme(IOS_CLIENT_ID) }]]
      : []),
  ],
});
