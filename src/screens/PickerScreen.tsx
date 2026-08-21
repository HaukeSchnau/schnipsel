/**
 * Choosing the photos.
 *
 * Numbered badges instead of checkmarks, because layouts fill their slots in
 * the order photos were tapped — if that order is invisible, the layout looks
 * like it happens at random. The date chips exist because a collage is usually
 * about one afternoon, and scrolling back through a camera roll to find it is
 * the slowest part of the whole job.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import {
  AssetField,
  MediaType,
  Query,
  usePermissions,
  type AssetMetadata,
} from 'expo-media-library';

import { importPhotos } from '../photos/import';
import type { Photo } from '../model/collage';
import { Button, Chip } from '../ui/controls';
import { theme } from '../ui/theme';

const COLUMNS = 3;
const PAGE = 120;
/** Above this the layout generator falls back to a plain grid, so we stop here. */
const MAX_SELECTION = 9;

type Range = 'all' | 'today' | 'week';

const RANGE_LABELS: Record<Range, string> = {
  all: 'Alle',
  today: 'Heute',
  week: 'Diese Woche',
};

function since(range: Range): number | null {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return now.getTime() - 7 * 24 * 60 * 60 * 1000;
}

export function PickerScreen({
  onDone,
  onCancel,
}: {
  onDone: (photos: Photo[]) => void;
  onCancel?: () => void;
}) {
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['photo'] });
  const [range, setRange] = useState<Range>('all');
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - 2 * (COLUMNS - 1)) / COLUMNS);

  const fetchPage = useCallback(
    async (offset: number, currentRange: Range) => {
      let query = new Query()
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
        .limit(PAGE)
        .offset(offset);
      const from = since(currentRange);
      if (from !== null) query = query.gte(AssetField.CREATION_TIME, from);

      const page = await query.exeForMetadata();
      setExhausted(page.length < PAGE);
      setAssets((current) => (offset === 0 ? page : [...current, ...page]));
    },
    []
  );

  useEffect(() => {
    if (permission?.granted) {
      setAssets([]);
      setExhausted(false);
      fetchPage(0, range).catch(() => setExhausted(true));
    }
  }, [permission?.granted, range, fetchPage]);

  const toggle = useCallback((id: string) => {
    setSelection((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length >= MAX_SELECTION
          ? current
          : [...current, id]
    );
  }, []);

  const confirm = useCallback(async () => {
    setImporting(true);
    try {
      const picked = selection
        .map((id) => assets.find((a) => a.id === id))
        .filter((a): a is AssetMetadata => !!a)
        .map((a) => ({ id: a.id, width: a.width ?? 1000, height: a.height ?? 1000 }));
      onDone(await importPhotos(picked));
    } finally {
      setImporting(false);
    }
  }, [assets, selection, onDone]);

  if (!permission) return <Centered><ActivityIndicator color={theme.accent} /></Centered>;

  if (!permission.granted) {
    return (
      <Centered>
        <Text style={styles.explain}>
          Schnipsel braucht Zugriff auf deine Fotos, um Collagen daraus zu bauen.
        </Text>
        <Button label="Fotos freigeben" tone="primary" onPress={() => requestPermission()} />
      </Centered>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Schnipsel</Text>
        <View style={styles.chips}>
          {(Object.keys(RANGE_LABELS) as Range[]).map((key) => (
            <Chip
              key={key}
              label={RANGE_LABELS[key]}
              active={range === key}
              onPress={() => setRange(key)}
            />
          ))}
        </View>
      </View>

      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        removeClippedSubviews
        initialNumToRender={COLUMNS * 8}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (!exhausted) fetchPage(assets.length, range).catch(() => setExhausted(true));
        }}
        renderItem={({ item }) => {
          const position = selection.indexOf(item.id);
          return (
            <Pressable onPress={() => toggle(item.id)} style={{ margin: 1 }}>
              <Image
                source={item.id}
                style={{ width: tile, height: tile, backgroundColor: theme.surface }}
                contentFit="cover"
                recyclingKey={item.id}
                cachePolicy="memory-disk"
              />
              {position >= 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>{position + 1}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Centered>
            <Text style={styles.explain}>Keine Fotos in diesem Zeitraum.</Text>
          </Centered>
        }
      />

      <View style={styles.footer}>
        {onCancel ? <Button label="Zurück" tone="quiet" onPress={onCancel} /> : <View />}
        <Button
          label={
            importing
              ? 'Lädt …'
              : selection.length === 0
                ? 'Fotos auswählen'
                : `Weiter mit ${selection.length}`
          }
          tone="primary"
          onPress={confirm}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  explain: { color: theme.textDim, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
  title: { color: theme.text, fontSize: 26, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 8 },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: { color: theme.bg, fontSize: 13, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.surface,
  },
});
