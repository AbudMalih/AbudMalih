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
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    // Publisher: Lunapact Technologies (UAE). Confirm IDs before the first store submission.
    bundleIdentifier: "com.lunapact.turvio.driver",
    infoPlist: {
      // Lets the app hand navigation to Google Maps / Waze when they are installed.
      LSApplicationQueriesSchemes: ["comgooglemaps", "waze"],
    },
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
    // Only what the driver features need; no background location, no microphone.
    blockedPermissions: ["android.permission.RECORD_AUDIO", "android.permission.ACCESS_BACKGROUND_LOCATION"],
  },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    "expo-localization",
    [
      "expo-camera",
      {
        cameraPermission: "TURVIO uses the camera to scan parcel barcodes, read parcel labels and take delivery photos.",
        recordAudioAndroid: false,
        microphonePermission: false,
        barcodeScannerEnabled: true,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission: "TURVIO shows your position on the route map and, if your company enabled it, stores it with proof of delivery. It is not tracked in the background.",
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      "expo-image-picker",
      {
        cameraPermission: "TURVIO uses the camera to take delivery photos and photos of parcel labels.",
        photosPermission: false,
        microphonePermission: false,
      },
    ],
    // Google Maps on Android needs a key in development/production builds.
    // iOS uses Apple Maps by default and needs no key.
    ["react-native-maps", androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}],
  ],
  extra: {
    supportsRTL: true,
  },
};

export default config;
