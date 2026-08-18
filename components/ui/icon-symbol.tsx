// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconSymbolName =
  | "house.fill"
  | "paperplane.fill"
  | "chevron.left.forwardslash.chevron.right"
  | "chevron.right"
  | "xmark"
  | "gear"
  | "square.grid.2x2"
  | "square.grid.2x2.fill"
  | "plus"
  | "trash.fill"
  | "photo.fill"
  | "photo"
  | "chevron.down"
  | "chevron.up"
  | "arrow.down.circle.fill"
  | "arrow.up.circle.fill"
  | "ellipsis.bubble.fill"
  | "sparkles"
  | "doc.on.doc"
  | "doc.on.doc.fill"
  | "arrow.counterclockwise"
  | "checkmark"
  | "checkmark.circle.fill"
  | "exclamationmark.triangle.fill"
  | "sun.max.fill"
  | "moon.fill"
  | "cloud.fill"
  | "cloud.slash.fill"
  | "bubble.left"
  | "bubble.left.fill"
  | "doc.text.fill"
  | "mic"
  | "mic.fill"
  | "magnifyingglass"
  | "square.and.arrow.up"
  | "pin"
  | "pin.fill"
  | "pencil"
  | "paintbrush.fill"
  | "arrow.down.doc.fill"
  | "speaker.wave.2.fill"
  | "stop.fill"
  | "hand.thumbup"
  | "hand.thumbup.fill"
  | "hand.thumbdown"
  | "hand.thumbdown.fill"
  | "reply.fill"
  | "square.and.pencil"
  | "quote.bubble"
  | "list.bullet"
  | "star"
  | "star.fill"
  | "speaker.wave.1.fill"
  | "chevron.left"
  | "slider.horizontal.3"
  | "lock.fill"
  | "touchid"
  | "lock.open.fill"
  | "eye.fill"
  | "archivebox"
  | "textformat"
  | "textformat.size.fill"
  | "chart.bar"
  | "chart.bar.fill"
  | "bell.fill"
  | "calendar"
  | "eye"
  | "doc.fill"
  | "visibility"
  | "visibility-off"
  | "delete"
  | "note-add"
  | "person.2.fill"
  | "wifi.slash"
  | "exclamationmark.triangle"

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "xmark": "close",
  "gear": "settings",
  "square.grid.2x2": "grid-view",
  "square.grid.2x2.fill": "grid-view",
  "plus": "add",
  "trash.fill": "delete",
  "photo.fill": "photo",
  "photo": "photo",
  "chevron.down": "keyboard-arrow-down",
  "chevron.up": "keyboard-arrow-up",
  "arrow.down.circle.fill": "arrow-circle-down",
  "arrow.up.circle.fill": "arrow-circle-up",
  "ellipsis.bubble.fill": "chat",
  "sparkles": "auto-awesome",
  "pencil": "edit",
  "doc.on.doc": "content-copy",
  "doc.on.doc.fill": "content-copy",
  "arrow.counterclockwise": "refresh",
  "checkmark": "check",
  "checkmark.circle.fill": "check-circle",
  "exclamationmark.triangle.fill": "warning",
  "sun.max.fill": "wb-sunny",
  "moon.fill": "dark-mode",
  "cloud.fill": "cloud",
  "cloud.slash.fill": "cloud-off",
  "bubble.left": "chat",
  "bubble.left.fill": "chat-bubble",
  "doc.text.fill": "description",
  "mic": "mic-none",
  "mic.fill": "mic",
  "magnifyingglass": "search",
  "square.and.arrow.up": "ios-share",
  "pin": "keep",
  "pin.fill": "push-pin",
  "paintbrush.fill": "brush",
  "arrow.down.doc.fill": "file-download",
  "speaker.wave.2.fill": "volume-up",
  "stop.fill": "stop-circle",
  "hand.thumbup": "thumb-up-outlined",
  "hand.thumbup.fill": "thumb-up",
  "hand.thumbdown": "thumb-down-outlined",
  "hand.thumbdown.fill": "thumb-down",
  "reply.fill": "reply",
  "square.and.pencil": "edit",
  "quote.bubble": "format-quote",
  "eye.fill": "visibility",
  "list.bullet": "format-list-bulleted",
  "star": "star-border",
  "star.fill": "star",
  "speaker.wave.1.fill": "volume-down",
  "chevron.left": "keyboard-arrow-left",
  "slider.horizontal.3": "tune",
  "lock.fill": "lock",
  "touchid": "fingerprint",
  "lock.open.fill": "lock-open",
  "archivebox": "archive",
  "textformat": "text-fields",
  "textformat.size.fill": "text-fields",
  "chart.bar": "bar-chart",
  "chart.bar.fill": "bar-chart",
  "bell.fill": "notifications",
  "calendar": "event",
  "eye": "visibility",
  "visibility": "visibility",
  "doc.fill": "description",
  "visibility-off": "visibility-off",
  "delete": "delete",
  "note-add": "note-add",
  "person.2.fill": "people",
  "wifi.slash": "wifi-off",
  "exclamationmark.triangle": "warning",
};

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name] as ComponentProps<typeof MaterialIcons>["name"]} style={style} />;
}
