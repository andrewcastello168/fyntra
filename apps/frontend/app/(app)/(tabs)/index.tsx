import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch, getStoredAccessToken } from "@/src/api/client";
import { BalanceVisibilityButton } from "@/src/components/BalanceVisibilityButton";
import { EmptyState } from "@/src/components/EmptyState";
import { ErrorState } from "@/src/components/ErrorState";
import { LoadingState } from "@/src/components/LoadingState";

import {
  ActivePeriodResponse,
  BudgetPeriod,
  Dashboard,
  DashboardResponse,
} from "@/src/api/types";

import {
  useBalanceVisibility,
  maskBalance,
} from "@/src/privacy/BalanceVisibilityProvider";

import { ThemeColors, useTheme } from "@/src/theme";

import {
  errorMessage,
  formatCurrency,
  formatDate,
  transactionColor,
  transactionLabel,
} from "@/src/utils/format";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { isBalanceVisible } = useBalanceVisibility();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [activePeriod, setActivePeriod] = useState<BudgetPeriod | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
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

      const [summary, period] = await Promise.all([
        apiFetch<DashboardResponse>("/home/summary", {}, token),
        apiFetch<ActivePeriodResponse>("/budget-periods/active", {}, token),
      ]);

      setDashboard(summary.data);
      setActivePeriod(period.data);
    } catch (loadError) {
      setError(errorMessage(loadError, "The summary could not be loaded."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const pageHeader = (
    <View
      style={[
        styles.fixedHeader,
        {
          paddingTop: insets.top + 12,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.brandRow}>
            <Image
              source={require("../../../assets/images/fyntra-symbol.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.brandName}>Fyntra</Text>
          </View>

          <Text style={styles.title}>Your money, at a glance.</Text>

          <Text style={styles.headerSubtitle}>
            Your finances, simply organized.
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading && !dashboard) {
    return <LoadingState label="Loading summary..." />;
  }

  if (error && !dashboard) {
    return (
      <View style={styles.screen}>
        {pageHeader}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.errorContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadDashboard(true)}
            />
          }
        >
          <ErrorState message={error} />
        </ScrollView>
      </View>
    );
  }

  if (!dashboard) {
    return null;
  }

  const money = (value: number) =>
    isBalanceVisible ? formatCurrency(value) : maskBalance();

  const budget = Math.max(0, dashboard.mid.spendingBudget);

  const remaining = Math.max(0, dashboard.mid.remainingBudget);

  const spent = Math.max(0, budget - remaining);

  const usedPercent =
    budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  const totalDays = activePeriod
    ? daysBetween(activePeriod.startDate, activePeriod.endDate) + 1
    : 0;

  const expectedRemaining =
    totalDays > 0
      ? budget * (dashboard.mid.remainingDays / totalDays)
      : remaining;

  const onTrack = remaining >= expectedRemaining;

  return (
    <View style={styles.screen}>
      {pageHeader}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: 36 + insets.bottom,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadDashboard(true)}
          />
        }
      >
        {error ? <ErrorState message={error} /> : null}

        {/* CURRENT BALANCE */}
        <View style={styles.balanceBlock}>
          <Text style={styles.metricLabel}>Current balance</Text>

          <View style={styles.balanceLine}>
            <Text style={styles.balance}>
              {money(dashboard.top.currentBalance)}
            </Text>

            <BalanceVisibilityButton />
          </View>

          <Text style={styles.balanceHint}>Across your active accounts</Text>
        </View>

        {/* BUDGET */}
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionTitle}>Budget for this period</Text>

              <Text style={styles.sectionMeta}>
                {activePeriod
                  ? `${formatDate(activePeriod.startDate)} — ${formatDate(
                      activePeriod.endDate,
                    )}`
                  : "No active budget period"}
              </Text>
            </View>

            {activePeriod ? (
              <Text
                style={[
                  styles.status,
                  {
                    color: onTrack ? colors.success : colors.warning,
                  },
                ]}
              >
                {onTrack ? "On track" : "Spending faster"}
              </Text>
            ) : null}
          </View>

          {activePeriod ? (
            <View
              style={styles.budgetPanel}
              accessibilityLabel={`Budget ${usedPercent} percent used`}
            >
              {/* BUDGET HEADER */}
              <View style={styles.budgetHeadline}>
                <View style={styles.budgetHeadlineLeft}>
                  <Text style={styles.metricLabel}>Available budget</Text>

                  <Text style={styles.budgetTotal}>{money(budget)}</Text>
                </View>

                <View style={styles.percentBlock}>
                  <Text style={styles.percent}>{usedPercent}%</Text>

                  <Text style={styles.metricLabel}>used</Text>
                </View>
              </View>

              {/* PROGRESS */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${usedPercent}%`,
                      backgroundColor:
                        usedPercent > 85 ? colors.warning : colors.primary,
                    },
                  ]}
                />
              </View>

              {/* SPENT / REMAINING */}
              <View style={styles.valueGrid}>
                <BudgetValue
                  label="Spent"
                  value={money(spent)}
                  styles={styles}
                />

                <BudgetValue
                  label="Remaining"
                  value={money(remaining)}
                  styles={styles}
                  align="right"
                />
              </View>

              {/* DAYS LEFT / SAFE PER DAY */}
              <View style={styles.contextRow}>
                <View style={styles.contextItem}>
                  <Text style={styles.contextLabel} numberOfLines={1}>
                    Days left
                  </Text>

                  <Text style={styles.contextValue}>
                    {dashboard.mid.remainingDays}
                  </Text>
                </View>

                <View style={styles.contextItemRight}>
                  <Text
                    style={styles.contextLabelRight}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    Safe per day
                  </Text>

                  <Text
                    style={styles.contextValueRight}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.55}
                  >
                    {money(dashboard.mid.availablePerDay)}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <EmptyState
              title="Set a budget period"
              message="Start one from an income transaction to track spending progress."
            />
          )}
        </View>

        {/* RECENT ACTIVITY */}
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Recent activity</Text>

            <Text style={styles.sectionMeta}>Latest 5</Text>
          </View>

          {dashboard.bottom.length ? (
            <View>
              {dashboard.bottom.map((transaction) => (
                <View key={transaction.id} style={styles.transactionRow}>
                  <View style={styles.transactionCopy}>
                    <Text style={styles.transactionTitle}>
                      {transaction.category ||
                        transactionLabel(transaction.transactionType)}
                    </Text>

                    <Text style={styles.transactionMeta}>
                      {transaction.accountName}

                      {transaction.destinationAccountName
                        ? ` → ${transaction.destinationAccountName}`
                        : ""}

                      {" · "}

                      {formatDate(transaction.transactionDate)}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.transactionAmount,
                      {
                        color: transactionColor(
                          transaction.transactionType,
                          colors,
                        ),
                      },
                    ]}
                  >
                    {transaction.transactionType === "EXPENSE" ? "-" : "+"}

                    {money(transaction.amount)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              title="No transactions yet"
              message="Recent transactions will appear here."
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start.slice(0, 10)}T00:00:00Z`).getTime();

  const endDate = new Date(`${end.slice(0, 10)}T00:00:00Z`).getTime();

  return Math.max(0, Math.round((endDate - startDate) / 86400000));
}

type ScreenStyles = ReturnType<typeof createStyles>;

function BudgetValue({
  label,
  value,
  styles,
  align = "left",
}: {
  label: string;
  value: string;
  styles: ScreenStyles;
  align?: "left" | "right";
}) {
  return (
    <View style={align === "right" ? styles.alignRight : styles.budgetItem}>
      <Text style={styles.metricLabel}>{label}</Text>

      <Text style={styles.budgetValue}>{value}</Text>
    </View>
  );
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

    fixedHeader: {
      backgroundColor: colors.background,
      paddingBottom: 18,
      paddingHorizontal: 20,
    },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
    },

    headerCopy: {
      flex: 1,
      minWidth: 0,
    },

    brandRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 9,
      marginBottom: 18,
    },

    logo: {
      width: 38,
      height: 38,
    },

    brandName: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.3,
    },

    title: {
      color: colors.textPrimary,
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: -0.7,
      lineHeight: 36,
    },

    headerSubtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 7,
    },

    content: {
      gap: 28,
      paddingBottom: 20,
      paddingHorizontal: 20,
      paddingTop: 14,
    },

    errorContent: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 24,
    },

    balanceBlock: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingBottom: 20,
      paddingTop: 4,
    },

    balanceLine: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },

    metricLabel: {
      color: colors.textSecondary,
      fontSize: 13,
    },

    balance: {
      color: colors.textPrimary,
      flexShrink: 1,
      fontSize: 36,
      fontWeight: "800",
      letterSpacing: -1,
      marginTop: 5,
    },

    balanceHint: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 5,
    },

    section: {
      gap: 14,
      width: "100%",
    },

    sectionHeading: {
      alignItems: "flex-end",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      width: "100%",
    },

    sectionHeadingCopy: {
      flex: 1,
      minWidth: 0,
    },

    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "800",
    },

    sectionMeta: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },

    status: {
      flexShrink: 0,
      fontSize: 12,
      fontWeight: "800",
    },

    budgetPanel: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      gap: 18,
      padding: 16,
      width: "100%",
    },

    budgetHeadline: {
      alignItems: "flex-end",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      width: "100%",
    },

    budgetHeadlineLeft: {
      flex: 1,
      minWidth: 0,
    },

    budgetTotal: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: "800",
      marginTop: 4,
    },

    percentBlock: {
      alignItems: "flex-end",
      flexShrink: 0,
    },

    percent: {
      color: colors.primary,
      fontSize: 26,
      fontWeight: "800",
    },

    progressTrack: {
      backgroundColor: colors.border,
      height: 14,
      overflow: "hidden",
      width: "100%",
    },

    progressFill: {
      height: 14,
    },

    valueGrid: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 16,
      width: "100%",
    },

    budgetItem: {
      flex: 1,
      minWidth: 0,
    },

    alignRight: {
      alignItems: "flex-end",
      flex: 1,
      minWidth: 0,
    },

    budgetValue: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
      marginTop: 4,
    },

    contextRow: {
      flexDirection: "row",
      width: "100%",
      gap: 12,
    },

    contextItem: {
      flex: 1,
      minWidth: 0,
    },

    contextItemRight: {
      flex: 1.8,
      minWidth: 0,
      alignItems: "flex-end",
    },

    contextLabel: {
      color: colors.textSecondary,
      fontSize: 12,
    },

    contextLabelRight: {
      color: colors.textSecondary,
      fontSize: 12,
      width: "100%",
      textAlign: "right",
    },

    contextValue: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "800",
      marginTop: 4,
    },

    contextValueRight: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "800",
      marginTop: 4,
      width: "100%",
      textAlign: "right",
    },

    transactionRow: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingVertical: 14,
      width: "100%",
    },

    transactionCopy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },

    transactionTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },

    transactionMeta: {
      color: colors.textSecondary,
      fontSize: 12,
    },

    transactionAmount: {
      flexShrink: 0,
      fontSize: 13,
      fontWeight: "800",
      textAlign: "right",
    },
  });
}
