declare module "react-native-netinfo" {
  export interface NetInfoState {
    type: "none" | "wifi" | "cellular" | "unknown";
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    details: Record<string, unknown> | null;
  }

  export function fetch(): Promise<NetInfoState>;
  export function addEventListener(listener: (state: NetInfoState) => void): () => void;
  export type NetInfoSubscription = () => void;
}
