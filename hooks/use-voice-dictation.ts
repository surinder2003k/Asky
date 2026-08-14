import { useCallback, useRef, useState } from "react";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";

/**
 * Voice dictation hook built on expo-speech-recognition (SDK 54).
 * Provides a mic toggle that appends spoken transcript to an editable text.
 * Returns isListening flag, toggle function, and last error message.
 */
export function useVoiceDictation() {
  const [isListening, setIsListening] = useState(false);
  const [dictError, setDictError] = useState<string | null>(null);
  const transcriptRef = useRef("");
  const onTranscriptRef = useRef<((text: string) => void) | null>(null);

  useSpeechRecognitionEvent("result", (event) => {
    const partial = event.results?.[0]?.transcript ?? "";
    transcriptRef.current = partial;
    // Only commit FINAL transcripts to the composer; interim updates are
    // ignored to avoid duplicated/appended partial text in the input.
    if (event.isFinal && partial.trim()) {
      onTranscriptRef.current?.(partial);
      // Final transcript committed; reset for the next segment.
      transcriptRef.current = "";
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    // On Android, calling stop()/abort() reliably fires an 'error' event with
    // message like "Speech recognition aborted." — that is expected, not a bug.
    const msg = event.message || "Speech recognition failed";
    if (/abort/i.test(msg)) {
      return;
    }
    setDictError(msg);
    setIsListening(false);
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    transcriptRef.current = "";
  });

  const toggleDictation = useCallback(
    async (onFinalTranscript: (text: string) => void) => {
      setDictError(null);
      if (isListening) {
        ExpoSpeechRecognitionModule.abort();
        setIsListening(false);
        return;
      }
      onTranscriptRef.current = onFinalTranscript;
      transcriptRef.current = "";
      try {
        ExpoSpeechRecognitionModule.start({
          lang: "en-US",
          interimResults: true,
          continuous: false,
          addsPunctuation: true,
        });
        setIsListening(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not start dictation";
        setDictError(msg);
        setIsListening(false);
      }
    },
    [isListening],
  );

  const stopDictation = useCallback(() => {
    ExpoSpeechRecognitionModule.abort();
    setIsListening(false);
    transcriptRef.current = "";
  }, []);

  return { isListening, dictError, toggleDictation, stopDictation };
}
