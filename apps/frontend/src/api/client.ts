import * as SecureStore from "expo-secure-store";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
export const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? "sim";
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

type ApiErrorBody = { message?: string | string[] };
type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};
type SessionInvalidHandler = () => void | Promise<void>;

let refreshPromise: Promise<string> | null = null;
let sessionInvalidHandler: SessionInvalidHandler | null = null;
let invalidationPromise: Promise<void> | null = null;
let sessionInvalidated = false;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  return request<T>(path, options, accessToken, false);
}

async function request<T>(
  path: string,
  options: RequestInit,
  accessToken: string | undefined,
  hasRetried: boolean,
): Promise<T> {
  if (!API_BASE_URL) throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && accessToken) {
    if (hasRetried) {
      await invalidateSession();
    } else {
      const nextAccessToken = await recoverAccessToken(accessToken);
      return request<T>(path, options, nextAccessToken, true);
    }
  }

  if (!response.ok) {
    throw await apiErrorFromResponse(response);
  }
  return (await response.json()) as T;
}

async function recoverAccessToken(failedAccessToken: string) {
  const currentAccessToken = await getStoredAccessToken();
  if (currentAccessToken && currentAccessToken !== failedAccessToken) {
    return currentAccessToken;
  }

  if (!refreshPromise) {
    refreshPromise = refreshStoredSession().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function refreshStoredSession() {
  try {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) {
      throw new ApiError(
        "Your session has expired. Please sign in again.",
        401,
      );
    }

    const result = await request<RefreshResponse>(
      "/auth/refresh",
      {
        method: "POST",
        body: JSON.stringify({ refreshToken, type: APP_ENV }),
      },
      undefined,
      true,
    );
    await saveSession(result.accessToken, result.refreshToken);
    return result.accessToken;
  } catch (error) {
    await invalidateSession();
    throw error;
  }
}

async function invalidateSession() {
  if (sessionInvalidated) return invalidationPromise ?? Promise.resolve();
  sessionInvalidated = true;
  invalidationPromise = (async () => {
    await clearActiveSession().catch(() => undefined);
    await sessionInvalidHandler?.();
  })().finally(() => {
    invalidationPromise = null;
  });
  return invalidationPromise;
}

async function apiErrorFromResponse(response: Response) {
  let message = "Something went wrong. Please try again.";
  try {
    const body = (await response.json()) as ApiErrorBody;
    message = Array.isArray(body.message)
      ? body.message.join(" ")
      : (body.message ?? message);
  } catch {
    /* response may not contain JSON */
  }
  return new ApiError(message, response.status);
}

export function setSessionInvalidHandler(handler: SessionInvalidHandler) {
  sessionInvalidHandler = handler;
  return () => {
    if (sessionInvalidHandler === handler) sessionInvalidHandler = null;
  };
}

export async function getStoredAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}
export async function getStoredRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}
export async function saveSession(accessToken: string, refreshToken: string) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
  sessionInvalidated = false;
}

export async function clearActiveSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
