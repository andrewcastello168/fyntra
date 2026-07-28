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
        "Nama, email, dan kata sandi minimal 8 karakter wajib diisi.",
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
        setLocalError("Registrasi berhasil. Silakan masuk untuk melanjutkan.");
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
          <Text style={styles.kicker}>MULAI HARI INI</Text>
          <Text style={styles.title}>Buat akun Anda.</Text>
          <Text style={styles.subtitle}>
            Catat pemasukan dan pengeluaran dengan aman.
          </Text>
        </View>
        <View style={styles.form}>
          {localError || error ? (
            <ErrorState message={localError || error || "Registrasi gagal."} />
          ) : null}
          <TextInput
            label="Nama lengkap"
            value={fullName}
            onChangeText={setFullName}
            autoComplete="name"
            placeholder="Nama Anda"
          />
          <TextInput
            label="Username (opsional)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="nama pengguna"
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
            label="Kata sandi"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
          />
          <Button label="Buat akun" onPress={submit} loading={loading} />
          <Text style={styles.footer}>
            Sudah punya akun?{" "}
            <Link href={"/login" as never} style={styles.link}>
              Masuk
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
