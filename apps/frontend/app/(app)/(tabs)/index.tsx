import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/src/auth/AuthProvider";
import { EmptyState } from "@/src/components/EmptyState";
import { colors, shadow } from "@/src/theme";
export default function HomeScreen() {
  const { user } = useAuth();
  const name = user?.profile?.full_name || user?.email || "Anda";
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>RINGKASAN KEUANGAN</Text>
      <Text style={styles.title}>Halo, {name}</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>TOTAL SALDO</Text>
        <Text style={styles.unavailable}>Belum tersedia</Text>
        <Text style={styles.cardHint}>
          Data saldo akan muncul setelah akun terhubung.
        </Text>
      </View>
      <EmptyState
        title="Dashboard sedang disiapkan"
        message="Belum ada data akun, periode anggaran, atau transaksi untuk ditampilkan."
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 16 },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 24,
    gap: 8,
    ...shadow,
  },
  cardLabel: {
    color: "#DBEAFE",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  unavailable: { color: "#fff", fontSize: 30, fontWeight: "800" },
  cardHint: { color: "#DBEAFE", fontSize: 14, lineHeight: 20 },
});
