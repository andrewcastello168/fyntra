import { Link, router } from "expo-router";
import { useState } from "react";
import {
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
import { colors } from "@/src/theme";

export default function RegisterScreen() {
  const { register, error } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  async function submit() {
    setLocalError("");
    if (!fullName || !email || password.length < 8)
      return setLocalError(
        "Name and email are required, and the password must be at least 8 characters.",
      );
    setLoading(true);
    try {
      const signedIn = await register({
        fullName: fullName.trim(),
        username: username.trim() || undefined,
        email: email.trim(),
        password,
      });
      if (!signedIn) {
        setLocalError("Sign-up successful. Log in to continue.");
        router.replace("/login" as never);
      }
    } catch {
      /* provider exposes the API error */
    } finally {
      setLoading(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Text style={styles.kicker}>GET STARTED TODAY</Text>
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
            onChangeText={setFullName}
            autoComplete="name"
            placeholder="Your name"
          />
          <TextInput
            label="Username (optional)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="username"
          />
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="nama@email.com"
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <Button label="Create account" onPress={submit} loading={loading} />
          <Text style={styles.footer}>
            Already have an account?{" "}
            <Link href={"/login" as never} style={styles.link}>
              Log in
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 28 },
  brand: { gap: 10 },
  kicker: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "800",
  },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  form: { gap: 16 },
  footer: { color: colors.muted, textAlign: "center", fontSize: 15 },
  link: { color: colors.primary, fontWeight: "700" },
});
