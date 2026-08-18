import { useEffect, useState } from "react";

import { Colors, type ColorScheme, type ThemeColorPalette } from "@/constants/theme";
import { getAccentColor, subscribeAccent } from "@/lib/accent-store";
import { useColorScheme } from "./use-color-scheme";

/**
 * Returns the current theme's color palette with the user's accent color
 * blended in (when one is chosen in Settings).
 */
export function useColors(colorSchemeOverride?: ColorScheme): ThemeColorPalette {
  const colorSchema = useColorScheme();
  const scheme = (colorSchemeOverride ?? colorSchema ?? "light") as ColorScheme;
  const [, rerender] = useState(0);

  useEffect(() => {
    return subscribeAccent(() => rerender((n) => n + 1));
  }, []);

  const palette = Colors[scheme];
  const accent = getAccentColor();
  if (accent) {
    return {
      ...palette,
      primary: accent,
      tint: accent,
      tabIconSelected: accent,
    };
  }
  return palette;
}
