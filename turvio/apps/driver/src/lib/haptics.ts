import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/** Short, distinct feedback patterns (no-ops where the device has no haptics). */
export const feedback = {
  success: () => Platform.OS !== "web" && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  warning: () => Platform.OS !== "web" && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined),
  error: () => Platform.OS !== "web" && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined),
  tap: () => Platform.OS !== "web" && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
};
