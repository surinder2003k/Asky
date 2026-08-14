import { Animated, PanResponder, Platform, View } from "react-native";
import { useMemo, useRef } from "react";
import * as Haptics from "expo-haptics";

/**
 * Swipeable history row (swipe left to reveal delete).
 * Owns useRef/PanResponder at component top level so the parent can render
 * inside a FlatList renderItem without violating React's hooks rules,
 * which crashed the release APK ("Asky keeps stopping").
 */
export function SwipeHistoryRow({
  onDelete,
  children,
}: {
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const swipeX = useRef(new Animated.Value(0)).current;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          if (g.dx <= 0) swipeX.setValue(g.dx);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < -80) {
            haptic();
            onDelete();
            swipeX.setValue(0);
          } else {
            Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    [onDelete],
  );

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: swipeX }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}
