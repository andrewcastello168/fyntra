import * as SecureStore from "expo-secure-store";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

type BalanceVisibilityContextValue = {
  isBalanceVisible: boolean;
  toggleBalanceVisibility: () => void;
};

const BalanceVisibilityContext = createContext<BalanceVisibilityContextValue | null>(null);
const STORAGE_KEY = "balanceVisibility";

async function readPreference() {
  if (Platform.OS === "web" && typeof globalThis.localStorage !== "undefined") {
    return globalThis.localStorage.getItem(STORAGE_KEY);
  }
  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function writePreference(value: boolean) {
  if (Platform.OS === "web" && typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.setItem(STORAGE_KEY, String(value));
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, String(value));
}

export function BalanceVisibilityProvider({ children }: PropsWithChildren) {
  const [isBalanceVisible, setBalanceVisible] = useState(false);

  useEffect(() => {
    void readPreference().then((stored) => {
      if (stored === "true") setBalanceVisible(true);
    });
  }, []);

  function toggleBalanceVisibility() {
    setBalanceVisible((current) => {
      const next = !current;
      void writePreference(next);
      return next;
    });
  }

  const value = useMemo(
    () => ({ isBalanceVisible, toggleBalanceVisibility }),
    [isBalanceVisible],
  );

  return (
    <BalanceVisibilityContext.Provider value={value}>
      {children}
    </BalanceVisibilityContext.Provider>
  );
}

export function useBalanceVisibility() {
  const context = useContext(BalanceVisibilityContext);
  if (!context) {
    throw new Error("useBalanceVisibility must be used inside BalanceVisibilityProvider");
  }
  return context;
}

export function maskBalance() {
  return "••••••";
}
