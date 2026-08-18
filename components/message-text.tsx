import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useFontSize } from "@/lib/font-size";

interface Props {
  text: string;
  muted?: boolean;
  /** When true, text is rendered white for dark user bubbles (ChatGPT style). */
  userMessage?: boolean;
}

// Lightweight markdown-ish rendering: bold, inline code, code blocks, line breaks, LaTeX math ($$...$$ / $...$).
export function MessageText({ text, muted, userMessage }: Props) {
  if (!text) return null;
  const segments = splitSegments(text, userMessage);
  const { fontSize } = useFontSize();
  return (
    <Text
      className={muted ? "text-muted text-sm" : userMessage ? "text-white text-sm" : "text-sm"}
      style={{ lineHeight: fontSize * 1.3, fontSize }}
    >
      {segments}
    </Text>
  );
}

/**
 * LaTeX math block rendered as a dark monospace surface.
 * Full KaTeX rendering is too heavy for RN; we keep the formula readable
 * with serif italics + a math label so equations stay legible.
 */
function MathBlock({ math }: { math: string }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.codeBlock,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.codeHeader}>
        <Text className="text-xs text-muted">Math</Text>
      </View>
      <Text
        className="text-foreground text-sm"
        selectable
        style={{ fontFamily: "serif", fontStyle: "italic", lineHeight: 24, padding: 12 }}
      >
        {math}
      </Text>
    </View>
  );
}

/**
 * Inline $math$ rendered with serif italics inside a text line.
 */
function MathInline({ math }: { math: string }) {
  return (
    <Text style={{ fontFamily: "serif", fontStyle: "italic", fontSize: 14 }}>
      {math}
    </Text>
  );
}

/**
 * Code block rendered as a View (not a plain <Text>) so we can attach a
 * copy button above the code without breaking inline text flow.
 */
function isHtmlCode(lang: string, code: string): boolean {
  const langLow = lang.trim().toLowerCase();
  if (!["html", "htm", "markup", "svg", "xml"].includes(langLow)) return false;
  const low = code.toLowerCase();
  return low.includes("<html") || low.includes("<!doctype") || low.includes("<body") || low.includes("<svg");
}

function parseLang(headerLine: string): string {
  return headerLine.trim().replace(/^`{3,}/, "").trim();
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canPreview = isHtmlCode(lang ?? "", code);
  const label = lang && lang.trim() ? lang.trim().toLowerCase() : "code";

  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(code);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable — leave state untouched
    }
  }, [code]);

  const codeText = code || "\n";
  return (
    <View
      style={[
        styles.codeBlock,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.codeHeader}>
        <Text className="text-xs text-muted" style={{ fontFamily: "monospace" }}>
          {label}
        </Text>
        <View style={styles.codeActions}>
          {canPreview ? (
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPreviewOpen(true);
              }}
              hitSlop={6}
              style={({ pressed }) => [styles.copyBtn, { backgroundColor: colors.foreground }, pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 }]}
            >
              <IconSymbol name="eye.fill" size={14} color={colors.background} />
              <Text style={[styles.copyBtnText, { color: colors.background }]}>Preview</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleCopy}
            hitSlop={6}
            style={({ pressed }) => [
              styles.copyBtn,
              { backgroundColor: copied ? colors.success : colors.primary },
              pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 },
            ]}
          >
            <IconSymbol name={copied ? "checkmark" : "doc.on.doc"} size={14} color="#fff" />
            <Text style={styles.copyBtnText}>{copied ? "Copied" : "Copy"}</Text>
          </Pressable>
        </View>
      </View>
      {canPreview ? <HtmlPreview visible={previewOpen} html={code} onClose={() => setPreviewOpen(false)} /> : null}
      <Text className="text-foreground text-xs" selectable style={{ fontFamily: "monospace", lineHeight: 16 }}>
        {codeText}
      </Text>
    </View>
  );
}

export function splitSegments(text: string, userMessage?: boolean): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  let key = 0;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // $$...$$ math block (collect consecutive lines until closing $$)
    if (line.trim().startsWith("$$")) {
      const mathLines: string[] = [line.trim().replace(/^\$\$\s*/, "")];
      let j = i + 1;
      let closed = false;
      while (j < lines.length) {
        const next = lines[j];
        if (next.trim().endsWith("$$") && j !== i + 1) {
          const last = next.trim().replace(/\$\$\s*$/, "");
          if (last) mathLines.push(last);
          closed = true;
          j++;
          break;
        }
        if (next.trim() === "$$") {
          closed = true;
          j++;
          break;
        }
        if (next.trim().startsWith("$$")) {
          // same-line opener closer like $$x^2$$ — single-line block
          mathLines.push(next.trim().replace(/^\$\$\s*/, "").replace(/\$\$\s*$/, ""));
          closed = true;
          j++;
          break;
        }
        mathLines.push(next);
        j++;
      }
      if (!closed) mathLines.pop();
      const mathText = mathLines.join("\n").trim();
      if (mathText) {
        if (userMessage) {
          nodes.push(<Text key={key++}>{mathText}</Text>);
        } else {
          nodes.push(<MathBlock key={key++} math={mathText} />);
        }
      }
      i = j - 1;
      continue;
    }
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        const codeLines: string[] = [];
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().startsWith("```")) {
          codeLines.push(lines[j]);
          j++;
        }
        // Inside a dark user bubble, code blocks keep the light surface look
        // by wrapping them — but ChatGPT simply renders plain white text in
        // user messages, so we render raw text without blocks when userMessage.
        if (userMessage) {
          nodes.push(<Text key={key++}>{codeLines.join("\n")}</Text>);
        } else {
          nodes.push(<CodeBlock key={key++} code={codeLines.join("\n")} lang={parseLang(lines[i])} />);
        }
        i = j;
        inCodeBlock = false;
        continue;
      }
      continue;
    }
    if (inCodeBlock) continue;
    if (isTableLine(line) && isTableLine(lines[i + 1]) && i + 1 < lines.length) {
      // Collect the whole table block: data rows + separator row + data rows.
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && isTableRow(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }
      nodes.push(userMessage ? <Text key={key++}>{tableLines.join("\n")}</Text> : <TableBlock key={key++} lines={tableLines} />);
      i = j - 1;
      continue;
    }
    if (userMessage) {
      // User bubbles render as one flat text per line to avoid Android's
      // erratic line-break artifacts with many nested Text children
      // (e.g. "Hi br o" splitting). Bold markers are stripped and rendered plain.
      nodes.push(<Text key={key++}>{line.replace(/\*\*/g, "")}</Text>);
      if (i < lines.length - 1) nodes.push(<Text key={key++}>{"\n"}</Text>);
    } else {
      // Nested <Text> children must all be Text nodes — plain string children
      // inside a nested Text cause erratic line-break artifacts on Android.
      nodes.push(<Text key={key++}>{inlineFormat(line)}</Text>);
      if (i < lines.length - 1) nodes.push(<Text key={key++}>{"\n"}</Text>);
    }
  }
  return nodes;
}

