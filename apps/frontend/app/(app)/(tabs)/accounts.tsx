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
import { BalanceVisibilityButton } from "@/src/components/BalanceVisibilityButton";
import { Button } from "@/src/components/Button";
import { EmptyState } from "@/src/components/EmptyState";
import { ErrorState } from "@/src/components/ErrorState";
import { LoadingState } from "@/src/components/LoadingState";
import { TextInput } from "@/src/components/TextInput";
import { ThemeColors, useTheme } from "@/src/theme";
import { errorMessage, formatCurrency } from "@/src/utils/format";
import {
  maskBalance,
  useBalanceVisibility,
} from "@/src/privacy/BalanceVisibilityProvider";

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
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const token = await getStoredAccessToken();

      if (!token) {
        throw new Error("Login session not found.");
      }

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

      if (!token) {
        throw new Error("Login session not found.");
      }

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
      resetCreateForm();

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

  function resetCreateForm() {
    setAccountName("");
    setAccountType("BANK");
    setInitialBalance("0");
  }

  function deactivateAccount(account: Account) {
    Alert.alert(
      "Deactivate account?",
      `${account.accountName} will no longer be available for new transactions.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
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

      if (!token) {
        throw new Error("Login session not found.");
      }

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

  function openCreateModal() {
    resetCreateForm();
    setShowCreate(true);
  }

  function closeCreateModal() {
    if (submitting) return;
    setShowCreate(false);
  }

  if (loading) {
    return <LoadingState label="Loading accounts..." />;
  }

  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.currentBalance,
    0,
  );

  return (
    <>
      <View style={styles.screen}>
        {/* HEADER */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 12,
            },
          ]}
        >
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Accounts</Text>

            <Text style={styles.subtitle}>Where you keep your money.</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add account"
            onPress={openCreateModal}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.addLabel}>+</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: 40 + insets.bottom,
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadAccounts(true)}
            />
          }
        >
          {/* ERROR */}
          {error ? <ErrorState message={error} /> : null}

          {/* TOTAL BALANCE */}
          <View style={styles.totalBalance}>
            <View style={styles.totalCopy}>
              <Text style={styles.totalLabel}>TOTAL BALANCE</Text>

              <Text style={styles.totalValue}>
                {isBalanceVisible
                  ? formatCurrency(totalBalance)
                  : maskBalance()}
              </Text>
            </View>

            <BalanceVisibilityButton />
          </View>

          {/* ACCOUNT LIST */}
          {accounts.length ? (
            <View style={styles.list}>
              {accounts.map((account) => (
                <Pressable
                  key={account.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${account.accountName}, balance ${
                    isBalanceVisible
                      ? formatCurrency(account.currentBalance)
                      : "hidden"
                  }`}
                  onPress={() => router.push(`/account/${account.id}` as never)}
                  style={({ pressed }) => [
                    styles.accountRow,
                    pressed && styles.pressed,
                  ]}
                >
                  {/* ACCOUNT ICON */}
                  <View style={styles.accountIcon}>
                    <Text style={styles.accountIconText}>
                      {account.accountName.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  {/* ACCOUNT CONTENT */}
                  <View style={styles.accountMain}>
                    <View style={styles.accountTopline}>
                      <View style={styles.accountCopy}>
                        <Text style={styles.accountName} numberOfLines={1}>
                          {account.accountName}
                        </Text>

                        <Text style={styles.accountType}>
                          {accountTypeLabel(account.accountType)}
                          {"  ·  "}
                          {account.isActive ? "Available" : "Inactive"}
                        </Text>
                      </View>

                      <Text
                        style={styles.balance}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {isBalanceVisible
                          ? formatCurrency(account.currentBalance)
                          : maskBalance()}
                      </Text>
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
      </View>

      {/* CREATE ACCOUNT MODAL */}
      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={closeCreateModal}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={[
              styles.modalCard,
              {
                paddingBottom: 40 + insets.bottom,
              },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {/* MODAL HEADER */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalTitle}>Add account</Text>

                <Text style={styles.modalSubtitle}>
                  Add a place where you keep your money.
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                disabled={submitting}
                onPress={closeCreateModal}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                  submitting && styles.disabled,
                ]}
              >
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            {/* ACCOUNT NAME */}
            <TextInput
              label="Account name"
              value={accountName}
              onChangeText={setAccountName}
              placeholder="Example: BCA"
              editable={!submitting}
            />

            {/* ACCOUNT TYPE */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Account type</Text>

              <View style={styles.typeRow}>
                {accountTypes.map((type) => {
                  const selected = accountType === type.key;

                  return (
                    <Pressable
                      key={type.key}
                      accessibilityRole="radio"
                      accessibilityState={{
                        selected,
                      }}
                      disabled={submitting}
                      onPress={() => setAccountType(type.key)}
                      style={[
                        styles.typeOption,
                        selected && styles.selectedTypeOption,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          selected && styles.selectedTypeOptionText,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* STARTING BALANCE */}
            <TextInput
              label="Starting balance"
              value={initialBalance}
              onChangeText={setInitialBalance}
              keyboardType="decimal-pad"
              placeholder="0"
              editable={!submitting}
            />

            {/* SAVE */}
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
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    scroll: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      gap: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 40,
    },

    /* =========================
       HEADER
    ========================= */

    header: {
      alignItems: "center",
      backgroundColor: colors.background,
      flexDirection: "row",
      gap: 12,
      paddingBottom: 14,
      paddingHorizontal: 20,
    },

    headerCopy: {
      flex: 1,
      gap: 4,
    },

    title: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -0.5,
    },

    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },

    addButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 42,
    },

    addLabel: {
      color: colors.primary,
      fontSize: 26,
      fontWeight: "400",
      lineHeight: 29,
    },

    /* =========================
       TOTAL BALANCE
    ========================= */

    totalBalance: {
      alignItems: "flex-end",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 22,
      paddingTop: 4,
    },

    totalCopy: {
      gap: 5,
    },

    totalLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.1,
    },

    totalValue: {
      color: colors.textPrimary,
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -0.8,
      marginTop: 1,
    },

    /* =========================
       ACCOUNT LIST
    ========================= */

    list: {
      marginTop: -2,
    },

    accountRow: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 14,
      minHeight: 88,
      paddingVertical: 18,
    },

    accountIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySurface,
      borderRadius: 12,
      height: 46,
      justifyContent: "center",
      width: 46,
    },

    accountIconText: {
      color: colors.primary,
      fontSize: 17,
      fontWeight: "800",
    },

    accountMain: {
      flex: 1,
      minWidth: 0,
    },

    accountTopline: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
    },

    accountCopy: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },

    accountName: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: -0.1,
    },

    accountType: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },

    balance: {
      color: colors.textPrimary,
      flexShrink: 0,
      fontSize: 16,
      fontWeight: "800",
      maxWidth: 150,
      textAlign: "right",
    },

    /* =========================
       GENERAL
    ========================= */

    pressed: {
      opacity: 0.6,
    },

    disabled: {
      opacity: 0.45,
    },

    /* =========================
       MODAL
    ========================= */

    modalBackdrop: {
      backgroundColor: colors.scrim,
      flex: 1,
      justifyContent: "flex-end",
    },

    modalCard: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      gap: 20,
      padding: 24,
      paddingBottom: 40,
    },

    modalHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 16,
      justifyContent: "space-between",
    },

    modalTitleGroup: {
      flex: 1,
      gap: 5,
    },

    modalTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.3,
    },

    modalSubtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },

    closeButton: {
      alignItems: "center",
      height: 36,
      justifyContent: "center",
      width: 36,
    },

    close: {
      color: colors.textSecondary,
      fontSize: 19,
      fontWeight: "600",
    },

    /* =========================
       FORM
    ========================= */

    field: {
      gap: 8,
    },

    fieldLabel: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },

    /* =========================
       ACCOUNT TYPE
    ========================= */

    typeRow: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: "row",
      padding: 3,
    },

    typeOption: {
      alignItems: "center",
      borderRadius: 7,
      flex: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 6,
    },

    selectedTypeOption: {
      backgroundColor: colors.primarySurface,
    },

    typeOptionText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "700",
    },

    selectedTypeOptionText: {
      color: colors.primary,
    },
  });
}
