import { useEffect, useState } from "react";
import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from "react-native-netinfo";

/**
 * Lightweight connectivity watcher. `isConnected` is true when the device
 * reports internet reachability. Used by the chat screen to auto-flush the
 * offline message draft queue when the network returns.
 */
export function useConnectivity() {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    let sub: NetInfoSubscription | null = null;
    (async () => {
      try {
        const state = await NetInfo.fetch();
        if (!mounted) return;
        setIsConnected(!!state.isConnected);
        sub = NetInfo.addEventListener((s: NetInfoState) => {
          if (!mounted) return;
          setIsConnected(!!s.isConnected);
        });
      } catch {
        // web or unavailable — assume online
        if (!mounted) return;
        setIsConnected(true);
      }
    })();
    return () => {
      mounted = false;
      sub?.();
    };
  }, []);

  return isConnected;
}
