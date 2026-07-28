import { ScrollView, StyleSheet, Text } from "react-native";
import { EmptyState } from "@/src/components/EmptyState";
import { colors } from "@/src/theme";
export default function AccountsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Akun</Text>
      <EmptyState
        title="Belum ada akun"
        message="Daftar akun Anda akan tampil di sini setelah fitur akun tersedia."
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24 },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 24,
  },
});
