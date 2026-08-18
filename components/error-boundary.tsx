import React from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Root error boundary: catches uncaught JS errors so the app shows a friendly
 * "something went wrong" screen instead of Android killing it
 * ("Asky keeps stopping").
 */
interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    // Log to console for debugging
    console.error("[ErrorBoundary]", error.message);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#0e1012" }}>
          <Text style={{ color: "#ecedee", fontSize: 18, fontWeight: "700", textAlign: "center" }}>
            Something went wrong
          </Text>
          <Text style={{ color: "#9ba1a6", fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 18 }}>
            The app hit an unexpected error. Try restarting it.
          </Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={({ pressed }) => [
              {
                marginTop: 20,
                backgroundColor: "#10b981",
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 10,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
