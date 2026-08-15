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
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, apiFetch, getStoredAccessToken } from "@/src/api/client";
import {
  Account,
  AccountsResponse,
  ActivePeriodResponse,
  BudgetPeriod,
  CreateTransactionResponse,
  TransactionDraftResponse,
  Transaction,
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

type SmartDraft = TransactionDraftResponse["data"]["draft"] & {
  accountResolution: TransactionDraftResponse["data"]["accountResolution"];
  requestedAccountName: string | null;
  accountCandidates: { id: number; accountName: string }[];
  warnings: string[];
};

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
  const [smartInputOpen, setSmartInputOpen] = useState(false);
  const [smartInputText, setSmartInputText] = useState("");
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [smartInputError, setSmartInputError] = useState<string | null>(null);
  const [smartInputHint, setSmartInputHint] = useState<string | null>(null);
  const [smartDraft, setSmartDraft] = useState<SmartDraft | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

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
    setSmartInputHint(null);
    setSmartDraft(null);
    setSmartInputOpen(true);
  }

  function closeSmartInput() {
    if (generatingDraft || submitting) return;
    setSmartInputOpen(false);
    setSmartInputError(null);
    setSmartInputHint(null);
    setSmartDraft(null);
  }

  async function generateDraft() {
    const text = smartInputText.trim();

    if (!text) {
      setSmartInputError("Describe a transaction to continue.");
      setSmartInputHint("Try: makan 50k pakai BCA");
      return;
    }

    setGeneratingDraft(true);
    setSmartInputError(null);
    setSmartInputHint(null);
    setSmartDraft(null);

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
      const {
        draft,
        missingFields,
        warnings,
        accountResolution,
        requestedAccountName,
        accountCandidates,
      } = response.data;

      if (missingFields.includes("amount")) {
        setSmartInputError("Add an amount to continue.");
        setSmartInputHint("Example: coffee 35k");
        return;
      }

      if (!draft.transactionType || !draft.transactionDate) {
        setSmartInputError("I couldn't understand the transaction.");
        setSmartInputHint("Try: makan 50k pakai BCA");
        return;
      }

      const nextDraft: SmartDraft = {
        ...draft,
        accountId: draft.accountId,
        accountResolution,
        requestedAccountName,
        accountCandidates,
        warnings,
      };
      setSmartDraft(nextDraft);

      if (accountResolution === "ambiguous") {
        setSmartInputError(
          `Which ${requestedAccountName ?? "matching"} account should be used?`,
        );
      } else if (draft.accountId === null) {
        setSmartInputError("Choose an account to continue.");
      }
    } catch (draftError) {
      setSmartInputError("I couldn't understand the transaction.");
      setSmartInputHint(errorMessage(draftError, "Try: makan 50k pakai BCA"));
    } finally {
      setGeneratingDraft(false);
    }
  }

  function applySmartDraft() {
    if (!smartDraft?.transactionType || smartDraft.amount === null) return;
    selectType(smartDraft.transactionType);
    setAmount(String(smartDraft.amount));
    setTransactionDate(smartDraft.transactionDate ?? currentLocalDate());
    setAccountId(smartDraft.accountId);
    setDestinationAccountId(smartDraft.destinationAccountId ?? null);
    setCategory(smartDraft.category ?? "");
    setNote(smartDraft.note ?? "");
    closeSmartInput();
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
    return null;
  }

  async function submit() {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert("Check your entries", validationError);
      return;
    }

    await createTransaction({
      accountId,
      destinationAccountId,
      transactionType: selectedType,
      amount: Number(amount),
      transactionDate,
      category: category.trim() || null,
      note: note.trim() || null,
    });
  }

  async function addSmartDraft() {
    if (
      !smartDraft?.transactionType ||
      smartDraft.amount === null ||
      !smartDraft.transactionDate ||
      smartDraft.accountId === null
    ) {
      setSmartInputError("Choose an account to continue.");
      return;
    }

    await createTransaction({
      accountId: smartDraft.accountId,
      destinationAccountId: smartDraft.destinationAccountId ?? null,
      transactionType: smartDraft.transactionType,
      amount: smartDraft.amount,
      transactionDate: smartDraft.transactionDate,
      category: smartDraft.category,
      note: smartDraft.note,
    });
  }

  async function createTransaction(input: {
    accountId: number | null;
    destinationAccountId: number | null;
    transactionType: TransactionType;
    amount: number;
    transactionDate: string;
    category: string | null;
    note: string | null;
  }) {
    if (!input.accountId || submitting) return;

    setSubmitting(true);
    setSaveStatus(`Creating ${input.transactionType.toLowerCase()}...`);
    try {
      const token = await getStoredAccessToken();
      if (!token) throw new Error("Login session not found.");
      const response = await apiFetch<CreateTransactionResponse>(
        "/transactions",
        {
          method: "POST",
          body: JSON.stringify({
            accountId: input.accountId,
            destinationAccountId:
              input.transactionType === "TRANSFER"
                ? input.destinationAccountId
                : undefined,
            transactionType: input.transactionType,
            amount: input.amount,
            transactionDate: input.transactionDate,
            category: input.category || undefined,
            note: input.note || undefined,
          }),
        },
        token,
      );
      const saved = response.data.transaction;
      setSaveStatus(
        `${transactionLabelForStatus(saved.transactionType)} added`,
      );
      setAmount("");
      setCategory("");
      setNote("");

      if (saved.transactionType === "INCOME") {
        const detail = await apiFetch<{ data: Transaction }>(
          `/transactions/${saved.id}`,
          {},
          token,
        );
        if (detail.data.cycleAction?.status === "AVAILABLE") {
          promptForCycle(detail.data);
        } else {
          openSavedTransaction(Number(saved.id));
        }
      } else {
        openSavedTransaction(Number(saved.id));
      }
    } catch (saveError) {
      setSaveStatus(null);
      const retry = () => void createTransaction(input);
      const message =
        saveError instanceof ApiError && saveError.status < 500
          ? saveError.message
          : "Check your connection and try again.";
      Alert.alert("Failed to save transaction.", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Try Again", onPress: retry },
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  function promptForCycle(income: Transaction) {
    const previousEnd = previousDate(income.transactionDate);
    const body = [
      `Start a new financial cycle from this income on ${formatFriendlyDate(income.transactionDate)}?`,
      activePeriod
        ? `Your current cycle will end on ${formatFriendlyDate(previousEnd)}.`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    Alert.alert("Start a new cycle?", body, [
      {
        text: "Not Now",
        style: "cancel",
        onPress: () => openSavedTransaction(income.id),
      },
      {
        text: "Start New Cycle",
        onPress: () => void startCycle(income),
      },
    ]);
  }

  async function startCycle(income: Transaction) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const token = await getStoredAccessToken();
      if (!token) throw new Error("Login session not found.");
      await apiFetch(
        `/budget-periods/from-income/${income.id}`,
        {
          method: "POST",
          body: JSON.stringify({
            savingPercentage: activePeriod?.savingPercentage ?? 20,
          }),
        },
        token,
      );
      openSavedTransaction(income.id);
    } catch (cycleError) {
      Alert.alert(
        "Income saved",
        errorMessage(cycleError, "Failed to start the financial cycle."),
        [
          {
            text: "Open Income",
            onPress: () => openSavedTransaction(income.id),
          },
        ],
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openSavedTransaction(id: number) {
    setSaveStatus("Opening transaction...");
    requestAnimationFrame(() => {
      router.replace({
        pathname: "/transactions",
        params: { transactionId: String(id) },
      } as never);
    });
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
            <Pressable
              onPress={openSmartInput}
              style={({ pressed }) => [
                styles.aiButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.aiSparkle}>✦</Text>
              <Text style={styles.aiButtonText}>Ask Fyntra AI</Text>
            </Pressable>
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

            {saveStatus ? (
              <Text accessibilityLiveRegion="polite" style={styles.saveStatus}>
                {saveStatus}
              </Text>
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
                <View style={styles.modalTitleRow}>
                  <Text style={styles.aiSparkle}>✦</Text>
                  <Text style={styles.modalTitle}>Fyntra AI</Text>
                </View>

                <Text style={styles.modalDescription}>
                  Describe one transaction. I’ll prepare a draft for you to
                  review.
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close Smart Input"
                accessibilityState={{ disabled: generatingDraft || submitting }}
                disabled={generatingDraft || submitting}
                hitSlop={8}
                onPress={closeSmartInput}
                style={({ pressed }) => [
                  styles.modalClose,
                  pressed && styles.pressed,
                  (generatingDraft || submitting) && styles.disabled,
                ]}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>
            {!smartDraft ? (
              <>
                <TextInput
                  autoFocus
                  editable={!generatingDraft}
                  error={smartInputError ?? undefined}
                  label="Describe your transaction"
                  multiline
                  onChangeText={(value) => {
                    setSmartInputText(value);
                    if (smartInputError) setSmartInputError(null);
                    if (smartInputHint) setSmartInputHint(null);
                  }}
                  placeholder="e.g. Lunch 50k with BCA"
                  style={styles.smartInputField}
                  textAlignVertical="top"
                  value={smartInputText}
                />
                <Text style={styles.smartInputHint}>
                  {smartInputHint ??
                    "Nothing is saved automatically. Review the preview before adding it."}
                </Text>
                <Button
                  label="Preview transaction"
                  loading={generatingDraft}
                  onPress={() => void generateDraft()}
                />
              </>
            ) : (
              <View style={styles.preview}>
                <Text style={styles.previewType}>
                  {transactionLabelForStatus(smartDraft.transactionType!)}
                </Text>
                <Text style={styles.previewAmount}>
                  {formatCurrency(smartDraft.amount ?? 0)}
                </Text>
                <View style={styles.previewDetails}>
                  <Text style={styles.previewPrimary}>
                    {smartDraft.note || smartDraft.category || "Transaction"}
                  </Text>
                  {smartDraft.note && smartDraft.category ? (
                    <Text style={styles.previewSecondary}>
                      {smartDraft.category}
                    </Text>
                  ) : null}
                  <Text style={styles.previewSecondary}>
                    {accounts.find((item) => item.id === smartDraft.accountId)
                      ?.accountName ?? "Choose an account"}
                  </Text>
                  <Text style={styles.previewSecondary}>
                    {smartDraft.transactionDate === currentLocalDate()
                      ? "Today"
                      : formatFriendlyDate(smartDraft.transactionDate!)}
                  </Text>
                </View>
                {smartInputError ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={styles.previewError}
                  >
                    {smartInputError}
                  </Text>
                ) : null}
                {smartDraft.accountId === null ? (
                  <SelectField
                    label="Account"
                    selectedId={smartDraft.accountId}
                    options={accountOptions()}
                    onSelect={(id) => {
                      setSmartDraft((current) =>
                        current ? { ...current, accountId: id } : current,
                      );
                      setSmartInputError(null);
                    }}
                  />
                ) : null}
                {saveStatus ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={styles.saveStatus}
                  >
                    {saveStatus}
                  </Text>
                ) : null}
                <View style={styles.previewActions}>
                  <View style={styles.previewAction}>
                    <Button
                      label="Edit"
                      variant="secondary"
                      disabled={submitting}
                      onPress={applySmartDraft}
                    />
                  </View>
                  <View style={styles.previewAction}>
                    <Button
                      label={`Add ${transactionLabelForStatus(smartDraft.transactionType!)}`}
                      loading={submitting}
                      disabled={smartDraft.accountId === null}
                      onPress={() => void addSmartDraft()}
                    />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function currentLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function transactionLabelForStatus(type: TransactionType) {
  return type === "INCOME"
    ? "Income"
    : type === "EXPENSE"
      ? "Expense"
      : "Transfer";
}

function previousDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
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
    scroll: { backgroundColor: colors.background, flex: 1 },
    fixedHeader: {
      backgroundColor: colors.background,
      gap: 20,
      paddingBottom: 10,
      paddingHorizontal: 20,
    },
    content: {
      paddingBottom: 40,
      paddingHorizontal: 20,
      paddingTop: 10,
      gap: 20,
    },
    title: { color: colors.textPrimary, fontSize: 26, fontWeight: "700" },
    subtitle: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
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
    modalCloseText: { color: colors.primary, fontSize: 20, fontWeight: "600" },
    smartInputField: { minHeight: 112, paddingTop: 14 },
    smartInputHint: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    saveStatus: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    preview: { gap: 16 },
    previewType: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    previewAmount: {
      color: colors.textPrimary,
      fontSize: 32,
      fontWeight: "800",
    },
    previewDetails: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: 6,
      paddingVertical: 16,
    },
    previewPrimary: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    previewSecondary: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    previewError: {
      color: colors.danger,
      fontSize: 14,
      lineHeight: 20,
    },
    previewActions: { flexDirection: "row", gap: 12 },
    previewAction: { flex: 1 },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.5 },
    aiButton: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.background,
    },
    aiSparkle: {
      color: "#10B981",
      fontSize: 20,
      fontWeight: "800",
    },
    aiButtonText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    modalTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
  });
}
