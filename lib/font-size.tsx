import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { getFontSizeChoice, setFontSizeChoice, type FontSizeChoice } from "@/lib/storage";

export const FONT_SIZES: Record<FontSizeChoice, number> = {
  small: 14,
  medium: 16,
  large: 19,
};

type FontSizeContextValue = {
  fontSizeChoice: FontSizeChoice;
  fontSize: number;
  setFontSizeChoice: (size: FontSizeChoice) => void;
};

const FontSizeContext = createContext<FontSizeContextValue | null>(null);

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoice] = useState<FontSizeChoice>("medium");
  const [fontSize, setFontSize] = useState(FONT_SIZES.medium);

  useEffect(() => {
    getFontSizeChoice().then((c) => {
      setChoice(c);
      setFontSize(FONT_SIZES[c]);
    });
  }, []);

  const setFontSizeChoiceCb = useCallback((size: FontSizeChoice) => {
    setChoice(size);
    setFontSize(FONT_SIZES[size]);
    void persistFontSizeChoice(size);
  }, []);

  return (
    <FontSizeContext.Provider value={{ fontSizeChoice: choice, fontSize, setFontSizeChoice: setFontSizeChoiceCb }}>
      {children}
    </FontSizeContext.Provider>
  );
}

async function persistFontSizeChoice(size: FontSizeChoice): Promise<void> {
  try {
    await setFontSizeChoice(size);
  } catch {
    // storage unavailable — keep the in-memory choice
  }
}

export function useFontSize(): FontSizeContextValue {
  const ctx = useContext(FontSizeContext);
  if (!ctx) {
    throw new Error("useFontSize must be used within FontSizeProvider");
  }
  return ctx;
}
