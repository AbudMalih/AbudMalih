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
  version: "0.2.0",
  runtimeVersion: { policy: "appVersion" },
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    // Publisher: Lunapact Technologies (UAE). Confirm IDs before the first store submission.
    bundleIdentifier: appId,
    // Test builds (TestFlight): only standard HTTPS/TLS encryption (exempt), so App Store Connect
    // does not ask the export-compliance question for every build. Production: set when its
    // store release is prepared.
    ...(variant !== "production" ? { config: { usesNonExemptEncryption: false } } : {}),
    infoPlist: {
      // Lets the app hand navigation to Google Maps / Waze when they are installed.
      LSApplicationQueriesSchemes: ["comgooglemaps", "waze"],
    },
  },
  android: {
    package: appId,
    // Increase with every APK handed out, so phones install it as an update (same signing key keeps the app's data).
    versionCode: 2,
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    // Only what the driver features need; no microphone. Background location exists only for
    // live tour tracking: it is used while a tour is being driven, when the company switched
    // tracking on and the driver acknowledged the notice (docs/LIVE_TRACKING.md).
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
      // Screenshots/photos come only through the system photo picker (or a share from another
      // app): no broad gallery or storage access.
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
    ],
  },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    "./plugins/withReleaseSigning",
    "./plugins/withUniqueAppGroups",
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
        locationWhenInUsePermission: "TURVIO shows your position on the route map and, if your company enabled it, stores it with proof of delivery.",
        // Live tour tracking only: while you drive a tour, if your company switched it on and you
        // acknowledged the notice. Never outside a tour; the status bar shows when it is active.
        locationAlwaysAndWhenInUsePermission:
          "While you drive a tour, TURVIO shares your position with your dispatch team – also with the screen locked – if your company switched live tracking on. It stops when the tour is paused or finished.",
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
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
    // Release builds are minified with R8 (full mode). react-native-maps pulls in WorkManager
    // 2.9.1 -> Room 2.5.0, whose consumer rule keeps RoomDatabase subclasses without members:
    // R8 then removed WorkDatabase_Impl's constructor and the app crashed at start-up
    // ("Failed to create an instance of class androidx.work.impl.WorkDatabase"). Room 2.6+
    // ships this exact rule; add it until the dependency chain is updated.
    [
      "expo-build-properties",
      {
        android: {
          extraProguardRules: "-keep class * extends androidx.room.RoomDatabase { <init>(); }",
        },
      },
    ],
    // Share into TURVIO from WhatsApp, Gallery, Messages … (text and up to 10 images).
    // iOS: a Share Extension target + App Group; Android: SEND / SEND_MULTIPLE intent filters.
    [
      "expo-share-intent",
      {
        iosActivationRules: { NSExtensionActivationSupportsText: true, NSExtensionActivationSupportsImageWithMaxCount: 10 },
        iosShareExtensionName: variant === "production" ? "TURVIO" : variant === "development" ? "TURVIO Dev" : "TURVIO Test",
        iosAppGroupIdentifier: `group.${appId}`,
        androidIntentFilters: ["text/*", "image/*"],
        androidMultiIntentFilters: ["image/*"],
      },
    ],
    // Google Maps on Android needs a key in development/production builds.
    // iOS uses Apple Maps by default and needs no key.
    ["react-native-maps", androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}],
  ],
  extra: {
    supportsRTL: true,
    variant,
    // Google Maps on Android crashes the app if a map is created without an API key, so the
    // app only renders maps when a key was built in (the value itself is not exposed here).
    googleMapsAndroid: !!androidGoogleMapsApiKey,
    // EAS project lunapact-technologies/turvio-driver (registered with `eas init`). Not a secret.
    eas: { projectId: EAS_PROJECT_ID },
  },
};

export default config;
