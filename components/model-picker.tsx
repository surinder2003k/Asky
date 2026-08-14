import { useEffect, useState } from "react";
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PROVIDERS, type ModelDef } from "@/lib/providers";
import { getModels } from "@/lib/remote-config";
import { useColors } from "@/hooks/use-colors";
import { getBusyModel, isModelBusy, subscribeBusyModel } from "@/lib/busy-model";

interface ModelPickerProps {
  visible: boolean;
  currentKey: string;
  keyAvailability: Record<string, boolean>;
  onClose: () => void;
  onSelect: (modelKey: string) => void;
}

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function ModelPicker({ visible, currentKey, keyAvailability, onClose, onSelect }: ModelPickerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [models, setModels] = useState<ModelDef[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [, forceUpdate] = useState(0);

  // Re-render whenever the busy model changes (generating in another session)
  useEffect(() => {
    return subscribeBusyModel(() => forceUpdate((n) => n + 1));
  }, []);

  useEffect(() => {
    if (!visible) return;
    getModels().then(setModels);
    (async () => {
      const { getFavoriteModels } = await import("@/lib/storage");
      setFavorites(await getFavoriteModels());
    })();
  }, [visible]);

  const grouped = PROVIDERS.filter((p) => models.some((m) => m.providerKey === p.key)).map((p) => ({
    provider: p,
    models: models.filter((m) => m.providerKey === p.key),
  }));

  const favoriteModels = models.filter((m) => favorites.includes(m.id));

  const toggleFav = async (modelKey: string) => {
    haptic();
    const { toggleFavoriteModel } = await import("@/lib/storage");
    setFavorites(await toggleFavoriteModel(modelKey));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        <View className="items-center py-2">
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        </View>
        <View className="px-4 pb-1">
          <Text className="text-lg font-bold text-foreground">Choose Model</Text>
          <Text className="text-xs text-muted mt-0.5">Models work when you add that provider's key in Settings. Star models to pin them here.</Text>
        </View>
        <FlatList
          ListHeaderComponent={
            favoriteModels.length > 0 ? (
              <View>
                <Text className="text-[11px] font-bold text-muted uppercase tracking-wide px-2 pt-3 pb-1">
                  Favorites
                </Text>
                {favoriteModels.map((m) => (
                  <Pressable
                    key={`fav-${m.id}`}
                    onPress={() => {
                      if (isModelBusy(m.id)) return;
                      haptic();
                      onSelect(m.id);
                    }}
                    disabled={isModelBusy(m.id)}
                    style={({ pressed }) => [
                      styles.row,
                      { backgroundColor: m.id === currentKey ? colors.primary + "22" : "transparent" },
                      pressed && !isModelBusy(m.id) && { opacity: 0.75 },
                      isModelBusy(m.id) && { opacity: 0.45 },
                    ]}
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-base font-medium text-foreground">{m.name}</Text>
                      <Text className="text-xs text-muted mt-0.5">{m.id.slice(m.providerKey.length + 1)}</Text>
                    </View>
                    {isModelBusy(m.id) ? (
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors.warning + "26" }}>
                        <Text className="text-[10px] font-bold" style={{ color: colors.warning }}>BUSY</Text>
                      </View>
                    ) : (
                      <>
                        <Pressable
                          onPress={() => toggleFav(m.id)}
                          hitSlop={6}
                          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                        >
                          <Text style={{ fontSize: 14, color: colors.warning }}>★</Text>
                        </Pressable>
                      </>
                    )}
                    {keyAvailability[m.providerKey] ? (
                      <View className="rounded-full px-2 py-0.5 ml-1" style={{ backgroundColor: colors.success + "26" }}>
                        <Text className="text-[10px] font-bold" style={{ color: colors.success }}>AVAILABLE</Text>
                      </View>
                    ) : (
                      <View className="rounded-full px-2 py-0.5 ml-1" style={{ backgroundColor: colors.warning + "26" }}>
                        <Text className="text-[10px] font-bold" style={{ color: colors.warning }}>NO KEY</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          data={grouped}
          keyExtractor={(g) => g.provider.key}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 }}
          renderItem={({ item: group }) => (
            <View>
              <Text className="text-[11px] font-bold text-muted uppercase tracking-wide px-2 pt-3 pb-1">
                {group.provider.label}
              </Text>
              {group.models.map((m) => {
                const active = m.id === currentKey;
                const keySet = keyAvailability[m.providerKey] === true;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      if (isModelBusy(m.id)) return;
                      haptic();
                      onSelect(m.id);
                    }}
                    disabled={isModelBusy(m.id)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: active ? colors.primary + "22" : "transparent",
                      },
                      pressed && !isModelBusy(m.id) && { opacity: 0.75 },
                      isModelBusy(m.id) && { opacity: 0.45 },
                    ]}
                  >
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center">
                        <Pressable
                          onPress={() => toggleFav(m.id)}
                          hitSlop={6}
                          style={({ pressed }) => [pressed && { opacity: 0.6 }, { marginRight: 4 }]}
                        >
                          <Text style={{ fontSize: 13, color: favorites.includes(m.id) ? colors.warning : colors.muted }}>★</Text>
                        </Pressable>
                        <Text className="text-base font-medium text-foreground">{m.name}</Text>
                        {m.vision && (
                          <View
                            className="ml-1.5 rounded px-1.5 py-0.5"
                            style={{ backgroundColor: colors.primary + "22" }}
                          >
                            <Text className="text-[9px] font-bold" style={{ color: colors.primary }}>
                              VISION
                            </Text>
                          </View>
                        )}
                        {isModelBusy(m.id) && !active && (
                          <View className="ml-1.5 rounded-full px-2 py-0.5" style={{ backgroundColor: colors.warning + "26" }}>
                            <Text className="text-[9px] font-bold" style={{ color: colors.warning }}>BUSY</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-xs text-muted mt-0.5">{m.id.slice(m.providerKey.length + 1)}</Text>
                    </View>
                    {active && (
                      <Text className="text-sm font-bold" style={{ color: colors.primary }}>
                        ●
                      </Text>
                    )}
                    {keySet ? (
                      <View className="rounded-full px-2 py-0.5 ml-1" style={{ backgroundColor: colors.success + "26" }}>
                        <Text className="text-[10px] font-bold" style={{ color: colors.success }}>AVAILABLE</Text>
                      </View>
                    ) : (
                      <View className="rounded-full px-2 py-0.5 ml-1" style={{ backgroundColor: colors.warning + "26" }}>
                        <Text className="text-[10px] font-bold" style={{ color: colors.warning }}>NO KEY</Text>
                      </View>
                    )}
                    {isModelBusy(m.id) && !active && (
                      <Text className="text-[9px] text-muted ml-1">model is busy</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: 560,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 1,
  },
});
