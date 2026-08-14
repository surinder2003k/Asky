import { Animated, PanResponder, Platform, type ViewStyle } from "react-native";
import { useMemo, useRef } from "react";
import * as Haptics from "expo-haptics";

export type SwipeMessageProps = {
  /** Called when swiped to the right (copy action). */
  onSwipeRight: () => void;
  /** Called when swiped to the left (archive action). */
  onSwipeLeft: () => void;
  /** The row content, rendered inside the swipeable container. */
  children: React.ReactNode;
  /** Horizontal alignment of the row ("flex-end" for user bubbles). */
  align: ViewStyle["alignSelf"];
};

/**
 * Owns the useRef + PanResponder at component top level, so the parent can
 * render this inside a FlatList renderItem .map() without violating React's
 * hooks rules (that violation crashed the release APK).
 * Swipe right (>70px) = copy, swipe left (<-70px) = archive.
 */
export function SwipeMessageRow({ onSwipeRight, onSwipeLeft, children, align }: SwipeMessageProps) {
  const swipeX = useRef(new Animated.Value(0)).current;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 12,
        onPanResponderMove: (_e, g) => {
          if (Math.abs(g.dx) < 140) swipeX.setValue(g.dx);
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dx > 70) {
            haptic();
            onSwipeRight();
          } else if (g.dx < -70) {
            haptic();
            onSwipeLeft();
          }
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSwipeRight, onSwipeLeft],
  );

  return (
    <Animated.View
      style={{
        transform: [{ translateX: swipeX }],
        flexDirection: "row",
        alignItems: "center",
        alignSelf: align,
      }}
      {...responder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }
}
