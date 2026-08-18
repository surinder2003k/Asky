import { ACCENT_PALETTES } from "@/lib/theme-provider";
import type { ColorScheme } from "@/constants/theme";
import type { AccentKey } from "@/lib/storage";

/**
 * Tiny shared store for the persisted accent color.
 *
 * Why: `useColors()` returns the static palette from theme.config.js, so any
 * JS style that uses `colors.primary` (composer buttons, avatars, chips) never
 * sees the user's accent choice. This store bridges the gap: the ThemeProvider
 * writes the chosen accent here, and `useColors()` blends the accent over the
 * loaded palette.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

let currentAccent: AccentKey | null = null;
let currentScheme: ColorScheme = "dark";

export function setAccentOverride(accent: AccentKey, scheme: ColorScheme): void {
  if (currentAccent === accent && currentScheme === scheme) return;
  currentAccent = accent;
  currentScheme = scheme;
  listeners.forEach((l) => l());
}

export function subscribeAccent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Blended accent color for the current scheme, or null when no override. */
export function getAccentColor(): string | null {
  if (!currentAccent) return null;
  return ACCENT_PALETTES[currentAccent]?.[currentScheme] ?? null;
}
