import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { AppState, AppStateStatus, Platform } from "react-native";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type BalanceVisibilityContextValue = {
  isBalanceVisible: boolean;
  hideBalancesByDefault: boolean;
  setHideBalancesByDefault: (value: boolean) => Promise<void>;
  unlockBalances: () => Promise<boolean>;
  lockBalances: () => void;
  showBalances: () => void;
};

const BalanceVisibilityContext =
  createContext<BalanceVisibilityContextValue | null>(null);
const STORAGE_KEY = "hideBalancesByDefault";

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
  const [hideBalancesByDefault, setHideBalances] = useState(false);

  useEffect(() => {
    void readPreference().then((stored) => {
      const hidden = stored === "true";
      setHideBalances(hidden);
      setBalanceVisible(!hidden);
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        if (next !== "active") setBalanceVisible(false);
      },
    );
    return () => subscription.remove();
  }, []);

  const setHideBalancesByDefault = useCallback(async (value: boolean) => {
    setHideBalances(value);
    setBalanceVisible(!value);
    await writePreference(value);
  }, []);

  const showBalances = useCallback(() => {
    setBalanceVisible(true);
  }, []);

  const unlockBalances = useCallback(async () => {
    if (isBalanceVisible) return true;
    if (Platform.OS === "web") {
      setBalanceVisible(true);
      return true;
    }
    if (
      !(await LocalAuthentication.hasHardwareAsync()) ||
      !(await LocalAuthentication.isEnrolledAsync())
    ) {
      return false;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock balances",
      cancelLabel: "Keep hidden",
      disableDeviceFallback: false,
    });
    if (!result.success) return false;
    setBalanceVisible(true);
    return true;
  }, [isBalanceVisible]);

  const lockBalances = useCallback(() => {
    setBalanceVisible(false);
  }, []);

  const value = useMemo(
    () => ({
      isBalanceVisible,
      hideBalancesByDefault,
      setHideBalancesByDefault,
      unlockBalances,
      lockBalances,
      showBalances,
    }),
    [
      isBalanceVisible,
      hideBalancesByDefault,
      setHideBalancesByDefault,
      unlockBalances,
      lockBalances,
      showBalances,
    ],
  );

  return (
    <BalanceVisibilityContext.Provider value={value}>
      {children}
    </BalanceVisibilityContext.Provider>
  );
}

export function useBalanceVisibility() {
  const context = useContext(BalanceVisibilityContext);
  if (!context)
    throw new Error(
      "useBalanceVisibility must be used inside BalanceVisibilityProvider",
    );
  return context;
}

export function maskBalance() {
  return "••••••••";
}
