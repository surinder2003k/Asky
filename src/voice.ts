/**
 * Voice input via the Web Speech API (SpeechRecognition).
 * Works in Chrome/Edge/Safari (desktop & mobile). Falls back gracefully
 * when the API is unavailable — the mic button stays hidden.
 */

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: unknown) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

export function speechSupported(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return typeof w.SpeechRecognition === "function" || typeof w.webkitSpeechRecognition === "function";
}

export function createRecognition(langCode?: string): SpeechRecognitionLike | null {
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as RecognitionCtor | undefined;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = langCode || "en-IN";
  return rec;
}

export const VOICE_LANGUAGES = [
  { key: "en", label: "English", code: "en-IN" },
  { key: "hi", label: "Hindi", code: "hi-IN" },
  { key: "hinglish", label: "Hinglish", code: "en-IN" },
] as const;

export type VoiceLanguageKey = (typeof VOICE_LANGUAGES)[number]["key"];

export function getVoiceLanguageCode(key: VoiceLanguageKey | undefined): string {
  const found = VOICE_LANGUAGES.find((l) => l.key === key);
  return found ? found.code : "en-IN";
}

export type VoiceStatus = "idle" | "listening" | "error";

export function readTranscript(ev: unknown): { transcript: string; isFinal: boolean } {
  const e = ev as { results?: { length?: number } & Record<number, { isFinal: boolean; [k: number]: { transcript?: string } }> };
  let transcript = "";
  let isFinal = false;
  const results = e?.results;
  if (!results) return { transcript, isFinal };
  for (let i = 0; i < (results.length ?? 0); i++) {
    const r = results[i];
    if (!r) continue;
    const item = r[0];
    if (item?.transcript) transcript += item.transcript;
    if (r.isFinal) isFinal = true;
  }
  return { transcript, isFinal };
}
