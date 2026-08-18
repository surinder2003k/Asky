import { useEffect, useState } from "react";

import { type ChatMode } from "@/lib/modes";
import { getConversation, setConversationMode } from "@/lib/storage";

/** Reads/writes the active chat's mode flags from storage. */
export function useChatModeFlags(chatId: string | null) {
  const [mode, setMode] = useState<ChatMode>("normal");
  const [targetLanguage, setTargetLanguage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!chatId) {
      setMode("normal");
      setTargetLanguage(undefined);
      return;
    }
    let active = true;
    void getConversation(chatId).then((conv) => {
      if (!active) return;
      setMode(conv?.chatMode ?? "normal");
      setTargetLanguage(conv?.translateTarget ?? undefined);
    });
    return () => {
      active = false;
    };
  }, [chatId]);

  const setModeForChat = async (next: ChatMode, target?: string) => {
    if (!chatId) return;
    setMode(next);
    setTargetLanguage(target);
    await setConversationMode(chatId, next, target);
  };

  return { mode, targetLanguage, setModeForChat };
}
