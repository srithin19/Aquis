/**
 * Bottom navigation — Product Bible 05: Home / History / Achievements / Profile.
 *
 * A floating frosted-glass bar with a gradient pill that springs to the active
 * tab. Screens crossfade (08: "Short crossfade/slide; avoid excessive
 * transitions").
 */

import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { TAB_BAR_HEIGHT } from '@/components/layout';
import { useAppState } from '@/state/AppProvider';
import { color, duration, ease, font, palette, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

const ICONS: Record<string, IconName> = {
  index: 'drop',
  history: 'calendar',
  achievements: 'medal',
  profile: 'person',
};

const BAR_PADDING = 6;

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: color.background },
        animation: 'fade',
        transitionSpec: { animation: 'timing', config: { duration: 140 } },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="achievements" options={{ title: 'Achievements' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useAppState();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);

  const count = state.routes.length;
  // Measured width includes the bar's 6pt padding and 1pt border on each side.
  const tabWidth = Math.max(width - 2 * (BAR_PADDING + 1), 0) / Math.max(count, 1);

  useEffect(() => {
    const target = state.index * tabWidth;
    x.value = reduceMotion ? target : withTiming(target, { duration: duration.base, easing: ease.out });
  }, [state.index, tabWidth, reduceMotion, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, spacing.md) }]} pointerEvents="box-none">
      <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Animated.View style={[styles.indicatorSlot, { width: tabWidth }, indicator]}>
            <View style={styles.indicator} />
          </Animated.View>
        ) : null}

        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key].options;
          const label = typeof options.title === 'string' ? options.title : route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic('light');
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              style={styles.tab}
            >
              <Icon
                name={ICONS[route.name] ?? 'drop'}
                size={22}
                color={focused ? palette.ink950 : color.textMuted}
                strokeWidth={focused ? 2.3 : 1.9}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[styles.label, focused && styles.labelFocused]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: radius.pill,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    padding: BAR_PADDING,
    shadowColor: palette.black,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  indicatorSlot: {
    position: 'absolute',
    top: BAR_PADDING,
    bottom: BAR_PADDING,
    left: BAR_PADDING,
  },
  indicator: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: palette.lime400,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontFamily: font.bodyStrong,
    fontSize: 10.5,
    color: color.textMuted,
  },
  labelFocused: {
    color: palette.ink950,
  },
});
