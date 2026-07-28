import { ScrollView, StyleSheet, Text } from "react-native";
import { EmptyState } from "@/src/components/EmptyState";
import { colors } from "@/src/theme";
export default function TransactionsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Transaksi</Text>
      <EmptyState
        title="Belum ada transaksi"
        message="Riwayat pemasukan, pengeluaran, dan transfer akan tampil di sini."
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
