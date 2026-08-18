import { useState } from "react";
import { Lock, Delete } from "lucide-react";
import { hashPin } from "../store";

export default function PinScreen({
  pinHash,
  onUnlock,
}: {
  pinHash: number;
  onUnlock: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = (v: string) => {
    if (hashPin(v) === pinHash) {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => {
        setValue("");
        setError(false);
      }, 600);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-8 bg-[var(--asky-bg)] p-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--asky-accent-soft)]">
        <Lock size={28} className="text-[var(--asky-accent)]" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Asky is locked</h2>
        <p className="mt-1 text-sm text-[var(--asky-fg-muted)]">Enter your PIN to continue</p>
      </div>
      <div className="flex gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
              i < value.length
                ? error
                  ? "border-red-400 bg-red-400"
                  : "border-[var(--asky-accent)] bg-[var(--asky-accent)]"
                : "border-[var(--asky-border)]"
            }`}
          />
        ))}
      </div>
      <div className="grid w-56 grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"].map((k) => (
          <button
            key={k}
            onClick={() => {
              if (k === "del") {
                setValue((v) => v.slice(0, -1));
              } else if (k === "ok") {
                if (value.length >= 4) submit(value);
              } else {
                const next = value.length < 6 ? value + k : value;
                setValue(next);
                if (next.length >= 4) submit(next);
              }
            }}
            className="flex h-14 items-center justify-center rounded-full border border-[var(--asky-border)] text-lg font-medium hover:bg-white/5 active:scale-95"
          >
            {k === "del" ? <Delete size={18} /> : k === "ok" ? "✓" : k}
          </button>
        ))}
      </div>
    </div>
  );
}
