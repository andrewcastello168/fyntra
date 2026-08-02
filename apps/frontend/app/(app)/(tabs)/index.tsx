import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/src/auth/AuthProvider";
import { EmptyState } from "@/src/components/EmptyState";
import { colors, shadow } from "@/src/theme";
import { useEffect, useState } from "react";
import { apiFetch, getStoredAccessToken } from "@/src/api/client";

type Account = {
  id: number;
  accountName: string;
  accountType: string;
  currentBalance: number;
  isActive: boolean;
};

type AccountResponse = {
  data: Account[];
};

export default function HomeScreen() {
  const { user } = useAuth();

  const getAccounts = async () => {
    try {
      const token = await getStoredAccessToken();

      if (!token) {
        console.log("Token tidak tersedia");
        return;
      }

      const result = await apiFetch<AccountResponse>("/accounts", {}, token);

      console.log("Data accounts:", result);

      // setAccounts(result);
    } catch (error) {
      console.log("Error getAccounts:", error);
    }
  };

  useEffect(() => {
    console.log("User dari AuthProvider:", user);
    void getAccounts();
  }, [user]);

  const name = user?.profile?.full_name || user?.email || "there";
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>FINANCIAL SUMMARY</Text>
      <Text style={styles.title}>Hello, {name}</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>TOTAL BALANCE</Text>
        <Text style={styles.unavailable}>Not available yet</Text>
        <Text style={styles.cardHint}>
          Balance data will appear once your accounts are connected.
        </Text>
      </View>
      <EmptyState
        title="Dashboard coming soon"
        message="There are no account, budget period, or transaction data to display yet."
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
