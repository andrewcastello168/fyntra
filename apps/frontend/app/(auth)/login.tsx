import { Link } from "expo-router";
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

export default function LoginScreen() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  async function submit() {
    setLocalError("");
    if (!email || !password) {
      return setLocalError("Email and password are required.");
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      console.log(err);
      console.log("Error Test: ", err);
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
          <Text style={styles.kicker}>PERSONAL TRACKER</Text>
          <Text style={styles.title}>Manage your money with confidence.</Text>
          <Text style={styles.subtitle}>
            Log in to view your financial summary.
          </Text>
        </View>
        <View style={styles.form}>
          {localError || error ? (
            <ErrorState message={localError || error || "Login failed."} />
          ) : null}
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
            autoComplete="password"
            placeholder="Minimal 8 karakter"
          />
          <Button label="Log in" onPress={submit} loading={loading} />
          <Text style={styles.footer}>
            Don't have an account?{" "}
            <Link href={"/register" as never} style={styles.link}>
              Sign up now
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 36 },
  brand: { gap: 12 },
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
  form: { gap: 18 },
  footer: { color: colors.muted, textAlign: "center", fontSize: 15 },
  link: { color: colors.primary, fontWeight: "700" },
});
