import React from "react";
import { Text, type TextStyle } from "react-native";

/**
 * Renders text with matches of `query` highlighted in `highlightColor`.
 * Case-insensitive matching; safe for any query string (regex-escaped).
 * Falls back to plain text when there is no query or no match.
 */
export function HighlightedText({
  text,
  query,
  highlightColor,
  className,
  style,
  numberOfLines,
}: {
  text: string;
  query: string;
  highlightColor: string;
  className?: string;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const q = query.trim();
  if (!q || !text) {
    return (
      <Text className={className} style={style} numberOfLines={numberOfLines} ellipsizeMode="tail">
        {text}
      </Text>
    );
  }
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(safe, "gi");
  const parts = text.split(re);
  const matches = text.match(re) ?? [];

  if (matches.length === 0) {
    return (
      <Text className={className} style={style} numberOfLines={numberOfLines} ellipsizeMode="tail">
        {text}
      </Text>
    );
  }

  return (
    <Text className={className} style={style} numberOfLines={numberOfLines} ellipsizeMode="tail">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {matches[i] !== undefined && (
            <Text style={{ backgroundColor: highlightColor + "33", color: highlightColor, fontWeight: "600" }}>
              {matches[i]}
            </Text>
          )}
        </React.Fragment>
      ))}
    </Text>
  );
}
