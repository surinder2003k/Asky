import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";

import { useThemeContext } from "@/lib/theme-provider";

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * Respects the app theme (persisted in AsyncStorage, default dark) so the web preview
 * matches the native experience instead of following the browser/system scheme alone.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (!hasHydrated) {
    return "light";
  }

  // The ThemeProvider (always mounted) decides the real scheme; fall back to the
  // system scheme if the provider isn't available (shouldn't happen in this app).
  try {
    const ctx = useThemeContext();
    return ctx?.colorScheme ?? colorScheme ?? "light";
  } catch {
    return colorScheme ?? "light";
  }
}
