/**
 * Choosing the photos.
 *
 * The system photo picker does the choosing, so the app only ever sees the
 * photos the user hands it and needs no access to the library. Layouts fill
 * their slots in the order photos were tapped; the picker numbers its picks
 * where Android supports ordered selection, and elsewhere a long press in the
 * editor swaps any two photos.
 */
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { launchImageLibraryAsync } from "expo-image-picker";

import { importPhotos } from "../photos/import";
import type { Photo } from "../model/collage";
import { Button } from "../ui/controls";
import { PrivacyLink } from "../ui/PrivacyLink";
import { theme } from "../ui/theme";

/** Above this the layout generator falls back to a plain grid, so we stop here. */
const MAX_SELECTION = 9;

export function PickerScreen({
  onDone,
  onCancel,
}: {
  onDone: (photos: Photo[]) => void;
  onCancel?: () => void;
}) {
  const [importing, setImporting] = useState(false);

  const pick = useCallback(async () => {
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: "images",
        allowsMultipleSelection: true,
        selectionLimit: MAX_SELECTION,
        orderedSelection: true,
        // Copied as-is; the import downscales and drops the metadata.
        quality: 1,
      });

      if (result.canceled || result.assets.length === 0) return;
      setImporting(true);
      onDone(
        await importPhotos(
          result.assets.map((asset) => ({
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
          })),
        ),
      );
    } catch (error) {
      Alert.alert("Das hat nicht geklappt", String(error));
    } finally {
      setImporting(false);
    }
  }, [onDone]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Schnipsel</Text>
        <PrivacyLink />
      </View>

      <View style={styles.centered}>
        <Text style={styles.explain}>Wähle bis zu neun Fotos für deine Collage.</Text>
        <Button
          label={importing ? "Lädt …" : "Fotos auswählen"}
          tone="primary"
          onPress={importing ? () => {} : pick}
        />
      </View>

      {onCancel ? (
        <View style={styles.footer}>
          <Button label="Zurück" tone="quiet" onPress={onCancel} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { color: theme.text, fontSize: 26, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  explain: { color: theme.textDim, fontSize: 15, textAlign: "center", lineHeight: 22 },
  footer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.surface,
  },
});
