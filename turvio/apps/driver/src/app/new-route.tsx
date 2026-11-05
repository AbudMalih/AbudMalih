import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { Button, Field, Screen } from "../components/ui";
import { todayIso } from "../lib/format";
import { feedback } from "../lib/haptics";
import { useT } from "../lib/i18n";
import { useTourStore } from "../store/tourStore";
import { type as ty, useTheme } from "../theme";

/** Personal route: the driver plans their own stops (visible to the depot's dispatch). */
export default function NewRoute() {
  const t = useT();
  const { c } = useTheme();
  const createRoute = useTourStore((s) => s.createRoute);
  const [date, setDate] = useState(todayIso());
  const [name, setName] = useState(t("route.defaultName", { date: todayIso() }));
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
  return (
    <Screen testID="new-route">
      <Text style={[ty.small, { color: c.textMuted }]}>{t("home.noRoutesText")}</Text>
      <Field label={t("route.name")} value={name} onChangeText={setName} maxLength={120} testID="route-name" />
      <Field label={t("route.date")} value={date} onChangeText={setDate} error={validDate ? null : " "} testID="route-date" />
      <Button
        label={t("route.create")}
        size="lg"
        icon="add"
        disabled={!name.trim() || !validDate}
        onPress={() => {
          createRoute(name, date);
          feedback.success();
          router.back();
        }}
        testID="route-create"
      />
    </Screen>
  );
}
