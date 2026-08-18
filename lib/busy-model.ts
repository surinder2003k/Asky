/**
 * Global busy-model tracker.
 *
 * Because the app renders ONE screen at a time, "sessions" are logical:
 * a model is considered BUSY when a stream is actively generating with it
 * anywhere in the app. Other chats must not pick that model while it's busy
 * (rate limits would error). When idle, it's available again.
 *
 * Module-level state + simple emitter so any screen (picker) can subscribe.
 */

type Listener = () => void;

let busyKey: string | null = null;
const listeners = new Set<Listener>();

export function setBusyModel(key: string | null): void {
  if (busyKey === key) return;
  busyKey = key;
  listeners.forEach((l) => l());
}

export function getBusyModel(): string | null {
  return busyKey;
}

export function isModelBusy(modelKey: string): boolean {
  return busyKey === modelKey;
}

export function subscribeBusyModel(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
