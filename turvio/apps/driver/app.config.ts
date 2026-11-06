import type { ExpoConfig } from "expo/config";

// Secrets come from the environment (.env / EAS environment variables) – never hard-code keys.
const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

/**
 * Build variants (APP_VARIANT, set per EAS build profile in eas.json):
 * - development: dev client (Metro), separate app id so it installs next to the others
 * - preview:     self-contained internal test build (staging API)
 * - production:  store build
 * EXPO_PUBLIC_API_URL is baked into the JS bundle per profile (not a secret).
 */
const EAS_PROJECT_ID = "9ebfcd40-ab6a-4bff-90aa-3f02f9101d22";
const variant = (process.env.APP_VARIANT ?? "production") as "development" | "preview" | "production";
const ID = "com.lunapact.turvio.driver";
const appId = variant === "production" ? ID : `${ID}.${variant === "development" ? "dev" : "preview"}`;
const appName = variant === "production" ? "TURVIO Driver" : variant === "development" ? "TURVIO Driver (Dev)" : "TURVIO Driver (Test)";

const config: ExpoConfig = {
  name: appName,
  slug: "turvio-driver",
  owner: "lunapact-technologies",
  scheme: variant === "production" ? "turvio" : `turvio-${variant}`,
  version: "0.1.0",
  runtimeVersion: { policy: "appVersion" },
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    // Publisher: Lunapact Technologies (UAE). Confirm IDs before the first store submission.
    bundleIdentifier: appId,
    infoPlist: {
      // Lets the app hand navigation to Google Maps / Waze when they are installed.
      LSApplicationQueriesSchemes: ["comgooglemaps", "waze"],
    },
  },
  android: {
    package: appId,
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    // Only what the driver features need; no background location, no microphone.
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
    ],
  },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 160, resizeMode: "contain", backgroundColor: "#FFFFFF", dark: { backgroundColor: "#060B16" } }],
    "expo-system-ui",
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
    variant,
    // EAS project lunapact-technologies/turvio-driver (registered with `eas init`). Not a secret.
    eas: { projectId: EAS_PROJECT_ID },
  },
};

export default config;
