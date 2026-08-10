import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth/AuthProvider";
import { disableBiometricLogin, getStoredAccessToken, hasBiometricCredential, setBiometricCredential } from "@/src/api/client";
import { useBalanceVisibility } from "@/src/privacy/BalanceVisibilityProvider";
import { ThemeColors, useTheme } from "@/src/theme";
import { errorMessage } from "@/src/utils/format";
import { ErrorState } from "@/src/components/ErrorState";
import { LoadingState } from "@/src/components/LoadingState";

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const { colors, mode } = useTheme();
  const { hideBalancesByDefault, setHideBalancesByDefault, isBalanceVisible, lockBalances } = useBalanceVisibility();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      await refreshUser();
      setBiometricEnabled(await hasBiometricCredential());
    } catch (e) { setError(errorMessage(e, "The profile could not be loaded.")); }
    finally { setLoading(false); setRefreshing(false); }
  }, [refreshUser]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function toggleBiometric(value: boolean) {
    setBiometricBusy(true);
    try {
      if (!value) { await disableBiometricLogin(); setBiometricEnabled(false); return; }
      if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) {
        Alert.alert("Biometric login unavailable", "Enroll Face ID or a fingerprint on this device first.");
        return;
      }
      const token = await getStoredAccessToken();
      if (!token || !(await setBiometricCredential(token))) throw new Error("Biometric login could not be enabled.");
      setBiometricEnabled(true);
    } catch (e) { Alert.alert("Biometric login", errorMessage(e, "Biometric login could not be enabled.")); }
    finally { setBiometricBusy(false); }
  }

  if (loading && !user) return <LoadingState label="Loading settings..." />;
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 36 + insets.bottom }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}>
    <Text style={styles.title}>Settings</Text>
    <Text style={styles.subtitle}>Make the app feel right for you.</Text>
    {error ? <ErrorState message={error} /> : null}
    <SettingsSection label="PROFILE">
      <SettingsRow icon="person-outline" title={user?.profile?.full_name || "Your profile"} detail={user?.email ?? ""} />
    </SettingsSection>
    <SettingsSection label="PREFERENCES">
      <SettingsRow icon="color-palette-outline" title="Appearance" detail={mode[0].toUpperCase() + mode.slice(1)} onPress={() => router.push("/appearance" as never)} />
      <SettingsRow icon="cash-outline" title="Currency" detail="IDR" />
      <SettingsRow icon="calendar-outline" title="Start of budget period" detail="Manage in a new income" />
    </SettingsSection>
    <SettingsSection label="PRIVACY & SECURITY">
      <SettingsRow icon="finger-print-outline" title="Biometric login" detail={biometricEnabled ? "Enabled" : "Disabled"} trailing={<Switch value={biometricEnabled} disabled={biometricBusy} onValueChange={(v) => void toggleBiometric(v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.surface} />} />
      <SettingsRow icon="eye-off-outline" title="Hide balances by default" detail="Mask financial amounts on launch" trailing={<Switch value={hideBalancesByDefault} onValueChange={(v) => void setHideBalancesByDefault(v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.surface} />} />
      <SettingsRow icon={isBalanceVisible ? "eye-off-outline" : "eye-outline"} title={isBalanceVisible ? "Lock balances" : "Balances are hidden"} detail={isBalanceVisible ? "Hide them for this secure session" : "Tap an eye to unlock"} onPress={lockBalances} />
    </SettingsSection>
    <SettingsSection label="ACCOUNT">
      <SettingsRow icon="wallet-outline" title="Manage accounts" detail="View and organize your accounts" onPress={() => router.push("/(app)/(tabs)/accounts" as never)} />
      <SettingsRow icon="log-out-outline" title="Sign out" detail="End this session on this device" danger onPress={() => void logout()} />
    </SettingsSection>
  </ScrollView>;
}

function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) { const { colors } = useTheme(); return <View style={{ gap: 4 }}><Text style={[sectionStyles.label, { color: colors.textSecondary }]}>{label}</Text><View>{children}</View></View>; }
function SettingsRow({ icon, title, detail, onPress, trailing, danger = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress?: () => void; trailing?: React.ReactNode; danger?: boolean }) {
  const { colors } = useTheme(); const content = <><Ionicons name={icon} size={21} color={danger ? colors.danger : colors.primary} /><View style={{ flex: 1, gap: 3 }}><Text style={{ color: danger ? colors.danger : colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{title}</Text><Text style={{ color: colors.textSecondary, fontSize: 13 }}>{detail}</Text></View>{trailing ?? (onPress ? <Ionicons name="chevron-forward" size={19} color={colors.textSecondary} /> : null)}</>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [rowStyles.row, pressed && { opacity: 0.65 }]}>{content}</Pressable> : <View style={rowStyles.row}>{content}</View>;
}
const sectionStyles = StyleSheet.create({ label: { fontSize: 12, fontWeight: "800", letterSpacing: 1, marginBottom: 4 } });
const rowStyles = StyleSheet.create({ row: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row", gap: 14, minHeight: 68, paddingVertical: 10 } });
function createStyles(colors: ThemeColors) { return StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { gap: 26, paddingHorizontal: 20 }, title: { color: colors.textPrimary, fontSize: 28, fontWeight: "800" }, subtitle: { color: colors.textSecondary, fontSize: 15, marginTop: -18 } }); }
