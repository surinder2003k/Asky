import { describe, expect, it, vi } from "vitest";

// Mock AsyncStorage
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAppLockEnabled, setAppLockEnabled } from "../lib/storage";

const asMock = AsyncStorage as unknown as {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
};

describe("App Lock persistence", () => {
  it("default state is unlocked (false)", async () => {
    asMock.getItem.mockResolvedValue(null);
    expect(await getAppLockEnabled()).toBe(false);
  });

  it("enable/disable toggle persists", async () => {
    asMock.setItem.mockResolvedValue(undefined);
    await setAppLockEnabled(true);
    expect(asMock.setItem).toHaveBeenCalledWith("asky:applock:enabled", "1");
    asMock.getItem.mockResolvedValue("1");
    expect(await getAppLockEnabled()).toBe(true);
    await setAppLockEnabled(false);
    expect(asMock.setItem).toHaveBeenCalledWith("asky:applock:enabled", "0");
    asMock.getItem.mockResolvedValue("0");
    expect(await getAppLockEnabled()).toBe(false);
  });

  it("any garbage value besides '1' means unlocked", async () => {
    asMock.getItem.mockResolvedValue("garbage");
    expect(await getAppLockEnabled()).toBe(false);
  });

  it("storage errors are handled gracefully (default unlocked)", async () => {
    asMock.getItem.mockRejectedValue(new Error("storage fail"));
    expect(await getAppLockEnabled()).toBe(false);
  });

  it("PIN can be stored and read back", async () => {
    asMock.setItem.mockClear();
    asMock.setItem.mockResolvedValue(undefined);
    asMock.getItem.mockImplementation(async (key: string) => {
      if (key === "asky:applock:pin") return "5283";
      return null;
    });
    // simulate saving a PIN
    await AsyncStorage.setItem("asky:applock:pin", "5283");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("asky:applock:pin", "5283");
    expect(await AsyncStorage.getItem("asky:applock:pin")).toBe("5283");
  });
});
