import { useCallback, useState } from "react";
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
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, getStoredAccessToken } from "@/src/api/client";
import { Account, AccountsResponse } from "@/src/api/types";
import { Button } from "@/src/components/Button";
import { EmptyState } from "@/src/components/EmptyState";
import { ErrorState } from "@/src/components/ErrorState";
import { LoadingState } from "@/src/components/LoadingState";
import { TextInput } from "@/src/components/TextInput";
import { ThemeColors, useTheme } from "@/src/theme";
import { errorMessage, formatCurrency } from "@/src/utils/format";
import { BalanceVisibilityButton } from "@/src/components/BalanceVisibilityButton";
import { maskBalance, useBalanceVisibility } from "@/src/privacy/BalanceVisibilityProvider";

const accountTypes = [
  { key: "BANK", label: "Bank" },
  { key: "E_WALLET", label: "E-wallet" },
  { key: "CASH", label: "Cash" },
] as const;

export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isBalanceVisible } = useBalanceVisibility();
  const styles = createStyles(colors);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("BANK");
  const [initialBalance, setInitialBalance] = useState("0");

  const loadAccounts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const token = await getStoredAccessToken();
      if (!token) throw new Error("Login session not found.");
      const result = await apiFetch<AccountsResponse>("/accounts", {}, token);
      setAccounts(result.data);
    } catch (loadError) {
      setError(errorMessage(loadError, "Accounts could not be loaded."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAccounts();
    }, [loadAccounts]),
  );

  async function createAccount() {
    if (!accountName.trim()) {
      Alert.alert("Check your entries", "Account name is required.");
      return;
    }
    if (Number(initialBalance) < 0) {
      Alert.alert("Check your entries", "Starting balance cannot be negative.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getStoredAccessToken();
      if (!token) throw new Error("Login session not found.");
      await apiFetch(
        "/accounts",
        {
          method: "POST",
          body: JSON.stringify({
            accountName: accountName.trim(),
            accountType,
            initialBalance: Number(initialBalance) || 0,
          }),
        },
        token,
      );
      setShowCreate(false);
      setAccountName("");
      setInitialBalance("0");
      await loadAccounts(true);
    } catch (createError) {
      Alert.alert(
        "Account creation failed",
        errorMessage(createError, "The account could not be created."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function deactivateAccount(account: Account) {
    Alert.alert(
      "Deactivate account?",
      `${account.accountName} will no longer be available for new transactions.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: () => void confirmDeactivate(account.id),
        },
      ],
    );
  }

  async function confirmDeactivate(accountId: number) {
    try {
      const token = await getStoredAccessToken();
      if (!token) throw new Error("Login session not found.");
      await apiFetch(
        "/accounts",
        {
          method: "DELETE",
          body: JSON.stringify({ accountId }),
        },
        token,
      );
      await loadAccounts(true);
    } catch (deleteError) {
      Alert.alert(
        "Account deactivation failed",
        errorMessage(deleteError, "The account could not be deactivated."),
      );
    }
  }

  if (loading) return <LoadingState label="Loading accounts..." />;

  const totalBalance = accounts.reduce((sum, account) => sum + account.currentBalance, 0);

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: 40 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadAccounts(true)}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Accounts</Text>
            <Text style={styles.subtitle}>
              Manage where you keep your money.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add account"
            onPress={() => setShowCreate(true)}
            style={styles.addButton}
          >
            <Text style={styles.addLabel}>+</Text>
          </Pressable>
        </View>
        {error ? <ErrorState message={error} /> : null}
        <View style={styles.totalBalance}>
          <View style={styles.totalCopy}><Text style={styles.totalLabel}>TOTAL BALANCE</Text><Text style={styles.totalValue}>{isBalanceVisible ? formatCurrency(totalBalance) : maskBalance()}</Text></View>
          <BalanceVisibilityButton />
        </View>
        {accounts.length ? (
          <View style={styles.list}>
            {accounts.map((account, index) => (
              <Pressable key={account.id} style={({ pressed }) => [styles.accountRow, pressed && styles.pressed]} accessibilityRole="button" onPress={() => router.push(`/account/${account.id}` as never)} accessibilityLabel={`${account.accountName}, balance ${isBalanceVisible ? formatCurrency(account.currentBalance) : "hidden"}`}>
                <View style={[styles.identityRail, { backgroundColor: index % 2 ? colors.transfer : colors.primary }]} />
                <View style={styles.accountMain}>
                  <View style={styles.accountTopline}>
                    <View style={styles.accountCopy}>
                      <Text style={styles.accountName}>{account.accountName}</Text>
                      <Text style={styles.accountType}>{accountTypeLabel(account.accountType)}</Text>
                    </View>
                    <View style={styles.balanceLine}>
                      <Text style={styles.balance}>{isBalanceVisible ? formatCurrency(account.currentBalance) : maskBalance()}</Text>
                      <BalanceVisibilityButton />
                    </View>
                  </View>
                  <View style={styles.accountFooter}>
                    <Text style={styles.status}>{account.isActive ? "Available for transactions" : "Inactive"}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Deactivate ${account.accountName}`} onPress={(event) => { event.stopPropagation(); deactivateAccount(account); }} hitSlop={8}>
                      <Text style={styles.deactivate}>Deactivate</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No accounts yet"
            message="Add your first account to start tracking your finances."
          />
        )}
      </ScrollView>

      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
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
              <Text style={styles.modalTitle}>Add account</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            <TextInput
              label="Account name"
              value={accountName}
              onChangeText={setAccountName}
              placeholder="Example: Checking account"
            />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Account type</Text>
              <View style={styles.typeRow}>
                {accountTypes.map((type) => (
                  <Pressable
                    key={type.key}
                    onPress={() => setAccountType(type.key)}
                    style={[
                      styles.typeChip,
                      accountType === type.key && styles.selectedChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        accountType === type.key && styles.selectedChipText,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <TextInput
              label="Starting balance"
              value={initialBalance}
              onChangeText={setInitialBalance}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <Button
              label="Save account"
              onPress={() => void createAccount()}
              loading={submitting}
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function accountTypeLabel(type: string) {
  return accountTypes.find((item) => item.key === type)?.label ?? type;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 18, paddingBottom: 40 },
    header: { alignItems: "center", flexDirection: "row", gap: 12 },
    headerCopy: { flex: 1, gap: 4 },
    title: { color: colors.textPrimary, fontSize: 26, fontWeight: "700" },
    subtitle: { color: colors.textSecondary, fontSize: 14 },
    addButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 10,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    addLabel: {
      color: colors.onPrimary,
      fontSize: 28,
      fontWeight: "400",
      lineHeight: 30,
    },
    list: {},
    totalBalance: { alignItems: "center", backgroundColor: colors.surface, flexDirection: "row", justifyContent: "space-between", minHeight: 104, paddingHorizontal: 18 },
    totalCopy: { gap: 6 },
    totalLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
    totalValue: { color: colors.textPrimary, fontSize: 28, fontWeight: "800" },
    accountRow: { borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", minHeight: 116, paddingVertical: 18 },
    pressed: { opacity: 0.65 },
    identityRail: { alignSelf: "flex-start", height: 38, marginTop: 2, width: 5 },
    accountMain: { flex: 1, gap: 15, paddingLeft: 12 },
    accountTopline: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
    accountCopy: { flex: 1, gap: 5 },
    accountName: { color: colors.textPrimary, fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
    accountType: { color: colors.textSecondary, fontSize: 13 },
    accountFooter: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingTop: 10 },
    status: { color: colors.textSecondary, fontSize: 12 },
    deactivate: { color: colors.danger, fontSize: 13, fontWeight: "600" },
    balanceLine: { alignItems: "center", flexDirection: "row", gap: 2 },
    balance: { color: colors.textPrimary, fontSize: 20, fontWeight: "800", textAlign: "right" },
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
    field: { gap: 8 },
    fieldLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
    typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    typeChip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 6,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    selectedChip: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeChipText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "700",
    },
    selectedChipText: { color: colors.onPrimary },
  });
}
