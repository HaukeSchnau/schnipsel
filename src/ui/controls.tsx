/**
 * The handful of controls the editor needs.
 *
 * Sliders rather than menus, because three sliders cover most of the design
 * decisions and a slider can be worked with one thumb. Everything here is
 * built on gesture-handler so dragging never waits on the JS thread.
 */
import { type ReactNode, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { theme } from './theme';

export function Button({
  label,
  onPress,
  tone = 'normal',
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'normal' | 'primary' | 'quiet';
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'primary' && styles.buttonPrimary,
        tone === 'quiet' && styles.buttonQuiet,
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, tone === 'primary' && styles.buttonLabelPrimary]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

/**
 * A slider whose value only reaches React on release, so dragging it stays on
 * the UI thread and each drag is a single undo step.
 */
export function Slider({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const width = useSharedValue(0);
  const position = useSharedValue(value);

  const emit = useCallback((v: number) => onChange(v), [onChange]);
  const commit = useCallback((v: number) => onCommit(v), [onCommit]);

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      if (width.value <= 0) return;
      position.value = Math.max(0, Math.min(1, e.x / width.value));
      runOnJS(emit)(position.value);
    })
    .onUpdate((e) => {
      if (width.value <= 0) return;
      position.value = Math.max(0, Math.min(1, e.x / width.value));
      runOnJS(emit)(position.value);
    })
    .onEnd(() => {
      runOnJS(commit)(position.value);
    });

  const fill = useAnimatedStyle(() => ({ width: `${position.value * 100}%` }));
  const knob = useAnimatedStyle(() => ({ left: `${position.value * 100}%` }));

  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <GestureDetector gesture={pan}>
        <View
          style={styles.sliderTrack}
          onLayout={(e) => {
            width.value = e.nativeEvent.layout.width;
            position.value = value;
          }}
        >
          <View style={styles.sliderTrackLine} />
          <Animated.View style={[styles.sliderFill, fill]} />
          <Animated.View style={[styles.sliderKnob, knob]} />
        </View>
      </GestureDetector>
    </View>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <View style={styles.toolbar}>{children}</View>;
}

export function tick() {
  Haptics.selectionAsync().catch(() => {});
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: theme.radius,
    backgroundColor: theme.surfaceHigh,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: theme.accent },
  buttonQuiet: { backgroundColor: 'transparent' },
  buttonLabel: { color: theme.text, fontSize: 15, fontWeight: '600' },
  buttonLabelPrimary: { color: theme.bg },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  chipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipLabel: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
  chipLabelActive: { color: theme.bg },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  sliderLabel: { color: theme.textDim, fontSize: 13, width: 74 },
  sliderTrack: {
    flex: 1,
    height: 34,
    justifyContent: 'center',
  },
  sliderTrackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.line,
  },
  sliderFill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.accent,
  },
  sliderKnob: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: theme.accent,
  },
  toolbar: {
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.line,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
