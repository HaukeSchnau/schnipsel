/**
 * Schnipsel — collages for Instagram stories, without Instagram's layout tool.
 *
 * Two screens and no navigation library: pick photos, then edit. The draft is
 * restored on launch, so "where was I" is answered before it's asked.
 */
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useEditor } from './src/editor/useEditor';
import { EditorScreen } from './src/screens/EditorScreen';
import { PickerScreen } from './src/screens/PickerScreen';
import { theme } from './src/ui/theme';

export default function App() {
  const editor = useEditor();
  const [picking, setPicking] = useState(false);
  const hasCollage = !!editor.collage && editor.collage.layers.length > 0;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <StatusBar style="light" />
          {!editor.restored ? (
            <View style={styles.splash}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : picking || !hasCollage ? (
            <PickerScreen
              onDone={(photos) => {
                editor.startWith(photos);
                setPicking(false);
              }}
              onCancel={hasCollage ? () => setPicking(false) : undefined}
            />
          ) : (
            <EditorScreen
              collage={editor.collage!}
              photos={editor.photos}
              photosById={editor.photosById}
              canUndo={editor.canUndo}
              apply={editor.apply}
              undo={editor.undo}
              shuffle={editor.shuffle}
              onPickPhotos={() => setPicking(true)}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
