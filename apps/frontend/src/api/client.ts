import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
export const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? "sim";
const BIOMETRIC_ACCESS_TOKEN_KEY = "biometricAccessToken";
const BIOMETRIC_ENABLED_KEY = "biometricEnabled";

type ApiErrorBody = { message?: string | string[] };

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
  if (!API_BASE_URL) throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const body = (await response.json()) as ApiErrorBody;
      message = Array.isArray(body.message)
        ? body.message.join(" ")
        : (body.message ?? message);
    } catch {
      /* response may not contain JSON */
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

export async function getStoredAccessToken() {
  return SecureStore.getItemAsync("accessToken");
}
export async function saveSession(accessToken: string, refreshToken: string) {
  await Promise.all([
    SecureStore.setItemAsync("accessToken", accessToken),
    SecureStore.setItemAsync("refreshToken", refreshToken),
  ]);
  if (Platform.OS !== "web") {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY, accessToken, {
        requireAuthentication: true,
      });
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
    } catch {
      await Promise.all([
        SecureStore.deleteItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
      ]);
    }
  }
}

export async function hasBiometricCredential() {
  if (Platform.OS === "web") return false;
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === "true";
}

export async function getBiometricAccessToken() {
  if (Platform.OS === "web") return null;
  return SecureStore.getItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY, {
    requireAuthentication: true,
  });
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync("accessToken"),
    SecureStore.deleteItemAsync("refreshToken"),
    SecureStore.deleteItemAsync(BIOMETRIC_ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY),
  ]);
}
