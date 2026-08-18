import React, { useCallback, useState } from "react";
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { CHAT_TEMPLATES, getTemplate } from "@/lib/templates";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Current conversation's applied template id (if any). */
  currentTemplateId?: string;
  onApply: (templateId: string | null) => void;
}

/**
 * Sheet showing ready-made chat templates (personas).
 * Tap to apply to the current chat; tap the applied one again to remove.
 */
export function TemplatesSheet({ visible, onClose, currentTemplateId, onApply }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const handleApply = useCallback(
    (templateId: string) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      // Toggle off if already applied
      const applied = currentTemplateId === templateId ? null : templateId;
      onApply(applied);
      onClose();
    },
    [currentTemplateId, onApply, onClose],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>
        <Text className="text-foreground text-lg font-bold" style={styles.title}>
          Chat Templates
        </Text>
        <Text className="text-muted text-xs" style={styles.subtitle}>
          Apply a persona to this chat. Applied template overrides your custom instructions.
        </Text>
        <FlatList
          data={CHAT_TEMPLATES}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 420 }}
          renderItem={({ item }) => {
            const applied = item.id === currentTemplateId;
            return (
              <Pressable
                onPress={() => handleApply(item.id)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: applied ? colors.primary + "22" : colors.surface, borderColor: applied ? colors.primary : colors.border },
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 },
                ]}
              >
                <Text style={styles.emoji}>{item.emoji}</Text>
                <View style={styles.rowText}>
                  <Text className="text-foreground text-sm font-semibold">{item.name}</Text>
                  <Text className="text-muted text-xs" numberOfLines={1}>
                    {item.description}
                  </Text>
                </View>
                {applied && <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        />
        <View style={{ paddingBottom: Math.max(insets.bottom, 12) }} />
      </View>
    </Modal>
  );
}

/** Returns template emoji+name for a given id (used in header chip). */
export function templateChipInfo(templateId: string | undefined): { emoji: string; name: string } | null {
  const tpl = getTemplate(templateId ?? "");
  if (!tpl) return null;
  return { emoji: tpl.emoji, name: tpl.name };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: 560,
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  title: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  subtitle: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  emoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
