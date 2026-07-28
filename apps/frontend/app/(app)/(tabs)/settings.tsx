import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/src/components/Button";
import { useAuth } from "@/src/auth/AuthProvider";
import { colors } from "@/src/theme";
export default function SettingsScreen() {
  const { user, logout } = useAuth();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pengaturan</Text>
      <View style={styles.profile}>
        <Text style={styles.label}>AKUN ANDA</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {user?.profile?.username ? (
          <Text style={styles.muted}>@{user.profile.username}</Text>
        ) : null}
      </View>
      <Button
        label="Keluar"
        variant="secondary"
        onPress={() => void logout()}
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 20 },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  profile: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  label: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  email: { color: colors.text, fontSize: 17, fontWeight: "700" },
  muted: { color: colors.muted, fontSize: 15 },
});
