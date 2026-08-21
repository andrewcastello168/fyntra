import { Link, router } from "expo-router";

import { useEffect, useRef, useState } from "react";

import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/src/components/Button";
import { ErrorState } from "@/src/components/ErrorState";
import { TextInput } from "@/src/components/TextInput";
import { useAuth } from "@/src/auth/AuthProvider";
import { ThemeColors, useTheme } from "@/src/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RegisterScreen() {
  const { register, error, clearError } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollRef = useRef<ScrollView>(null);

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

  function handlePasswordFocus() {
    if (Platform.OS === "android") {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({
          animated: true,
        });
      }, 350);
    }
  }

  async function submit() {
    setLocalError("");
    clearError();

    if (!fullName.trim() || !email.trim() || password.length < 8) {
      return setLocalError(
        "Name and email are required, and the password must be at least 8 characters.",
      );
    }

    setLoading(true);

    try {
      const signedIn = await register({
        fullName: fullName.trim(),
        username: username.trim() || undefined,
        email: email.trim(),
        password,
      });

      if (!signedIn) {
        setLocalError("Sign-up successful. Sign in to continue.");
        router.replace("/login" as never);
      }
    } catch {
      // AuthProvider exposes the user-facing error.
    } finally {
      setLoading(false);
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
        <View style={styles.brand}>
          <Text style={styles.kicker}>GET STARTED</Text>

          <Text style={styles.title}>Create your account.</Text>

          <Text style={styles.subtitle}>
            Safely track your income and expenses.
          </Text>
        </View>

        <View style={styles.form}>
          {localError || error ? (
            <ErrorState message={localError || error || "Sign-up failed."} />
          ) : null}

          <TextInput
            label="Full name"
            value={fullName}
            onChangeText={(value) => handleFieldChange(setFullName, value)}
            autoComplete="name"
            placeholder="Your name"
          />

          <TextInput
            label="Username (optional)"
            value={username}
            onChangeText={(value) => handleFieldChange(setUsername, value)}
            autoCapitalize="none"
            placeholder="username"
          />

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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            onFocus={handlePasswordFocus}
          />

          <Button label="Create account" onPress={submit} loading={loading} />

          <Text style={styles.footer}>
            Already have an account?{" "}
            <Link href={"/login" as never} style={styles.link}>
              Sign in
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
      backgroundColor: colors.background,
    },

    brand: {
      gap: 10,
    },

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

    subtitle: {
      color: colors.textSecondary,
      fontSize: 16,
      lineHeight: 24,
    },

    form: {
      gap: 18,
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
  });
}
