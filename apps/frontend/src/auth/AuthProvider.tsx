import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert, Platform } from "react-native";

import {
  ApiError,
  apiFetch,
  clearActiveSession,
  getStoredAccessToken,
  getStoredRefreshToken,
  saveSession,
} from "@/src/api/client";
import {
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricSession,
  hasBiometricLogin,
  isBiometricAuthenticationSupported,
  updateBiometricSession,
} from "@/src/auth/biometric";

export type User = {
  id: string;
  email: string;
  emailConfirmedAt?: string | null;
  profile?: {
    full_name?: string;
    username?: string | null;
  } | null;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

type MeResponse = {
  user: User;
};

type RegisterData = {
  email: string;
  password: string;
  fullName: string;
  username?: string;
};

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;

  login: (email: string, password: string) => Promise<void>;
  loginWithBiometrics: () => Promise<void>;
  register: (data: RegisterData) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clearError = () => setError(null);

  const refreshUser = async () => {
    const token = await getStoredAccessToken();

    if (!token) {
      setUser(null);
      return;
    }

    try {
      const result = await apiFetch<MeResponse>("/auth/me", {}, token);
      setUser(result.user);
    } catch (error) {
      const refreshToken = await getStoredRefreshToken();
      const requiresBiometrics = await hasBiometricLogin();

      if (
        !(error instanceof ApiError) ||
        error.status !== 401 ||
        !refreshToken ||
        requiresBiometrics
      ) {
        throw error;
      }

      const result = await refreshSession(refreshToken);
      setUser(result.user);
    }
  };

  const login = async (email: string, password: string) => {
    setError(null);

    try {
      const result = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          type: process.env.EXPO_PUBLIC_APP_ENV ?? "sim",
        }),
      });

      await saveSession(result.accessToken, result.refreshToken);

      try {
        const supportsBiometrics = await isBiometricAuthenticationSupported();
        const belongsToCurrentUser = await hasBiometricLogin(result.user.id);
        const belongsToAnotherUser =
          !belongsToCurrentUser && (await hasBiometricLogin());

        if (belongsToAnotherUser) await disableBiometricLogin();

        if (supportsBiometrics && !belongsToCurrentUser) {
          const shouldEnable = await confirmBiometricEnrollment();

          if (shouldEnable) {
            const enabled = await enableBiometricLogin({
              refreshToken: result.refreshToken,
              userId: result.user.id,
            });

            if (!enabled) {
              Alert.alert(
                "Biometric login not enabled",
                "You can continue using Personal Tracker and enable it later in Settings.",
              );
            }
          }
        }
      } catch {
        // Biometric enrollment must never prevent a successful password login.
      }

      setUser(result.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login gagal.";

      setError(message);
      throw error;
    }
  };

  const loginWithBiometrics = async () => {
    setError(null);
    const biometricSession = await getBiometricSession();

    if (!biometricSession) {
      throw new Error(
        "Biometric login is no longer available. Sign in with your password.",
      );
    }

    try {
      const result = await refreshSession(biometricSession.refreshToken);

      try {
        await updateBiometricSession({
          refreshToken: result.refreshToken,
          userId: result.user.id,
        });
      } catch {
        await disableBiometricLogin().catch(() => undefined);
      }

      setUser(result.user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await disableBiometricLogin().catch(() => undefined);
        await clearActiveSession().catch(() => undefined);
      }
      throw error;
    }
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    setError(null);

    try {
      const result = await apiFetch<AuthResponse | { session: null }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            ...data,
            type: process.env.EXPO_PUBLIC_APP_ENV ?? "sim",
          }),
        },
      );

      if (
        "accessToken" in result &&
        result.accessToken &&
        result.refreshToken
      ) {
        await saveSession(result.accessToken, result.refreshToken);

        setUser(result.user);

        return true;
      }

      return false;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sign-up failed.";

      setError(message);
      throw error;
    }
  };

  const logout = async () => {
    let token: string | null = null;
    try {
      token = await getStoredAccessToken();
    } catch {
      // Continue with local cleanup if storage is unavailable.
    }
    try {
      if (token) {
        await apiFetch("/auth/logout", { method: "POST" }, token);
      }
    } catch {
      // A missing or expired remote session is already logged out remotely.
    } finally {
      await Promise.all([
        clearActiveSession().catch(() => undefined),
        disableBiometricLogin().catch(() => undefined),
      ]);
      setUser(null);
      setError(null);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await refreshUser();
      } catch {
        await clearActiveSession();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void initializeAuth();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      error,
      clearError,
      login,
      loginWithBiometrics,
      register,
      refreshUser,
      logout,
    }),
    [user, isLoading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function refreshSession(refreshToken: string) {
  const result = await apiFetch<AuthResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({
      refreshToken,
      type: process.env.EXPO_PUBLIC_APP_ENV ?? "sim",
    }),
  });

  await saveSession(result.accessToken, result.refreshToken);
  return result;
}

function confirmBiometricEnrollment() {
  if (Platform.OS === "web") return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    Alert.alert(
      "Enable biometric login on this device?",
      "Use Face ID, Touch ID, or your device fingerprint next time. Your password and biometric data are never stored by Personal Tracker.",
      [
        { text: "Not now", style: "cancel", onPress: () => finish(false) },
        { text: "Enable", onPress: () => finish(true) },
      ],
      { cancelable: true, onDismiss: () => finish(false) },
    );
  });
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }

  return context;
}
