/**
 * Google Play wants the privacy policy reachable inside the app, not only in
 * the store listing. The policy is PRIVACY.md on the public GitHub mirror,
 * because git.schnau.dev is only reachable on the Tailnet.
 */
import { Linking, Pressable, StyleSheet, Text } from "react-native";

import { theme } from "./theme";

export const PRIVACY_URL = "https://github.com/HaukeSchnau/schnipsel/blob/main/PRIVACY.md";

export function PrivacyLink() {
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={12}
      onPress={() => {
        Linking.openURL(PRIVACY_URL).catch(() => {});
      }}
      style={({ pressed }) => pressed && { opacity: 0.6 }}
    >
      <Text style={styles.label}>Datenschutz</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.textDim, fontSize: 13, fontWeight: "600" },
});
