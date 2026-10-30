import type { ExpoConfig } from "expo/config";

// Secrets come from the environment (.env / EAS secrets) – never hard-code keys.
const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

const config: ExpoConfig = {
  name: "TURVIO Driver",
  slug: "turvio-driver",
  scheme: "turvio",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: false,
    // Publisher: Lunapact Technologies (UAE). Confirm IDs before the first store submission.
    bundleIdentifier: "com.lunapact.turvio.driver",
  },
  android: {
    package: "com.lunapact.turvio.driver",
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    "expo-localization",
    // Google Maps on Android needs a key in development/production builds.
    // iOS uses Apple Maps by default and needs no key.
    ["react-native-maps", androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}],
  ],
  extra: {
    supportsRTL: true,
  },
};

export default config;
