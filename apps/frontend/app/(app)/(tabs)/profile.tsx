import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/src/components/Button";
import { ErrorState } from "@/src/components/ErrorState";
import { LoadingState } from "@/src/components/LoadingState";
import { useAuth } from "@/src/auth/AuthProvider";
import { ThemeColors, ThemeMode, useTheme } from "@/src/theme";
import { errorMessage } from "@/src/utils/format";
export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();
  const styles = createStyles(colors);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        await refreshUser();
      } catch (profileError) {
        setError(
          errorMessage(profileError, "The profile could not be loaded."),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshUser],
  );

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  if (loading && !user) return <LoadingState label="Loading profile..." />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: 32 + insets.bottom },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadProfile(true)}
        />
      }
    >
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Account and app settings.</Text>
      {error ? <ErrorState message={error} /> : null}
      <View style={styles.profile}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <Text style={styles.email}>{user?.email ?? "-"}</Text>
        {user?.profile?.username ? (
          <Text style={styles.muted}>@{user.profile.username}</Text>
        ) : null}
        {user?.profile?.full_name ? (
          <Text style={styles.muted}>{user.profile.full_name}</Text>
        ) : null}
      </View>
      <View style={styles.settingsSection}>
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <Text style={styles.infoTitle}>Appearance</Text>
        <Text style={styles.muted}>
          Choose a theme or follow your device setting.
        </Text>
        <View style={styles.themeOptions}>
          {(
            [
              ["system", "Automatic", "phone-portrait-outline"],
              ["light", "Light", "sunny-outline"],
              ["dark", "Dark", "moon-outline"],
            ] as const
          ).map(([value, label, icon]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === value }}
              onPress={() => setMode(value as ThemeMode)}
              style={[
                styles.themeOption,
                mode === value && styles.selectedTheme,
              ]}
            >
              <Ionicons
                name={icon}
                size={18}
                color={mode === value ? colors.onPrimary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.themeOptionText,
                  mode === value && styles.selectedThemeText,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Button
        label="Sign out"
        variant="destructive"
        onPress={() => void logout()}
      />
    </ScrollView>
  );
}
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 20 },
    title: { color: colors.textPrimary, fontSize: 26, fontWeight: "700" },
    subtitle: { color: colors.textSecondary, fontSize: 14 },
    profile: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingBottom: 18,
      gap: 8,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1,
    },
    email: { color: colors.textPrimary, fontSize: 17, fontWeight: "700" },
    muted: { color: colors.textSecondary, fontSize: 15 },
    settingsSection: { gap: 10 },
    infoTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
    themeOptions: { flexDirection: "row", gap: 8, marginTop: 4 },
    themeOption: {
      alignItems: "center",
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: 6,
      borderWidth: 1,
      flex: 1,
      gap: 6,
      minHeight: 56,
      justifyContent: "center",
      paddingHorizontal: 6,
      paddingVertical: 10,
    },
    selectedTheme: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    themeOptionText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
    selectedThemeText: { color: colors.onPrimary },
  });
}
