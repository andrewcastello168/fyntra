import { Link } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/src/components/Button";
import { ErrorState } from "@/src/components/ErrorState";
import { TextInput } from "@/src/components/TextInput";
import { useAuth } from "@/src/auth/AuthProvider";
import { hasBiometricLogin } from "@/src/auth/biometric";
import { ThemeColors, useTheme } from "@/src/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { login, loginWithBiometrics, error, clearError } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkBiometrics() {
      if (Platform.OS === "web") return;
      const available = await hasBiometricLogin();
      if (mounted) setBiometricAvailable(available);
    }
    void checkBiometrics();
    return () => { mounted = false; };
  }, []);

  function handleFieldChange(setter: (value: string) => void, value: string) {
    setter(value);
    setLocalError("");
    clearError();
  }

  async function submit() {
    setLocalError("");
    clearError();
    if (!email || !password) {
      return setLocalError("Email and password are required.");
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch {
      // The provider exposes the user-facing authentication error.
    } finally {
      setLoading(false);
    }
  }

  async function signInWithBiometrics() {
    setBiometricLoading(true);
    setLocalError("");
    clearError();
    try {
      await loginWithBiometrics();
    } catch {
      setLocalError("Biometric sign-in is unavailable. Use your password instead.");
      setBiometricAvailable(await hasBiometricLogin().catch(() => false));
    } finally {
      setBiometricLoading(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: 24 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={false}
      >
        <View style={styles.brand}>
          <Text style={styles.kicker}>PERSONAL TRACKER</Text>
          <Text style={styles.title}>Manage your money with confidence.</Text>
          <Text style={styles.subtitle}>
            Sign in to view your financial summary.
          </Text>
        </View>
        <View style={styles.form}>
          {localError || error ? (
            <ErrorState message={localError || error || "Sign-in failed."} />
          ) : null}
          <TextInput
            label="Email"
            value={email}
            onChangeText={(value) => handleFieldChange(setEmail, value)}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="name@example.com"
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={(value) => handleFieldChange(setPassword, value)}
            secureTextEntry
            autoComplete="password"
            placeholder="At least 8 characters"
          />
          <Button label="Sign in" onPress={submit} loading={loading} />
          {biometricAvailable ? (
            <>
              <View style={styles.divider} accessibilityElementsHidden>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Login with biometrics"
                accessibilityState={{ disabled: biometricLoading }}
                disabled={biometricLoading || loading}
                onPress={() => void signInWithBiometrics()}
                style={({ pressed }) => [
                  styles.biometricButton,
                  pressed && styles.pressed,
                  (biometricLoading || loading) && styles.disabled,
                ]}
              >
                <Ionicons
                  name="finger-print-outline"
                  size={22}
                  color={colors.primary}
                />
                <Text style={styles.biometricText}>
                  {biometricLoading
                    ? "Checking biometrics…"
                    : "Login with biometrics"}
                </Text>
              </Pressable>
            </>
          ) : null}
          <Text style={styles.footer}>
            Don&apos;t have an account?{" "}
            <Link href={"/register" as never} style={styles.link}>
              Sign up now
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: { backgroundColor: colors.background, flex: 1 },
    content: { flexGrow: 1, gap: 36, paddingHorizontal: 24 },
    brand: { gap: 12 },
    kicker: {
      color: colors.success,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 1.2,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 30,
      lineHeight: 38,
      fontWeight: "700",
    },
    subtitle: { color: colors.textSecondary, fontSize: 16, lineHeight: 24 },
    form: { gap: 18 },
    footer: { color: colors.textSecondary, textAlign: "center", fontSize: 15 },
    link: { color: colors.primary, fontWeight: "700" },
    biometricButton: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "center", minHeight: 48, paddingHorizontal: 12 },
    biometricText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
    divider: { alignItems: "center", flexDirection: "row", gap: 12 },
    dividerLine: { backgroundColor: colors.border, flex: 1, height: StyleSheet.hairlineWidth },
    dividerText: { color: colors.textSecondary, fontSize: 14 },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.5 },
  });
}
