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
  profile?: { full_name?: string; username?: string | null } | null;
};
type AuthResponse = { accessToken: string; refreshToken: string; user: User };
type MeResponse = { user: User };
type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    fullName: string;
    username?: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getStoredAccessToken();
        if (token)
          setUser((await apiFetch<MeResponse>("/auth/me", {}, token)).user);
      } catch {
        await clearSession();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      error,
      login: async (email, password) => {
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
        } catch (e) {
          const message = e instanceof Error ? e.message : "Login gagal.";
          setError(message);
          throw e;
        }
      },
      register: async (data) => {
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
        } catch (e) {
          const message = e instanceof Error ? e.message : "Sign-up failed.";
          setError(message);
          throw e;
        }
      },
      logout: async () => {
        await clearSession();
        setUser(null);
        setError(null);
      },
    }),
    [user, isLoading, error],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  return context;
}
