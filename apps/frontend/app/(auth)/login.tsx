import { Link } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/src/components/Button";
import { ErrorState } from "@/src/components/ErrorState";
import { TextInput } from "@/src/components/TextInput";
import { useAuth } from "@/src/auth/AuthProvider";
import { isBiometricAuthenticationSupported } from "@/src/auth/biometric";
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

  const [biometricSupported, setBiometricSupported] = useState(false);

  const [biometricLoading, setBiometricLoading] = useState(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // const scrollRef = React.useRef<ScrollView>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let mounted = true;

    async function checkBiometrics() {
      if (Platform.OS === "web") return;

      try {
        const supported = await isBiometricAuthenticationSupported();

        if (mounted) {
          setBiometricSupported(supported);
        }
      } catch {
        if (mounted) {
          setBiometricSupported(false);
        }
      }
    }

    void checkBiometrics();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({
          animated: true,
        });
      }, 150);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);

      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: 0,
          animated: true,
        });
      }, 100);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
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
      // AuthProvider exposes the user-facing error.
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
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Biometric login is unavailable.";

      Alert.alert("Biometric login unavailable", message);
    } finally {
      setBiometricLoading(false);
    }
  }

  function handlePasswordFocus() {
    if (Platform.OS === "android") {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({
          animated: true,
        });
      }, 350);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 24,

            paddingBottom:
              keyboardHeight > 0 ? keyboardHeight + 32 : 32 + insets.bottom,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* BRAND */}
        <View style={styles.brand}>
          <Image
            source={require("../../assets/images/fyntra-symbol.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Manage your money with confidence.</Text>

          <Text style={styles.subtitle}>
            Sign in to view your financial summary.
          </Text>
        </View>

        {/* FORM */}
        <View style={styles.form}>
          {localError || error ? (
            <ErrorState message={localError || error || "Sign-in failed."} />
          ) : null}

          {/* EMAIL */}
          <TextInput
            label="Email"
            value={email}
            onChangeText={(value) => handleFieldChange(setEmail, value)}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="name@example.com"
          />

          {/* PASSWORD */}
          <TextInput
            label="Password"
            value={password}
            onChangeText={(value) => handleFieldChange(setPassword, value)}
            secureTextEntry
            autoComplete="password"
            placeholder="At least 8 characters"
            onFocus={handlePasswordFocus}
          />

          {/* SIGN IN */}
          <Button label="Sign in" onPress={submit} loading={loading} />

          {/* BIOMETRIC */}
          {biometricSupported ? (
            <>
              <View style={styles.divider} accessibilityElementsHidden>
                <View style={styles.dividerLine} />

                <Text style={styles.dividerText}>or</Text>

                <View style={styles.dividerLine} />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Login with biometrics"
                accessibilityState={{
                  disabled: biometricLoading || loading,
                }}
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
                  size={24}
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

          {/* FOOTER */}
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
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    scroll: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      gap: 28,
      paddingHorizontal: 24,
    },

    brand: {
      gap: 10,
    },

    logo: {
      width: 110,
      height: 110,
      marginBottom: 4,
      alignSelf: "center",
    },

    title: {
      color: colors.textPrimary,
      fontSize: 30,
      lineHeight: 38,
      fontWeight: "700",
      textAlign: "center",
    },

    subtitle: {
      color: colors.textSecondary,
      fontSize: 16,
      lineHeight: 24,
      textAlign: "center",
    },

    form: {
      gap: 18,
    },

    biometricButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
      minHeight: 52,
      paddingHorizontal: 16,
    },

    biometricText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "700",
    },

    divider: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
    },

    dividerLine: {
      backgroundColor: colors.border,
      flex: 1,
      height: StyleSheet.hairlineWidth,
    },

    dividerText: {
      color: colors.textSecondary,
      fontSize: 14,
    },

    footer: {
      color: colors.textSecondary,
      fontSize: 15,
      textAlign: "center",
    },

    link: {
      color: colors.primary,
      fontWeight: "700",
    },

    pressed: {
      opacity: 0.7,
    },

    disabled: {
      opacity: 0.5,
    },
  });
}
