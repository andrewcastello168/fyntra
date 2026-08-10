import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, getStoredAccessToken } from "@/src/api/client";
import { Account, AccountsResponse } from "@/src/api/types";
import { useBalanceVisibility, maskBalance } from "@/src/privacy/BalanceVisibilityProvider";
import { ThemeColors, useTheme } from "@/src/theme";
import { formatCurrency, errorMessage } from "@/src/utils/format";
import { LoadingState } from "@/src/components/LoadingState";
import { BalanceVisibilityButton } from "@/src/components/BalanceVisibilityButton";

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { colors } = useTheme(); const styles = createStyles(colors); const { isBalanceVisible } = useBalanceVisibility(); const insets = useSafeAreaInsets(); const [account, setAccount] = useState<Account | null>(null); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { try { const token = await getStoredAccessToken(); if (!token) throw new Error('Login session not found.'); const result = await apiFetch<AccountsResponse>('/accounts', {}, token); setAccount(result.data.find((item) => item.id === Number(id)) ?? null); } catch (e) { Alert.alert('Account unavailable', errorMessage(e, 'The account could not be loaded.')); } finally { setLoading(false); } }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (loading) return <LoadingState label="Loading account..." />;
  if (!account) return <View style={styles.screen}><Text style={styles.title}>Account not found</Text></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 32 + insets.bottom, gap: 24 }}><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.textPrimary} /><Text style={styles.backText}>Accounts</Text></Pressable><View style={{ gap: 6 }}><Text style={styles.title}>{account.accountName}</Text><Text style={styles.subtitle}>{account.isActive ? 'Available for transactions' : 'Inactive'}</Text></View><View style={styles.balance}><Text style={styles.label}>CURRENT BALANCE</Text><View style={styles.balanceLine}><Text style={styles.value}>{isBalanceVisible ? formatCurrency(account.currentBalance) : maskBalance()}</Text><BalanceVisibilityButton /></View></View><View style={styles.meta}><Meta label="Account type" value={account.accountType === 'E_WALLET' ? 'E-wallet' : account.accountType === 'BANK' ? 'Bank account' : 'Cash'} /><Pressable style={styles.history} onPress={() => router.push(`/transactions?accountId=${account.id}` as never)}><Text style={styles.historyText}>Transaction history</Text><Ionicons name="chevron-forward" size={20} color={colors.primary} /></Pressable></View></ScrollView>;
}
function Meta({ label, value }: { label: string; value: string }) { const { colors } = useTheme(); return <View style={{ gap: 6 }}><Text style={{ color: colors.textSecondary, fontSize: 13 }}>{label}</Text><Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>{value}</Text></View>; }
function createStyles(colors: ThemeColors) { return StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, back: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 44 }, backText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' }, title: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' }, subtitle: { color: colors.textSecondary, fontSize: 15 }, balance: { backgroundColor: colors.surface, gap: 10, padding: 20 }, label: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1 }, balanceLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, value: { color: colors.textPrimary, fontSize: 30, fontWeight: '800' }, meta: { gap: 24 }, history: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 60 }, historyText: { color: colors.primary, fontSize: 16, fontWeight: '700' } }); }
