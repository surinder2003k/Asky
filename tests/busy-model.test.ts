import { describe, it, expect } from "vitest";
import { setBusyModel, isModelBusy, subscribeBusyModel } from "../lib/busy-model";

describe("busy-model tracker", () => {
  it("starts idle and marks a model busy", () => {
    setBusyModel(null);
    expect(isModelBusy("groq/mixtral")).toBe(false);
    setBusyModel("groq/mixtral");
    expect(isModelBusy("groq/mixtral")).toBe(true);
    expect(isModelBusy("mistral/mistral-small-latest")).toBe(false);
    setBusyModel(null);
    expect(isModelBusy("groq/mixtral")).toBe(false);
  });

  it("notifies subscribers when the busy model changes", () => {
    setBusyModel(null);
    let count = 0;
    const unsub = subscribeBusyModel(() => {
      count++;
    });
    setBusyModel("groq/llama-3.3-70b");
    setBusyModel("groq/llama-3.3-70b"); // same value → no notify
    setBusyModel(null);
    expect(count).toBe(2);
    unsub();
    setBusyModel("mistral/mistral-small-latest");
    expect(count).toBe(2);
    setBusyModel(null);
  });
});
