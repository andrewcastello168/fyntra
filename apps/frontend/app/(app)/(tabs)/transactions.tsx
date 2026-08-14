import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, getStoredAccessToken } from "@/src/api/client";
import {
  Transaction,
  TransactionType,
  TransactionsResponse,
} from "@/src/api/types";
import { Button } from "@/src/components/Button";
import { EmptyState } from "@/src/components/EmptyState";
import { ErrorState } from "@/src/components/ErrorState";
import { LoadingState } from "@/src/components/LoadingState";
import { TextInput } from "@/src/components/TextInput";
import { ThemeColors, useTheme } from "@/src/theme";
import {
  errorMessage,
  formatCurrency,
  formatDate,
  transactionColor,
  transactionLabel,
} from "@/src/utils/format";

const filters: { key: TransactionType | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "INCOME", label: "Income" },
  { key: "EXPENSE", label: "Expense" },
  { key: "TRANSFER", label: "Transfer" },
];

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<TransactionType | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const hasLoaded = useRef(false);

  const transactions = useMemo(
    () => filter === "ALL"
      ? allTransactions
      : allTransactions.filter((transaction) => transaction.transactionType === filter),
    [allTransactions, filter],
  );

  const loadTransactions = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const token = await getStoredAccessToken();
        if (!token) throw new Error("Login session not found.");
        const firstPage = await apiFetch<TransactionsResponse>(
          "/transactions?page=1&limit=100",
          {},
          token,
        );
        const loaded = [...firstPage.data];
        for (let requestedPage = 2; requestedPage <= firstPage.pagination.totalPages; requestedPage += 1) {
          const nextPage = await apiFetch<TransactionsResponse>(
            `/transactions?page=${requestedPage}&limit=100`,
            {},
            token,
          );
          loaded.push(...nextPage.data);
        }
        setAllTransactions(loaded);
        hasLoaded.current = true;
      } catch (loadError) {
        setError(errorMessage(loadError, "Transactions could not be loaded."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      if (!hasLoaded.current) void loadTransactions();
    }, [loadTransactions]),
  );

  function changeFilter(nextFilter: TransactionType | "ALL") {
    setFilter(nextFilter);
  }

  function openEdit(transaction: Transaction) {
    if (transaction.transactionType === "TRANSFER") {
      Alert.alert(
        "Not supported",
        "Editing and deleting transfers are not available yet.",
      );
      return;
    }
    setSelected(transaction);
    setEditAmount(String(transaction.amount));
    setEditDate(formatDate(transaction.transactionDate));
    setEditCategory(transaction.category ?? "");
    setEditNote(transaction.note ?? "");
  }

  async function updateTransaction() {
    if (
      !selected ||
      !editAmount ||
      Number(editAmount) <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(editDate)
    ) {
      Alert.alert(
        "Check your entries",
        "Amount must be greater than zero and the date must use YYYY-MM-DD.",
      );
      return;
    }
    setSaving(true);
    try {
      const token = await getStoredAccessToken();
      if (!token) throw new Error("Login session not found.");
      await apiFetch(
        `/transactions/${selected.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            amount: Number(editAmount),
            transactionDate: editDate,
            category: editCategory.trim() || null,
            note: editNote.trim() || null,
          }),
        },
        token,
      );
      setSelected(null);
      await loadTransactions(true);
    } catch (updateError) {
      Alert.alert(
        "Update failed",
        errorMessage(updateError, "The transaction could not be updated."),
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(transaction: Transaction) {
    if (transaction.transactionType === "TRANSFER") {
      Alert.alert("Not supported", "Deleting transfers is not available yet.");
      return;
    }
    Alert.alert(
      "Delete transaction?",
      "The account balance will be restored based on the transaction type.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void deleteTransaction(transaction.id),
        },
      ],
    );
  }

  async function deleteTransaction(id: number) {
    try {
      const token = await getStoredAccessToken();
      if (!token) throw new Error("Login session not found.");
      await apiFetch(`/transactions/${id}`, { method: "DELETE" }, token);
      await loadTransactions(true);
    } catch (deleteError) {
      Alert.alert(
        "Delete failed",
        errorMessage(deleteError, "The transaction could not be deleted."),
      );
    }
  }

  if (loading && !allTransactions.length) return <LoadingState label="Loading transactions..." />;

  return (
    <>
      <View style={styles.screen}>
        <View
          style={[styles.fixedHeader, { paddingTop: insets.top + 12 }]}
        >
          <Text style={styles.title}>Transactions</Text>
          <Text style={styles.subtitle}>
            Income, expense, and transfer history.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {filters.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => changeFilter(item.key)}
                style={[
                  styles.filterChip,
                  filter === item.key && styles.selectedFilter,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === item.key && styles.selectedFilterText,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 40 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadTransactions(true)}
            />
          }
        >
        {error ? <ErrorState message={error} /> : null}
        {loading && allTransactions.length ? <Text style={styles.refreshHint}>Refreshing list…</Text> : null}
        {transactions.length ? (
          <View style={styles.list}>
            {transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open transaction ${transaction.category || transactionLabel(transaction.transactionType)}`}
                  onPress={() => openEdit(transaction)}
                  style={({ pressed }) => [
                    styles.rowContent,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.transactionHeader}>
                    <View style={styles.transactionCopy}>
                      <Text style={styles.transactionTitle}>
                        {transaction.category ||
                          transactionLabel(transaction.transactionType)}
                      </Text>
                      <Text style={styles.transactionMeta}>
                        {transactionLabel(transaction.transactionType)} ·{" "}
                        {formatDate(transaction.transactionDate)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.amount,
                        {
                          color: transactionColor(
                            transaction.transactionType,
                            colors,
                          ),
                        },
                      ]}
                    >
                      {transaction.transactionType === "EXPENSE" ? "-" : "+"}
                      {formatCurrency(transaction.amount)}
                    </Text>
                  </View>
                  <Text style={styles.accountLine}>
                    {transaction.accountName ?? "Account unavailable"}
                    {transaction.destinationAccountName
                      ? ` → ${transaction.destinationAccountName}`
                      : ""}
                  </Text>
                  {transaction.note ? (
                    <Text style={styles.note}>{transaction.note}</Text>
                  ) : null}
                </Pressable>
                <View style={styles.actionRow}>
                  <Text style={styles.editHint}>
                    {transaction.transactionType === "TRANSFER"
                      ? "Tap for details"
                      : "Tap to edit"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete transaction ${transaction.category || transactionLabel(transaction.transactionType)}`}
                    hitSlop={8}
                    onPress={() => confirmDelete(transaction)}
                  >
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No transactions yet"
            message="Income, expenses, and transfers will appear here."
          />
        )}
        </ScrollView>
      </View>

      <Modal
        visible={Boolean(selected)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={[
              styles.modalCard,
              { paddingBottom: 40 + insets.bottom },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit transaction</Text>
              <Pressable onPress={() => setSelected(null)}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            <TextInput
              label="Amount"
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
            />
            <TextInput
              label="Transaction date"
              value={editDate}
              onChangeText={setEditDate}
              placeholder="YYYY-MM-DD"
            />
            <TextInput
              label="Category"
              value={editCategory}
              onChangeText={setEditCategory}
            />
            <TextInput
              label="Note"
              value={editNote}
              onChangeText={setEditNote}
              multiline
            />
            <Button
              label="Save changes"
              onPress={() => void updateTransaction()}
              loading={saving}
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1, backgroundColor: colors.background },
    fixedHeader: {
      backgroundColor: colors.background,
      gap: 16,
      paddingBottom: 8,
      paddingHorizontal: 20,
    },
    content: {
      gap: 16,
      paddingBottom: 40,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    title: { color: colors.textPrimary, fontSize: 26, fontWeight: "700" },
    subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    filterRow: { gap: 8, paddingVertical: 4 },
    filterChip: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: 6,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    selectedFilter: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
    selectedFilterText: { color: colors.onPrimary },
    refreshHint: { color: colors.primary, fontSize: 12, fontWeight: "700" },
    list: {},
    transactionCard: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      gap: 8,
      paddingVertical: 14,
    },
    rowContent: { gap: 8 },
    pressed: { opacity: 0.7 },
    transactionHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 10,
    },
    transactionCopy: { flex: 1, gap: 4 },
    transactionTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    transactionMeta: { color: colors.textSecondary, fontSize: 12 },
    amount: { fontSize: 14, fontWeight: "800", textAlign: "right" },
    accountLine: { color: colors.textPrimary, fontSize: 13 },
    note: { color: colors.textSecondary, fontSize: 13 },
    actionRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
    },
    editHint: { color: colors.primary, fontSize: 12, fontWeight: "600" },
    deleteText: { color: colors.danger, fontSize: 12, fontWeight: "700" },
    modalBackdrop: {
      backgroundColor: colors.scrim,
      flex: 1,
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      gap: 18,
      padding: 24,
      paddingBottom: 40,
    },
    modalHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    modalTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
    close: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  });
}
