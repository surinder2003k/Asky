// Specialized chat modes — each mode can modify system prompt behavior.
// Mode settings are stored per-chat in Conversation.modeFlags.

import { getTranslationPrompt, getMathSolverPrompt, getDeepResearchPrompt, getThinkingPrompt, getScreenshotToCodePrompt } from "@/lib/ai";

export type ChatMode =
  | "normal"
  | "deep_research" // Deep Research: thorough multi-section report style
  | "thinking" // Extended multi-step thinking before the answer
  | "translator" // Auto-translate into target language
  | "math" // Math tutor with LaTeX rendering
  | "screenshot_to_code"; // UI design → HTML code

export interface ModeFlags {
  mode: ChatMode;
  targetLanguage?: string; // for translator
}

export const MODE_LABELS: Record<ChatMode, string> = {
  normal: "Normal",
  deep_research: "Deep Research",
  thinking: "Thinking",
  translator: "Translator",
  math: "Math Solver",
  screenshot_to_code: "Design to Code",
};

export const MODE_DESCRIPTIONS: Record<ChatMode, string> = {
  normal: "Regular chat with the selected model.",
  deep_research: "In-depth structured research report on the topic.",
  thinking: "Model reasons step by step before answering.",
  translator: "Translates your messages into a chosen language.",
  math: "Solves math problems step by step with rendered equations.",
  screenshot_to_code: "Send a UI screenshot to get recreating HTML code.",
};

export const TRANSLATE_TARGETS = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Korean",
  "Chinese (Simplified)",
  "Arabic",
  "Portuguese",
  "Russian",
  "Turkish",
];

/** Returns the mode system-prompt suffix. Normal mode returns "" (no suffix). */
export function getModePrompt(chatMode?: ChatMode, targetLanguage?: string): string {
  switch (chatMode) {
    case "deep_research":
      return "\n\n" + getDeepResearchPrompt();
    case "thinking":
      return "\n\n" + getThinkingPrompt();
    case "translator":
      return "\n\n" + getTranslationPrompt(targetLanguage ?? "English");
    case "math":
      return "\n\n" + getMathSolverPrompt();
    case "screenshot_to_code":
      return "\n\n" + getScreenshotToCodePrompt();
    default:
      return "";
  }
}
