import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { apiFetch } from "@/src/api/client";

const BIOMETRIC_CREDENTIAL_KEY = "biometricCredential.v3";
const BIOMETRIC_OWNER_KEY = "biometricOwner.v3";
const BIOMETRIC_DEVICE_ID_KEY = "biometricDeviceId.v1";
const LEGACY_KEYS = [
  "biometricSession.v2",
  "biometricOwner.v2",
  "biometricAccessToken",
  "biometricEnabled",
];

const biometricOptions: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: "Authenticate to sign in to Personal Tracker",
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

export type BiometricCredential = {
  credential: string;
  userId: string;
  deviceId: string;
};

type EnrollResponse = { credential: string };

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

export async function enableBiometricLogin(
  userId: string,
  accessToken: string,
) {
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

  const deviceId = await getDeviceId();
  const enrollment = await apiFetch<EnrollResponse>(
    "/auth/biometric/enroll",
    {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    },
    accessToken,
  );

  console.log(enrollment);

  const biometricCredential: BiometricCredential = {
    credential: enrollment.credential,
    userId,
    deviceId,
  };
  try {
    await SecureStore.setItemAsync(
      BIOMETRIC_CREDENTIAL_KEY,
      JSON.stringify(biometricCredential),
      biometricOptions,
    );
    await SecureStore.setItemAsync(BIOMETRIC_OWNER_KEY, userId, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await removeLegacyBiometricCredentials();
    return true;
  } catch (error) {
    // The server credential cannot be safely used if the protected local write
    // failed. Revoke it while the password-authenticated session is available.
    await revokeBiometricCredential(accessToken, deviceId).catch(
      () => undefined,
    );
    await clearLocalBiometricLogin();
    throw error;
  }
}

export async function getBiometricCredential() {
  if (Platform.OS === "web") return null;
  const value = await SecureStore.getItemAsync(
    BIOMETRIC_CREDENTIAL_KEY,
    biometricOptions,
  );
  if (!value) return null;

  try {
    const credential = JSON.parse(value) as BiometricCredential;
    if (!credential.credential || !credential.userId || !credential.deviceId) {
      throw new Error("Invalid biometric credential");
    }
    return credential;
  } catch {
    await clearLocalBiometricLogin();
    return null;
  }
}

export async function disableBiometricLogin(accessToken: string) {
  const deviceId = await getDeviceId();
  await revokeBiometricCredential(accessToken, deviceId);
  await clearLocalBiometricLogin();
}

export async function clearLocalBiometricLogin() {
  await Promise.all([
    SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIAL_KEY, biometricOptions),
    SecureStore.deleteItemAsync(BIOMETRIC_OWNER_KEY),
    ...LEGACY_KEYS.map((key) => SecureStore.deleteItemAsync(key)),
  ]);
}

async function revokeBiometricCredential(
  accessToken: string,
  deviceId: string,
) {
  await apiFetch(
    "/auth/biometric",
    { method: "DELETE", body: JSON.stringify({ deviceId }) },
    accessToken,
  );
}

async function getDeviceId() {
  let deviceId = await SecureStore.getItemAsync(BIOMETRIC_DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = createUuid();
    await SecureStore.setItemAsync(BIOMETRIC_DEVICE_ID_KEY, deviceId, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  return deviceId;
}

function createUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    const digit = value === "x" ? random : (random & 0x3) | 0x8;
    return digit.toString(16);
  });
}

async function removeLegacyBiometricCredentials() {
  await Promise.all(LEGACY_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
}
