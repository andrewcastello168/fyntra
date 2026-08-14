import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, getStoredAccessToken } from "@/src/api/client";
import {
  Account,
  AccountsResponse,
  ActivePeriodResponse,
  BudgetPeriod,
  TransactionDraftResponse,
  TransactionType,
} from "@/src/api/types";
import { Button } from "@/src/components/Button";
import { EmptyState } from "@/src/components/EmptyState";
import { ErrorState } from "@/src/components/ErrorState";
import { LoadingState } from "@/src/components/LoadingState";
import { TextInput } from "@/src/components/TextInput";
import { AmountInput } from "@/src/components/AmountInput";
import { SelectField, SelectOption } from "@/src/components/SelectField";
import { ThemeColors, useTheme } from "@/src/theme";
import { errorMessage, formatCurrency } from "@/src/utils/format";
import {
  maskBalance,
  useBalanceVisibility,
} from "@/src/privacy/BalanceVisibilityProvider";

const transactionTypes: {
  key: TransactionType;
  label: string;
  description: string;
}[] = [
  {
    key: "INCOME",
    label: "Income",
    description: "Record money received",
  },
  {
    key: "EXPENSE",
    label: "Expense",
    description: "Record money spent",
  },
  {
    key: "TRANSFER",
    label: "Transfer",
    description: "Move money between accounts",
  },
];

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isBalanceVisible } = useBalanceVisibility();
  const styles = createStyles(colors);
  const [selectedType, setSelectedType] = useState<TransactionType>("INCOME");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activePeriod, setActivePeriod] = useState<BudgetPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [destinationAccountId, setDestinationAccountId] = useState<
    number | null
  >(null);
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [startNewPeriod, setStartNewPeriod] = useState(false);
  const [savingPercentage, setSavingPercentage] = useState("20");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [smartInputOpen, setSmartInputOpen] = useState(false);
  const [smartInputText, setSmartInputText] = useState("");
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [smartInputError, setSmartInputError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);

  const loadDependencies = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const token = await getStoredAccessToken();
      if (!token) throw new Error("Login session not found.");
      const [accountsResult, periodResult] = await Promise.all([
        apiFetch<AccountsResponse>("/accounts", {}, token),
        apiFetch<ActivePeriodResponse>("/budget-periods/active", {}, token),
      ]);
      setAccounts(accountsResult.data);
      setActivePeriod(periodResult.data);
      setAccountId((current) => current ?? accountsResult.data[0]?.id ?? null);
      setDestinationAccountId(
        (current) => current ?? accountsResult.data[1]?.id ?? null,
      );
    } catch (loadError) {
      setError(errorMessage(loadError, "Account data could not be loaded."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDependencies();
    }, [loadDependencies]),
  );

  function selectType(type: TransactionType) {
    setSelectedType(type);
    if (type !== "INCOME") setStartNewPeriod(false);
  }

  function selectSourceAccount(nextId: number) {
    setAccountId(nextId);
    if (destinationAccountId === nextId) {
      setDestinationAccountId(
        accounts.find((account) => account.id !== nextId)?.id ?? null,
      );
    }
  }

  function accountOptions(excludedId?: number | null): SelectOption[] {
    return accounts.map((account) => ({
      id: account.id,
      label: account.accountName,
      secondary: isBalanceVisible
        ? formatCurrency(account.currentBalance)
        : maskBalance(),
      disabled: excludedId === account.id,
    }));
  }

  function openSmartInput() {
    setSmartInputError(null);
    setSmartInputOpen(true);
  }

  function closeSmartInput() {
    if (generatingDraft) return;
    setSmartInputOpen(false);
    setSmartInputError(null);
  }

  async function generateDraft() {
    const text = smartInputText.trim();

    if (!text) {
      setSmartInputError(
        "Describe your transaction before generating a draft.",
      );
      return;
    }

    setGeneratingDraft(true);
    setSmartInputError(null);

    try {
      const token = await getStoredAccessToken();
      if (!token) throw new Error("Login session not found.");

      const localDate = currentLocalDate();
      const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const response = await apiFetch<TransactionDraftResponse>(
        "/transaction-drafts",
        {
          method: "POST",
          body: JSON.stringify({ text, localDate, timeZone }),
        },
        token,
      );
      const { draft, missingFields, warnings, accountResolution } =
        response.data;

      if (draft.transactionType) selectType(draft.transactionType);
      if (draft.amount !== null) setAmount(String(draft.amount));
      if (draft.transactionDate) setTransactionDate(draft.transactionDate);
      if (draft.accountId !== null) selectSourceAccount(draft.accountId);
      if (draft.destinationAccountId !== undefined) {
        setDestinationAccountId(draft.destinationAccountId);
      }
      if (draft.category !== null) setCategory(draft.category);
      if (draft.note !== null) setNote(draft.note);

      const reviewMessages = [...warnings];
      if (missingFields.length) {
        reviewMessages.unshift(
          `Review or complete these fields manually: ${missingFields
            .map(draftFieldLabel)
            .join(", ")}.`,
        );
      }
      if (
        accountResolution === "ambiguous" &&
        !reviewMessages.some((message) =>
          message.toLowerCase().includes("ambiguous"),
        )
      ) {
        reviewMessages.push("Choose the correct account manually.");
      }

      setDraftNotice(
        reviewMessages.length
          ? `Draft added. ${reviewMessages.join(" ")}`
          : "Draft added. Review every field, then save when it looks correct.",
      );
      setSmartInputOpen(false);
    } catch (draftError) {
      setSmartInputError(
        errorMessage(
          draftError,
          "The draft could not be generated. You can continue manually.",
        ),
      );
    } finally {
      setGeneratingDraft(false);
    }
  }

  function validateForm() {
    if (!accountId) return "Select an account first.";
    if (selectedType === "TRANSFER" && !destinationAccountId)
      return "Select a destination account.";
    if (selectedType === "TRANSFER" && accountId === destinationAccountId)
      return "Source and destination accounts must be different.";
    if (!amount || Number(amount) <= 0)
      return "Amount must be greater than zero.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate))
      return "Use YYYY-MM-DD for the date.";
    if (startNewPeriod) {
      if (
        !savingPercentage ||
        Number(savingPercentage) < 0 ||
        Number(savingPercentage) > 100
      )
        return "Savings percentage must be between 0 and 100.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(periodEndDate))
        return "Use YYYY-MM-DD for the period end date.";
      if (periodEndDate < transactionDate)
        return "The period end date cannot be before the transaction date.";
    }
    return null;
  }

  async function submit() {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert("Check your entries", validationError);
      return;
    }

    const sendRequest = async () => {
      setSubmitting(true);
      try {
        const token = await getStoredAccessToken();
        if (!token) throw new Error("Login session not found.");
        await apiFetch(
          "/transactions",
          {
            method: "POST",
            body: JSON.stringify({
              accountId,
              destinationAccountId:
                selectedType === "TRANSFER" ? destinationAccountId : undefined,
              transactionType: selectedType,
              amount: Number(amount),
              transactionDate,
              category: category.trim() || undefined,
              note: note.trim() || undefined,
              startNewPeriod:
                selectedType === "INCOME" ? startNewPeriod : false,
              savingPercentage: startNewPeriod
                ? Number(savingPercentage)
                : undefined,
              periodEndDate: startNewPeriod ? periodEndDate : undefined,
            }),
          },
          token,
        );
        Alert.alert("Success", "Transaction created successfully.", [
          {
            text: "View transactions",
            onPress: () => router.replace("/transactions" as never),
          },
        ]);
        setAmount("");
        setCategory("");
        setNote("");
      } catch (submitError) {
        Alert.alert(
          "Transaction failed",
          errorMessage(submitError, "The transaction could not be created."),
        );
      } finally {
        setSubmitting(false);
      }
    };

    if (startNewPeriod && activePeriod) {
      Alert.alert(
        "Start a new period?",
        "The current active period will close one day before the new period. The new period will start on the transaction date. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: () => void sendRequest() },
        ],
      );
      return;
    }
    await sendRequest();
  }

  if (loading) return <LoadingState label="Loading accounts..." />;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.fixedHeader, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Create transaction</Text>
        <Text style={styles.subtitle}>
          Choose a transaction type and enter its details.
        </Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 40 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadDependencies(true)}
          />
        }
      >
        {error ? <ErrorState message={error} /> : null}
        {!accounts.length ? (
          <EmptyState
            title="No accounts yet"
            message="Create an account before recording a transaction."
          />
        ) : (
          <>
            <Button
              label="✨ Quick Add"
              onPress={openSmartInput}
              variant="secondary"
            />
            {draftNotice ? (
              <View accessibilityLiveRegion="polite" style={styles.draftNotice}>
                <Text style={styles.draftNoticeTitle}>
                  AI draft ready for review
                </Text>
                <Text style={styles.draftNoticeText}>{draftNotice}</Text>
              </View>
            ) : null}
            <View style={styles.typeSelector}>
              {transactionTypes.map((type) => (
                <Pressable
                  key={type.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedType === type.key }}
                  onPress={() => selectType(type.key)}
                  style={[
                    styles.typeOption,
                    selectedType === type.key && styles.selectedType,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeLabel,
                      selectedType === type.key && styles.selectedText,
                    ]}
                  >
                    {type.label}
                  </Text>
                  <Text
                    style={[
                      styles.typeDescription,
                      selectedType === type.key && styles.selectedDescription,
                    ]}
                  >
                    {type.description}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.amountIntro}>
              <Text style={styles.sectionLabel}>HOW MUCH?</Text>
              <Text style={styles.amountHint}>
                Start with the number. You can add context below.
              </Text>
            </View>
            <AmountInput
              value={amount}
              onChangeText={setAmount}
              style={styles.amountInput}
            />
            <Text style={styles.sectionLabel}>WHERE?</Text>
            <SelectField
              label={selectedType === "TRANSFER" ? "Source account" : "Account"}
              selectedId={accountId}
              options={accountOptions()}
              onSelect={selectSourceAccount}
            />
            {selectedType === "TRANSFER" ? (
              <SelectField
                label="Destination account"
                selectedId={destinationAccountId}
                options={accountOptions(accountId)}
                onSelect={setDestinationAccountId}
              />
            ) : null}
            <Text style={styles.sectionLabel}>WHEN AND WHY?</Text>
            <TextInput
              label="Transaction date"
              value={transactionDate}
              onChangeText={setTransactionDate}
              placeholder="YYYY-MM-DD"
            />
            {selectedType !== "TRANSFER" ? (
              <TextInput
                label="Category (optional)"
                value={category}
                onChangeText={setCategory}
                placeholder="Example: Groceries"
              />
            ) : null}
            <TextInput
              label="Note (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="Add a note"
              multiline
            />

            {selectedType === "INCOME" ? (
              <View style={styles.periodSection}>
                <Text style={styles.sectionLabel}>BUDGET PERIOD</Text>
                <View style={styles.periodToggle}>
                  <View style={styles.periodCopy}>
                    <Text style={styles.periodTitle}>
                      Start a new budget period
                    </Text>
                    <Text style={styles.periodHint}>
                      Enable this only when this income starts a new period.
                    </Text>
                  </View>
                  <Switch
                    value={startNewPeriod}
                    onValueChange={setStartNewPeriod}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.surface}
                  />
                </View>
              </View>
            ) : null}
            {startNewPeriod ? (
              <>
                <TextInput
                  label="Savings percentage"
                  value={savingPercentage}
                  onChangeText={setSavingPercentage}
                  keyboardType="decimal-pad"
                  placeholder="20"
                />
                <TextInput
                  label="Period end date"
                  value={periodEndDate}
                  onChangeText={setPeriodEndDate}
                  placeholder="YYYY-MM-DD"
                />
              </>
            ) : null}
            <Button
              label="Save transaction"
              onPress={() => void submit()}
              loading={submitting}
            />
          </>
        )}
      </ScrollView>
      <Modal
        animationType="slide"
        transparent
        visible={smartInputOpen}
        onRequestClose={closeSmartInput}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <ScrollView
            accessibilityViewIsModal
            contentContainerStyle={[
              styles.smartInputSheetContent,
              { paddingBottom: 24 + insets.bottom },
            ]}
            keyboardShouldPersistTaps="handled"
            style={styles.smartInputSheet}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalTitle}>Smart Input</Text>
                <Text style={styles.modalDescription}>
                  Describe one transaction. AI will fill a draft for you to
                  review.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close Smart Input"
                accessibilityState={{ disabled: generatingDraft }}
                disabled={generatingDraft}
                hitSlop={8}
                onPress={closeSmartInput}
                style={({ pressed }) => [
                  styles.modalClose,
                  pressed && styles.pressed,
                  generatingDraft && styles.disabled,
                ]}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
            <TextInput
              autoFocus
              editable={!generatingDraft}
              error={smartInputError ?? undefined}
              label="Describe your transaction"
              multiline
              onChangeText={(value) => {
                setSmartInputText(value);
                if (smartInputError) setSmartInputError(null);
              }}
              placeholder="Example: hari ini makan 50 ribu pakai BCA"
              style={styles.smartInputField}
              textAlignVertical="top"
              value={smartInputText}
            />
            <Text style={styles.smartInputHint}>
              Nothing is saved automatically. You will review the regular form
              first.
            </Text>
            <Button
              label="Generate draft"
              loading={generatingDraft}
              onPress={() => void generateDraft()}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function draftFieldLabel(field: string) {
  switch (field) {
    case "transactionType":
      return "transaction type";
    case "transactionDate":
      return "transaction date";
    case "accountId":
      return "account";
    case "destinationAccountId":
      return "destination account";
    default:
      return field;
  }
}

function currentLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: { backgroundColor: colors.background, flex: 1 },
    fixedHeader: { backgroundColor: colors.background, gap: 20, paddingBottom: 10, paddingHorizontal: 20 },
    content: { paddingBottom: 40, paddingHorizontal: 20, paddingTop: 10, gap: 20 },
    title: { color: colors.textPrimary, fontSize: 26, fontWeight: "700" },
    subtitle: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
    draftNotice: {
      backgroundColor: colors.primarySurface,
      borderColor: colors.primary,
      borderWidth: 1,
      gap: 4,
      padding: 14,
    },
    draftNoticeTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    draftNoticeText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    typeSelector: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 0,
    },
    typeOption: {
      backgroundColor: colors.background,
      borderBottomColor: colors.border,
      borderBottomWidth: 3,
      flex: 1,
      paddingHorizontal: 8,
      paddingVertical: 14,
    },
    selectedType: {
      backgroundColor: colors.primarySurface,
      borderBottomColor: colors.primary,
    },
    typeLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: "800" },
    typeDescription: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 3,
    },
    selectedText: { color: colors.textPrimary },
    selectedDescription: { color: colors.textSecondary },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.8,
    },
    amountIntro: { gap: 4, marginTop: 4 },
    amountHint: { color: colors.textSecondary, fontSize: 13 },
    amountInput: {
      fontSize: 30,
      fontWeight: "800",
      minHeight: 72,
      paddingVertical: 12,
    },
    field: { gap: 8 },
    fieldLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
    accountOptions: { gap: 0 },
    accountOption: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      minHeight: 64,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    selectedAccount: {
      backgroundColor: colors.primarySurface,
      borderColor: colors.primary,
    },
    accountName: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
    accountBalance: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
    periodSection: { gap: 10 },
    periodToggle: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingVertical: 14,
    },
    periodCopy: { flex: 1, gap: 4 },
    periodTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
    periodHint: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
    modalBackdrop: {
      backgroundColor: colors.scrim,
      flex: 1,
      justifyContent: "flex-end",
    },
    smartInputSheet: {
      backgroundColor: colors.background,
      maxHeight: "90%",
    },
    smartInputSheetContent: {
      gap: 16,
      padding: 20,
    },
    modalHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 16,
      justifyContent: "space-between",
    },
    modalTitleGroup: { flex: 1, gap: 6 },
    modalTitle: { color: colors.textPrimary, fontSize: 21, fontWeight: "800" },
    modalDescription: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    modalClose: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      minWidth: 44,
    },
    modalCloseText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
    smartInputField: { minHeight: 112, paddingTop: 14 },
    smartInputHint: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.5 },
  });
}
