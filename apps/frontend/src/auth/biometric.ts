import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BIOMETRIC_SESSION_KEY = "biometricSession.v2";
const BIOMETRIC_OWNER_KEY = "biometricOwner.v2";
const LEGACY_BIOMETRIC_ACCESS_TOKEN_KEY = "biometricAccessToken";
const LEGACY_BIOMETRIC_ENABLED_KEY = "biometricEnabled";

const biometricOptions: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: "Authenticate to sign in to Personal Tracker",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

export type BiometricSession = {
  refreshToken: string;
  userId: string;
};

export async function isBiometricAuthenticationSupported() {
  if (Platform.OS === "web" || !SecureStore.canUseBiometricAuthentication()) {
    return false;
  }

  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);

  return hasHardware && isEnrolled;
}

export async function hasBiometricLogin(userId?: string) {
  if (!(await isBiometricAuthenticationSupported())) return false;

  const ownerId = await SecureStore.getItemAsync(BIOMETRIC_OWNER_KEY);
  return Boolean(ownerId && (!userId || ownerId === userId));
}

export async function enableBiometricLogin(session: BiometricSession) {
  if (!(await isBiometricAuthenticationSupported())) return false;

  const authentication = await LocalAuthentication.authenticateAsync({
    promptMessage: "Enable biometric login",
    promptSubtitle: "Confirm your identity for this device",
    cancelLabel: "Cancel",
    fallbackLabel: "",
    disableDeviceFallback: true,
    biometricsSecurityLevel: "strong",
  });

  if (!authentication.success) return false;

  try {
    await SecureStore.setItemAsync(
      BIOMETRIC_SESSION_KEY,
      JSON.stringify(session),
      biometricOptions,
    );
    await SecureStore.setItemAsync(BIOMETRIC_OWNER_KEY, session.userId, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await removeLegacyBiometricCredential();
    return true;
  } catch {
    await disableBiometricLogin();
    return false;
  }
}

export async function getBiometricSession() {
  if (Platform.OS === "web") return null;

  const value = await SecureStore.getItemAsync(
    BIOMETRIC_SESSION_KEY,
    biometricOptions,
  );

  if (!value) {
    await disableBiometricLogin();
    return null;
  }

  try {
    return JSON.parse(value) as BiometricSession;
  } catch {
    await disableBiometricLogin();
    return null;
  }
}

export async function updateBiometricSession(session: BiometricSession) {
  await SecureStore.setItemAsync(
    BIOMETRIC_SESSION_KEY,
    JSON.stringify(session),
    biometricOptions,
  );
  await SecureStore.setItemAsync(BIOMETRIC_OWNER_KEY, session.userId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function disableBiometricLogin() {
  await Promise.all([
    SecureStore.deleteItemAsync(BIOMETRIC_SESSION_KEY, biometricOptions),
    SecureStore.deleteItemAsync(BIOMETRIC_OWNER_KEY),
    removeLegacyBiometricCredential(),
  ]);
}

async function removeLegacyBiometricCredential() {
  await Promise.all([
    SecureStore.deleteItemAsync(LEGACY_BIOMETRIC_ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(LEGACY_BIOMETRIC_ENABLED_KEY),
  ]);
}
