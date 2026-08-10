import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  apiFetch,
  clearSession,
  getStoredAccessToken,
  saveSession,
} from "@/src/api/client";

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
  register: (data: RegisterData) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  restoreWithAccessToken: (accessToken: string) => Promise<void>;
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

    const result = await apiFetch<MeResponse>("/auth/me", {}, token);

    setUser(result.user);
  };

  const restoreWithAccessToken = async (accessToken: string) => {
    const result = await apiFetch<MeResponse>("/auth/me", {}, accessToken);
    setUser(result.user);
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

      setUser(result.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login gagal.";

      setError(message);
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
      await clearSession().catch(() => undefined);
      setUser(null);
      setError(null);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await refreshUser();
      } catch {
        await clearSession();
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
      register,
      refreshUser,
      restoreWithAccessToken,
      logout,
    }),
    [user, isLoading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }

  return context;
}
