import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AUTO_DELETE_DAYS,
  addFolder,
  archiveConversation,
  deleteFolder,
  duplicateConversation,
  getConversations,
  getFolders,
  moveConversationToFolder,
  pinConversation,
  renameConversation,
} from "@/lib/storage";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ChatFolder, Conversation } from "@/lib/storage";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { HighlightedText } from "@/components/highlighted-text";
import { useColors } from "@/hooks/use-colors";
import { SwipeHistoryRow } from "@/components/swipe-history-row";

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

interface HistorySheetProps {
  visible: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onRename?: (id: string, title: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function HistorySheet({
  visible,
  activeId,
  onClose,
  onOpen,
  onNew,
  onDelete,
  onClearAll,
  onRename,
}: Omit<HistorySheetProps, "conversations">) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchText, setSearchText] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [renameInput, setRenameInput] = useState("");
  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [folderDialog, setFolderDialog] = useState<{ mode: "add" | "move"; convId?: string } | null>(null);
  const [folderInput, setFolderInput] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [archiveOpen, setArchiveOpen] = useState(false);

  const filtered = conversations.filter((c) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q));
  });

  // Find the first message text matching the search query (for preview highlight).
  const matchedPreview = useCallback((item: Conversation) => {
    const q = searchText.trim().toLowerCase();
    if (!q) return "";
    for (const m of item.messages) {
      if (m.text.toLowerCase().includes(q)) return m.text;
    }
    return "";
  }, [searchText]);

  const sections = useMemo(() => {
    const folderMap = new Map(folders.map((f) => [f.id, f]));
    const folderGroups: { kind: "folder"; id: string; name: string; items: Conversation[] }[] = [];
    const pinned: Conversation[] = [];
    const recent: Conversation[] = [];
    for (const c of filtered) {
      if (c.folderId && folderMap.has(c.folderId)) {
        const f = folderMap.get(c.folderId)!;
        const g = folderGroups.find((x) => x.id === c.folderId);
        if (g) g.items.push(c);
        else folderGroups.push({ kind: "folder", id: c.folderId, name: f.name, items: [c] });
      } else if (c.pinned) pinned.push(c);
      else recent.push(c);
    }
    // Folder collapse/expand: skip collapsed folder items
    const visibleGroups = folderGroups.filter((g) => !collapsedFolders[g.id]);
    void folderGroups;
    void folderGroups;
    return [
      ...visibleGroups,
      ...(pinned.length ? [{ kind: "pinned" as const, id: "__pinned", name: "Pinned", items: pinned }] : []),
      ...(recent.length ? [{ kind: "recent" as const, id: "__recent", name: "Recent", items: recent }] : []),
    ];
  }, [filtered, folders, collapsedFolders]);

  const archived = useMemo(() => conversations.filter((c) => c.archived), [conversations]);

  useEffect(() => {
    if (!visible) {
      setConfirmClear(false);
      setRenameId(null);
      setSearchText("");
    }
  }, [visible]);

  useEffect(() => {
    setRenameInput(renameText);
  }, [renameText]);
  useEffect(() => {
    if (!visible) return;
    getConversations().then(setConversations);
    getFolders().then(setFolders);
  }, [visible]);
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const refresh = useCallback(() => {
    getConversations().then(setConversations);
    getFolders().then(setFolders);
  }, []);

  const togglePin = useCallback(async (item: Conversation, pinned: boolean) => {
    haptic();
    await pinConversation(item.id, pinned);
    await refresh();
  }, [refresh]);

  const startRename = useCallback((item: Conversation) => {
    setRenameId(item.id);
    setRenameText(item.title);
    haptic();
  }, []);

  const submitRename = useCallback(async () => {
    const id = renameId;
    if (!id) return;
    const title = renameInput.trim() || "New Chat";
    setRenameText(title);
    await renameConversation(id, title);
    await refresh();
    onRename?.(id, title);
    setRenameId(null);
    setRenameInput("");
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [renameId, renameInput, onRename, refresh]);

  const openMoveDialog = useCallback((convId: string) => {
    setFolderDialog({ mode: "move", convId });
    setFolderInput("");
    haptic();
  }, []);

  const openAddDialog = useCallback(() => {
    setFolderDialog({ mode: "add" });
    setFolderInput("");
    haptic();
  }, []);

  const submitFolderDialog = useCallback(async () => {
    const dlg = folderDialog;
    if (!dlg) return;
    if (dlg.mode === "add") {
      if (!folderInput.trim()) return;
      await addFolder(folderInput);
    } else if (dlg.mode === "move" && dlg.convId) {
      await moveConversationToFolder(dlg.convId, folderInput === "__none" ? null : folderInput);
    }
    await refresh();
    setFolderDialog(null);
    setFolderInput("");
  }, [folderDialog, folderInput, refresh]);

  const handleOpen = useCallback(
    (id: string) => {
      haptic();
      onOpen(id);
    },
    [onOpen],
  );

  const toggleArchive = useCallback(async (item: Conversation, archived: boolean) => {
    haptic();
    await archiveConversation(item.id, archived);
    await refresh();
  }, [refresh]);

  const duplicateChat = useCallback(async (item: Conversation) => {
    haptic();
    await duplicateConversation(item.id);
    await refresh();
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [refresh]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, borderColor: colors.border },
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        <View className="items-center py-2">
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        </View>
        <View className="flex-row items-center justify-between px-4 pb-2">
          <Text className="text-lg font-bold text-foreground">Chat History</Text>
          <Text className="text-xs text-muted">Auto-deletes after {AUTO_DELETE_DAYS} days</Text>
        </View>
        {archived.length > 0 ? (
          <Pressable
            onPress={() => {
              setArchiveOpen((o) => !o);
              haptic();
            }}
            style={({ pressed }) => [styles.archiveRow, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name={archiveOpen ? "chevron.down" : "chevron.right"} size={14} color={colors.muted} />
            <IconSymbol name="archivebox" size={14} color={colors.muted} />
            <Text className="text-xs font-semibold text-muted ml-1">{archived.length} archived{archiveOpen ? " (tap to hide)" : ""}</Text>
          </Pressable>
        ) : null}
        {archiveOpen ? (
          <View className="px-4 pb-2 gap-2">
            {archived.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => handleOpen(a.id)}
                style={({ pressed }) => [styles.archiveItem, { backgroundColor: colors.background, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
              >
                <Text className="text-xs text-foreground flex-1" numberOfLines={1}>{a.title}</Text>
                <Pressable
                  onPress={() => toggleArchive(a, false)}
                  hitSlop={8}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <Text className="text-[10px] font-semibold text-primary">Restore</Text>
                </Pressable>
                <Pressable
                  onPress={() => { haptic(); onDelete(a.id); }}
                  hitSlop={8}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <IconSymbol name="trash.fill" size={12} color={colors.muted} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View className="px-4 pb-2">
          <Pressable
            onPress={onNew}
            style={({ pressed }) => [
              styles.newBtn,
              { backgroundColor: colors.primary },
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
          >
            <IconSymbol name="plus" size={18} color="#fff" />
            <Text className="text-white font-semibold ml-1">New Chat</Text>
          </Pressable>
          <View
            className="flex-row items-center rounded-xl mt-2"
            style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12 }}
          >
            <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search chats and messages"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              autoCapitalize="none"
              className="flex-1 text-foreground text-sm"
              style={{ paddingVertical: 10, minHeight: 40, color: colors.foreground }}
            />
          </View>
        </View>
        <View className="flex-row items-center px-4 pb-2 gap-2">
          <Pressable
            onPress={openAddDialog}
            style={({ pressed }) => [
              styles.folderBtn,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="plus" size={14} color={colors.primary} />
            <Text className="text-xs font-semibold text-primary ml-1">Folder</Text>
          </Pressable>
        </View>
        {filtered.length === 0 ? (
          <View className="items-center py-10">
            <Text className="text-muted text-sm text-center">
              {conversations.length === 0
                ? `No chats yet.\nChats auto-delete after ${AUTO_DELETE_DAYS} days (pinned chats are kept).`
                : "No matching chats."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={sections}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 4 }}
            renderItem={({ item: section }) => (
              <View className="mt-2">
                <Text className="text-[10px] uppercase tracking-wide text-muted mb-1 px-2">{section.name}</Text>
                {section.items.map((item) => {
                  const active = item.id === activeId;
                  const isFolderRow = section.kind === "folder";
                  const folderCollapsed = isFolderRow && collapsedFolders[section.id] === true;
                  void folderCollapsed;
                  return (
                    <SwipeHistoryRow key={item.id} onDelete={() => onDelete(item.id)}>
                      <Pressable
                        onPress={() => {
                          haptic();
                          onDelete(item.id);
                        }}
                        style={[styles.deleteReveal, { backgroundColor: colors.error }]}
                      >
                        <IconSymbol name="trash.fill" size={18} color="#fff" />
                      </Pressable>
                    <Pressable
                      key={undefined as unknown as string}
                      onPress={() => handleOpen(item.id)}
                      style={({ pressed }) => [
                        styles.row,
                        { backgroundColor: active ? colors.primary + "22" : colors.background, borderColor: colors.border },
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      <View className="flex-1 pr-2">
                        <Pressable
                          onPress={() => handleOpen(item.id)}
                          onLongPress={() => startRename(item)}
                          style={{ flex: 1, paddingRight: 8 }}
                        >
                          <HighlightedText
                          text={`${item.pinned ? "📌 " : ""}${item.title}`}
                          query={searchText}
                          className="text-base font-medium text-foreground"
                          highlightColor={colors.primary}
                        />
                          <HighlightedText
                            text={matchedPreview(item)}
                            query={searchText}
                            className="text-xs text-muted"
                            numberOfLines={1}
                            highlightColor={colors.primary}
                          />
                          <Text className="text-[10px] text-muted mt-0.5">Hold to rename</Text>
                        </Pressable>
                        <Text className="text-xs text-muted mt-0.5">
                          {item.messages.length} messages · {timeAgo(item.updatedAt)}
                          {item.pinned ? " · pinned" : ""}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => openMoveDialog(item.id)}
                        hitSlop={8}
                        style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                      >
                        <IconSymbol name="square.grid.2x2" size={16} color={item.folderId ? colors.primary : colors.muted} />
                      </Pressable>
                      <Pressable
                        onPress={() => duplicateChat(item)}
                        hitSlop={8}
                        style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                      >
                        <IconSymbol name="doc.on.doc" size={16} color={colors.muted} />
                      </Pressable>
                      <Pressable
                        onPress={() => toggleArchive(item, !item.archived)}
                        hitSlop={8}
                        style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                      >
                        <IconSymbol name="archivebox" size={16} color={item.archived ? colors.primary : colors.muted} />
                      </Pressable>
                      <Pressable
                        onPress={() => togglePin(item, !item.pinned)}
                        hitSlop={8}
                        style={({ pressed }) => [pressed && { opacity: 0.6 }, styles.pinBtn]}
                      >
                        <IconSymbol name={item.pinned ? "pin.fill" : "pin"} size={16} color={item.pinned ? colors.primary : colors.muted} />
                      </Pressable>
                    </Pressable>
                    </SwipeHistoryRow>
                  );
                })}
              </View>
            )}
          />
        )}
        {/* Rename dialog */}
        <Modal visible={renameId !== null} transparent animationType="fade" onRequestClose={() => setRenameId(null)}>
          <Pressable style={styles.backdrop} onPress={() => setRenameId(null)} />
          <KeyboardAvoidingView
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, justifyContent: "center" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={[styles.confirm, { backgroundColor: colors.surface, borderColor: colors.border, alignSelf: "center", width: "85%" }]}>
              <Text className="text-base font-bold text-foreground px-4 pt-4">Rename chat</Text>
              <TextInput
                value={renameInput}
                onChangeText={setRenameInput}
                placeholder="Chat name"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                onSubmitEditing={submitRename}
                autoFocus={Platform.OS !== "web"}
                className="text-foreground text-base"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  borderRadius: 12,
                  marginHorizontal: 16,
                  marginTop: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  minHeight: 44,
                  color: colors.foreground,
                }}
              />
              <View className="flex-row px-4 pt-4 pb-2 gap-2">
                <Pressable
                  onPress={() => setRenameId(null)}
                  style={({ pressed }) => [styles.confirmBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text className="text-sm font-semibold text-foreground">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={submitRename}
                  style={({ pressed }) => [styles.confirmBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
                >
                  <Text className="text-sm font-semibold text-white">Save</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      {/* Folder dialog (add folder / move chat to folder) */}
      <Modal visible={folderDialog !== null} transparent animationType="fade" onRequestClose={() => setFolderDialog(null)}>
        <Pressable style={styles.backdrop} onPress={() => setFolderDialog(null)} />
        <KeyboardAvoidingView
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, justifyContent: "center" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.confirm, { backgroundColor: colors.surface, borderColor: colors.border, alignSelf: "center", width: "85%", maxHeight: 480 }]}>
            <Text className="text-base font-bold text-foreground px-4 pt-4">
              {folderDialog?.mode === "add" ? "New folder" : "Move to folder"}
            </Text>
            {folderDialog?.mode === "move" ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 6, maxHeight: 300 }}>
                <Pressable
                  onPress={() => setFolderInput("__none")}
                  style={({ pressed }) => [
                    styles.folderPick,
                    { backgroundColor: folderInput === "__none" ? colors.primary + "22" : colors.background, borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text className="text-sm text-foreground">No folder</Text>
                  {folderInput === "__none" ? <IconSymbol name="checkmark" size={16} color={colors.primary} /> : null}
                </Pressable>
                {folders.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => setFolderInput(f.id)}
                    style={({ pressed }) => [
                      styles.folderPick,
                      { backgroundColor: folderInput === f.id ? colors.primary + "22" : colors.background, borderColor: colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text className="text-sm text-foreground flex-1">{f.name}</Text>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setFolderInput((cur) => (cur === f.id ? "__delete_pick" : cur));
                        deleteFolder(f.id).then(() => {
                          setFolders((fs) => fs.filter((x) => x.id !== f.id));
                        });
                      }}
                      hitSlop={6}
                      style={({ pressed }) => [pressed && { opacity: 0.6 }, { padding: 4 }]}
                    >
                      <IconSymbol name="trash.fill" size={14} color={colors.muted} />
                    </Pressable>
                    {folderInput === f.id ? <IconSymbol name="checkmark" size={16} color={colors.primary} /> : null}
                  </Pressable>
                ))}
                {folders.length === 0 ? (
                  <Text className="text-xs text-muted text-center py-2">No folders yet. Add one below.</Text>
                ) : null}
              </View>
            ) : (
              <TextInput
                value={folderInput}
                onChangeText={setFolderInput}
                placeholder="Folder name"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                onSubmitEditing={submitFolderDialog}
                autoFocus={Platform.OS !== "web"}
                className="text-foreground text-base"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  borderRadius: 12,
                  marginHorizontal: 16,
                  marginTop: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  minHeight: 44,
                  color: colors.foreground,
                }}
              />
            )}
            <View className="flex-row px-4 pt-4 pb-2 gap-2">
              <Pressable
                onPress={() => setFolderDialog(null)}
                style={({ pressed }) => [styles.confirmBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
              >
                <Text className="text-sm font-semibold text-foreground">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitFolderDialog}
                disabled={folderDialog?.mode === "move" ? !folderInput : !folderInput.trim()}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  { backgroundColor: !folderInput || (folderDialog?.mode === "move" ? false : !folderInput.trim()) ? colors.border : colors.primary },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text className="text-sm font-semibold text-white">
                  {folderDialog?.mode === "add" ? "Add" : folderInput === "__none" ? "Move out" : "Move"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

        {conversations.length > 0 ? (
          <View className="px-4 pt-2">
            <Pressable
              onPress={() => {
                haptic();
                setConfirmClear(true);
              }}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text className="text-sm text-error font-medium text-center py-1">
                Clear all history
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Clear all confirmation dialog */}
      <Modal visible={confirmClear} transparent animationType="fade" onRequestClose={() => setConfirmClear(false)}>
        <Pressable style={styles.backdrop} onPress={() => setConfirmClear(false)} />
        <View style={[styles.confirm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View className="flex-row items-center gap-2 px-4 pt-4">
            <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.warning} />
            <Text className="text-base font-bold text-foreground">Clear all chats?</Text>
          </View>
          <Text className="text-sm text-muted px-4 pt-2 leading-5">
            This will delete every chat on this device immediately. This cannot be undone.
          </Text>
          <View className="flex-row px-4 pt-4 pb-2 gap-2">
            <Pressable
              onPress={() => setConfirmClear(false)}
              style={({ pressed }) => [styles.confirmBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
            >
              <Text className="text-sm font-semibold text-foreground">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptic();
                if (Platform.OS !== "web") {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }
                setConfirmClear(false);
                onClearAll();
              }}
              style={({ pressed }) => [styles.confirmBtn, { backgroundColor: colors.error }, pressed && { opacity: 0.8 }]}
            >
              <Text className="text-sm font-semibold text-white">Delete all</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 11,
  },
  deleteReveal: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 56,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 6,
  },
  confirm: {
    position: "absolute",
    alignSelf: "center",
    top: "40%",
    width: "85%",
    borderRadius: 16,
    borderWidth: 0.5,
  },
  folderBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  archiveRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  archiveItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  folderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  folderPick: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pinBtn: {
    paddingRight: 10,
  },
  confirmBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    paddingVertical: 11,
  },
});