function isTableLine(line: string): boolean {
  return /^\|[^|]*\|/.test(line.trim()) && line.trim().split("|").length >= 4;
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s:\-|]+\|/.test(line.trim());
}

function isTableRow(line: string): boolean {
  return isTableLine(line) || isSeparatorRow(line);
}

function parseRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * GitHub-flavored markdown table rendered as a bordered View grid.
 */
function TableBlock({ lines }: { lines: string[] }) {
  const colors = useColors();
  if (lines.length < 2) return null;
  const header = parseRow(lines[0]);
  const bodyRows = lines.slice(2).map(parseRow);
  return (
    <View
      style={[
        styles.table,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* Header row */}
      <View
        style={[
          styles.tableRow,
          { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        {header.map((cell, idx) => (
          <Text
            key={idx}
            className="font-bold text-foreground"
            style={[styles.tableCell, { fontSize: 12, lineHeight: 16 }]}
            numberOfLines={3}
          >
            {inlineFormat(cell)}
          </Text>
        ))}
      </View>
      {/* Body rows */}
      {bodyRows.map((row, r) => (
        <View
          key={r}
          style={[
            styles.tableRow,
            { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
          ]}
        >
          {row.map((cell, idx) => (
            <Text key={idx} style={[styles.tableCell, { fontSize: 12, lineHeight: 16 }]} numberOfLines={4}>
              {inlineFormat(cell)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function inlineFormat(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const parts = text.split(/(\*\*.+?\*\*|`[^`]+`|\$[^\$\n]+\$)/g);
  let key = 0;
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      nodes.push(
        <Text key={key++} className="font-bold">
          {part.slice(2, -2)}
        </Text>,
      );
    } else if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      nodes.push(
        <Text key={key++} style={{ fontFamily: "monospace", fontSize: 12 }}>
          {part.slice(1, -1)}
        </Text>,
      );
    } else if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      nodes.push(<MathInline key={key++} math={part.slice(1, -1)} />);
    } else {
      nodes.push(<Text key={key++}>{part}</Text>);
    }
  }
  return nodes;
}

const styles = StyleSheet.create({
  table: {
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 6,
    alignSelf: "stretch",
    overflow: "hidden",
  },
  math: {
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 6,
    alignSelf: "stretch",
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 4,
  },
  codeBlock: {
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 6,
    alignSelf: "stretch",
    overflow: "hidden",
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(128,128,128,0.2)",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  copyBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
  },
  codeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  previewSheet: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 90,
    bottom: 90,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(128,128,128,0.25)",
  },
  previewFrame: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});

/**
 * Live preview of an HTML code block rendered inside a WebView modal.
 */
function HtmlPreview({ visible, html, onClose }: { visible: boolean; html: string; onClose: () => void }) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.previewSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.previewHeader}>
          <Text className="text-foreground text-sm font-bold">Live Preview</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <IconSymbol name="xmark" size={20} color={colors.muted} />
          </Pressable>
        </View>
        {Platform.OS === "web" ? (
          <iframe srcDoc={html} style={styles.previewFrame as never} sandbox="allow-scripts" />
        ) : (
          <LazyWebFrame html={html} />
        )}
      </View>
    </Modal>
  );
}

/**
 * Renders the webview only when mounted, and resolves the native module lazily
 * so `react-native-webview` is NEVER registered at app startup (startup crash source).
 */
function LazyWebFrame({ html }: { html: string }) {
  const [Wv, setWv] = useState<React.ComponentType<{
    originWhitelist: string[];
    source: { html: string };
    style: Record<string, unknown>;
    scrollEnabled?: boolean;
    javaScriptEnabled?: boolean;
  }> | null>(null);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    setWv(require("react-native-webview").WebView);
  }, []);
  if (!Wv) return <View style={styles.previewFrame as never} />;
  return (
    <Wv
      originWhitelist={["*"]}
      source={{ html }}
      style={styles.previewFrame}
      scrollEnabled
      javaScriptEnabled
    />
  );
}


