import { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

/**
 * Renders a base64-encoded audio payload (from NVIDIA audio generation)
 * as a compact playback bubble. On native, the base64 is written to a
 * temp file and played with expo-audio; on web it uses a data URI.
 */
export function GenAudioBubble({ base64 }: { base64: string }) {
  const colors = useColors();
  const [statusText, setStatusText] = useState<string>("AI-generated audio");

  const source = useMemo(() => {
    if (Platform.OS === "web") return { uri: `data:audio/mpeg;base64,${base64}` };
    // Native: persist to cache to allow the native player to decode it.
    const uri = `${FileSystem.cacheDirectory}gen-audio-${base64.length}.mp3`;
    void FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 }).catch(() => {});
    return { uri };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base64.length]);

  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  const onPlay = () => {
    if (Platform.OS !== "web") {
      void import("expo-audio").then(({ setAudioModeAsync }) =>
        setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}),
      );
    }
    if (status.playing) {
      player.pause();
      setStatusText("AI-generated audio · paused");
    } else {
      if (status.currentTime >= (status.duration || 0) - 0.5) player.seekTo(0);
      player.play();
      setStatusText("AI-generated audio · playing");
    }
  };

  const onReplay = () => {
    player.seekTo(0);
    player.play();
    setStatusText("AI-generated audio · playing");
  };

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        onPress={onPlay}
        hitSlop={8}
        style={({ pressed }) => [styles.playBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
      >
        {!status.isLoaded ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <IconSymbol name={status.playing ? "stop.fill" : "speaker.wave.2.fill"} size={16} color="#fff" />
        )}
      </Pressable>
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text className="text-[11px] font-semibold text-foreground" numberOfLines={1}>
          {statusText}
        </Text>
        <Text className="text-[10px] text-muted mt-0.5">
          {!status.isLoaded ? "Preparing…" : `Audio · ${Math.round(status.duration || 0)}s total`}
        </Text>
      </View>
      {status.currentTime > 0 && (
        <Pressable onPress={onReplay} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <IconSymbol name="arrow.counterclockwise" size={15} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 240,
    marginTop: 8,
  },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
