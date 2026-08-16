import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, getStoredAccessToken } from "@/src/api/client";
import {
  Account,
  AccountsResponse,
  Transaction,
  TransactionResponse,
  TransactionType,
  TransactionsResponse,
} from "@/src/api/types";
import { Button } from "@/src/components/Button";
import { EmptyState } from "@/src/components/EmptyState";
import { ErrorState } from "@/src/components/ErrorState";
import { LoadingState } from "@/src/components/LoadingState";
import { TextInput } from "@/src/components/TextInput";
import { AmountInput } from "@/src/components/AmountInput";
import { DateField } from "@/src/components/DateField";
import { SelectField } from "@/src/components/SelectField";
import { ThemeColors, useTheme } from "@/src/theme";
import {
  errorMessage,
  formatCurrency,
  formatDate,
  transactionColor,
  transactionLabel,
} from "@/src/utils/format";
import { normalizeDateOnly } from "@/src/utils/date";

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
  const { transactionId } = useLocalSearchParams<{ transactionId?: string }>();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filter, setFilter] = useState<TransactionType | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editAccountId, setEditAccountId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [startingCycle, setStartingCycle] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const hasLoaded = useRef(false);
  const openedTransactionId = useRef<number | null>(null);

  const clearEditState = useCallback(() => {
    setSelected(null);
    setEditAmount("");
    setEditAccountId(null);
    setEditDate("");
    setEditCategory("");
    setEditNote("");
  }, []);

  const closeEditor = useCallback(() => {
    clearEditState();
    if (transactionId !== undefined) {
      router.replace("/transactions" as never);
    }
  }, [clearEditState, transactionId]);

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
        const [firstPage, accountsResponse] = await Promise.all([
          apiFetch<TransactionsResponse>(
            "/transactions?page=1&limit=100",
            {},
            token,
          ),
          apiFetch<AccountsResponse>("/accounts", {}, token),
        ]);
        setAccounts(accountsResponse.data);
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
      void loadTransactions(hasLoaded.current);
      return clearEditState;
    }, [clearEditState, loadTransactions]),
  );

  useEffect(() => {
    if (transactionId === undefined) {
      openedTransactionId.current = null;
      return;
    }
    const id = Number(transactionId);
    if (
      !Number.isInteger(id) ||
      !hasLoaded.current ||
      openedTransactionId.current === id
    ) {
      return;
    }
    openedTransactionId.current = id;
    const openLinkedTransaction = async () => {
      setDetailLoading(true);
      try {
        const token = await getStoredAccessToken();
        if (!token) throw new Error("Login session not found.");
        const response = await apiFetch<TransactionResponse>(
          `/transactions/${id}`,
          {},
          token,
        );
        const transaction = response.data;
        setSelected(transaction);
        setEditAccountId(transaction.accountId);
        setEditAmount(String(transaction.amount));
        setEditDate(formatDate(transaction.transactionDate));
        setEditCategory(transaction.category ?? "");
        setEditNote(transaction.note ?? "");
      } catch (detailError) {
        Alert.alert(
          "Failed to open transaction.",
          errorMessage(detailError, "Try again from the transaction list."),
        );
      } finally {
        setDetailLoading(false);
      }
    };
    void openLinkedTransaction();
  }, [transactionId, allTransactions]);

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
    void openEditById(transaction.id);
  }

  async function openEditById(id: number) {
    setDetailLoading(true);
    try {
      const token = await getStoredAccessToken();
      if (!token) throw new Error("Login session not found.");
      const response = await apiFetch<TransactionResponse>(
        `/transactions/${id}`,
        {},
        token,
      );
      populateEdit(response.data);
    } catch (detailError) {
      Alert.alert(
        "Failed to open transaction.",
        errorMessage(detailError, "Try again from the transaction list."),
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function populateEdit(transaction: Transaction) {
    setSelected(transaction);
    setEditAccountId(transaction.accountId);
    setEditAmount(String(transaction.amount));
    setEditDate(formatDate(transaction.transactionDate));
    setEditCategory(transaction.category ?? "");
    setEditNote(transaction.note ?? "");
  }

  async function updateTransaction() {
    if (
      !selected ||
      !editAccountId ||
      !editAmount ||
      Number(editAmount) <= 0 ||
      !normalizeDateOnly(editDate)
    ) {
      Alert.alert(
        "Check your entries",
        "Amount must be greater than zero and the date must use YYYY-MM-DD.",
      );
      return;
    }
    const normalizedEditDate = normalizeDateOnly(editDate);
    if (!normalizedEditDate) return;
    setSaving(true);
    try {
      const token = await getStoredAccessToken();
      if (!token) throw new Error("Login session not found.");
      await apiFetch(
        `/transactions/${selected.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            accountId: editAccountId,
            amount: Number(editAmount),
            transactionDate: normalizedEditDate,
            category: editCategory.trim() || null,
            note: editNote.trim() || null,
          }),
        },
        token,
      );
      await loadTransactions(true);
      closeEditor();
      Alert.alert("Transaction updated", "Your changes were saved.");
    } catch (updateError) {
      Alert.alert(
        "Update failed",
        errorMessage(updateError, "The transaction could not be updated."),
      );
    } finally {
      setSaving(false);
    }
  }

  function promptStartCycle(income: Transaction, title = "Use as cycle start?") {
    const body = [
      `Start a new financial cycle from this income on ${formatFriendlyDate(income.transactionDate)}?`,
      income.cycleAction?.currentCycleEndDate
        ? `Your current cycle will end on ${formatFriendlyDate(income.cycleAction.currentCycleEndDate)}.`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");
    Alert.alert(title, body, [
      { text: "Not Now", style: "cancel" },
      { text: "Use as Cycle Start", onPress: () => void startCycle(income.id) },
    ]);
  }

  async function startCycle(transactionIdToStart: number) {
    if (startingCycle) return;
    setStartingCycle(true);
    try {
      const token = await getStoredAccessToken();
      if (!token) throw new Error("Login session not found.");
      await apiFetch(
        `/budget-periods/from-income/${transactionIdToStart}`,
        { method: "POST", body: JSON.stringify({}) },
        token,
      );
      await loadTransactions(true);
      const detail = await apiFetch<TransactionResponse>(
        `/transactions/${transactionIdToStart}`,
        {},
        token,
      );
      populateEdit(detail.data);
      Alert.alert(
        "Financial cycle started",
        `The new cycle starts on ${formatFriendlyDate(detail.data.transactionDate)}.`,
      );
    } catch (cycleError) {
      Alert.alert(
        "Failed to start cycle",
        errorMessage(cycleError, "Try again from this income."),
      );
    } finally {
      setStartingCycle(false);
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
                  {transaction.cycleSourcePeriodId ? (
                    <Text style={styles.cycleSource}>Starts a financial cycle</Text>
                  ) : null}
                </Pressable>
                <View style={styles.actionRow}>
                  <Text style={styles.editHint}>
                    {transaction.transactionType === "TRANSFER"
                      ? "Tap for details"
                      : "Tap to edit"}
                  </Text>
                  {!transaction.cycleSourcePeriodId ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete transaction ${transaction.category || transactionLabel(transaction.transactionType)}`}
                      hitSlop={8}
                      onPress={() => confirmDelete(transaction)}
                    >
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  ) : null}
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

      {detailLoading ? (
        <View pointerEvents="none" style={styles.detailLoading}>
          <Text style={styles.refreshHint}>Opening transaction...</Text>
        </View>
      ) : null}

      <Modal
        visible={Boolean(selected)}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!saving && !startingCycle) closeEditor();
        }}
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close transaction"
                accessibilityState={{ disabled: saving || startingCycle }}
                disabled={saving || startingCycle}
                hitSlop={8}
                onPress={closeEditor}
              >
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            <SelectField
              label="Account"
              selectedId={editAccountId}
              options={accounts.map((account) => ({
                id: account.id,
                label: account.accountName,
                disabled: !account.isActive && account.id !== editAccountId,
              }))}
              onSelect={setEditAccountId}
              disabled={saving || startingCycle}
            />
            <AmountInput
              value={editAmount}
              onChangeText={setEditAmount}
              editable={!saving && !startingCycle}
            />
            <DateField
              label="Transaction date"
              value={editDate}
              onChange={setEditDate}
              disabled={
                saving || startingCycle || Boolean(selected?.cycleSourcePeriodId)
              }
            />
            {selected?.cycleSourcePeriodId ? (
              <Text style={styles.cycleExplanation}>
                The date is locked because this income starts a financial cycle.
              </Text>
            ) : null}
            <TextInput
              label="Category"
              value={editCategory}
              onChangeText={setEditCategory}
              editable={!saving && !startingCycle}
            />
            <TextInput
              label="Note"
              value={editNote}
              onChangeText={setEditNote}
              multiline
              editable={!saving && !startingCycle}
            />
            <Button
              label="Save changes"
              onPress={() => void updateTransaction()}
              loading={saving}
              disabled={startingCycle}
            />
            {selected?.transactionType === "INCOME" ? (
              <View style={styles.cycleSection}>
                {selected.cycleAction?.status === "AVAILABLE" ? (
                  <Button
                    label="Use as cycle start"
                    variant="secondary"
                    loading={startingCycle}
                    disabled={saving}
                    onPress={() => promptStartCycle(selected)}
                  />
                ) : (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={
                      selected.cycleAction?.status === "ALREADY_SOURCE"
                        ? styles.cycleSource
                        : styles.cycleExplanation
                    }
                  >
                    {selected.cycleAction?.message}
                  </Text>
                )}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function formatFriendlyDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
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
    detailLoading: {
      alignItems: "center",
      backgroundColor: colors.background,
      bottom: 0,
      justifyContent: "center",
      left: 0,
      opacity: 0.9,
      position: "absolute",
      right: 0,
      top: 0,
    },
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
    cycleSource: { color: colors.success, fontSize: 13, fontWeight: "700" },
    cycleExplanation: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    cycleSection: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: 12,
      paddingTop: 16,
    },
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
