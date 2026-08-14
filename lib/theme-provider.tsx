import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";
import { getAccent, setAccent, type AccentKey } from "@/lib/storage";
import { getScheme, setScheme } from "@/lib/storage";
import { getColorTheme, type ColorTheme } from "@/lib/storage";
import { setAccentOverride } from "@/lib/accent-store";

/** OLED black and Sepia overrides applied on top of the dark scheme. */
const COLOR_THEME_OVERRIDES: Record<ColorTheme, Record<string, string>> = {
  default: {},
  oled: {
    background: "#000000",
    surface: "#111111",
    border: "#2c2c2e",
  },
  sepia: {
    background: "#f4ecd8",
    surface: "#eaddc5",
    foreground: "#433422",
    muted: "#8a7458",
    border: "#d9c9ac",
  },
};

export const ACCENT_PALETTES: Record<AccentKey, { light: string; dark: string }> = {
  teal: { light: "#0d9488", dark: "#2dd4bf" },
  blue: { light: "#2563eb", dark: "#60a5fa" },
  purple: { light: "#7c3aed", dark: "#a78bfa" },
};

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  accent: AccentKey;
  setAccent: (accent: AccentKey) => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("dark");
  const [accent, setAccentState] = useState<AccentKey>("teal");
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("default");
  const [loaded, setLoaded] = useState(false);

  const applyScheme = useCallback((scheme: ColorScheme) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    applyScheme(scheme);
    void setScheme(scheme);
    void getAccent().then((a) => setAccentOverride(a, scheme));
  }, [applyScheme]);

  const applyColorTheme = useCallback(
    (scheme: ColorScheme, theme: ColorTheme) => {
      if (typeof document !== "undefined") {
        const overrides = COLOR_THEME_OVERRIDES[theme] ?? {};
        for (const [token, value] of Object.entries(overrides)) {
          document.documentElement.style.setProperty(`--color-${token}`, value);
        }
      }
    },
    [],
  );

  const setColorTheme = useCallback((theme: ColorTheme) => {
    setColorThemeState(theme);
    void getColorThemePersist(theme);
    applyColorTheme(colorScheme, theme);
  }, [applyColorTheme, colorScheme]);

  useEffect(() => {
    if (!loaded) return;
    applyScheme(colorScheme);
  }, [applyScheme, colorScheme, loaded]);

  // Load persisted scheme once on mount (default "dark", ChatGPT-style), then follow system only if never chosen.
  useEffect(() => {
    // Apply dark immediately so the web hydration doesn't flash/lock to light
    // before the async read resolves (also matches native default).
    applyScheme("dark");
    void getScheme().then((stored) => {
      const next: ColorScheme = stored === "system" ? (systemScheme ?? "dark") : stored === "light" ? "light" : "dark";
      setColorSchemeState(next);
      applyScheme(next);
      void getColorTheme().then((t) => {
        setColorThemeState(t);
        applyColorTheme(next, t);
        setLoaded(true);
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function getColorThemePersist(theme: ColorTheme): Promise<void> {
    try {
      const storage = await import("@/lib/storage");
      await storage.setColorTheme(theme);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    getAccent().then((a) => {
      setAccentState(a);
      setAccentOverride(a, colorScheme);
      if (typeof document !== "undefined" && ACCENT_PALETTES[a]) {
        document.documentElement.style.setProperty(
          "--color-primary",
          colorScheme === "dark" ? ACCENT_PALETTES[a].dark : ACCENT_PALETTES[a].light,
        );
      }
    });
  }, [colorScheme]);

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": ACCENT_PALETTES[accent]?.[colorScheme] ?? SchemeColors[colorScheme].primary,
        "color-background": SchemeColors[colorScheme].background,
        "color-surface": SchemeColors[colorScheme].surface,
        "color-foreground": SchemeColors[colorScheme].foreground,
        "color-muted": SchemeColors[colorScheme].muted,
        "color-border": SchemeColors[colorScheme].border,
        "color-success": SchemeColors[colorScheme].success,
        "color-warning": SchemeColors[colorScheme].warning,
        "color-error": SchemeColors[colorScheme].error,
      }),
    [colorScheme, accent],
  );

  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
      accent,
      setAccent: (a: AccentKey) => {
        setAccentState(a);
        void setAccent(a);
        setAccentOverride(a, colorScheme);
        if (typeof document !== "undefined") {
          document.documentElement.style.setProperty(
            "--color-primary",
            colorScheme === "dark" ? ACCENT_PALETTES[a].dark : ACCENT_PALETTES[a].light,
          );
        }
      },
      colorTheme,
      setColorTheme,
    }),
    [colorScheme, setColorScheme, accent, colorTheme, setColorTheme],
  );
  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
