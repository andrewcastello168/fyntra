import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemeColors, ThemeMode, useTheme } from "@/src/theme";

export default function AppearanceScreen() {
  const { colors, mode, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  return <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, gap: 24 }}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.textPrimary} /><Text style={styles.backText}>Settings</Text></Pressable>
    <View style={{ gap: 8 }}><Text style={styles.title}>Appearance</Text><Text style={styles.subtitle}>Choose how Personal Tracker looks across your device.</Text></View>
    <View style={styles.options}>{([['system', 'System', 'phone-portrait-outline'], ['light', 'Light', 'sunny-outline'], ['dark', 'Dark', 'moon-outline']] as const).map(([value, label, icon]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: mode === value }} onPress={() => setMode(value as ThemeMode)} style={({ pressed }) => [styles.option, mode === value && styles.selected, pressed && { opacity: 0.7 }]}><Ionicons name={icon} size={22} color={mode === value ? colors.onPrimary : colors.primary} /><View style={{ flex: 1, gap: 3 }}><Text style={[styles.optionText, mode === value && styles.selectedText]}>{label}</Text>{value === 'system' ? <Text style={[styles.hint, mode === value && styles.selectedHint]}>System follows your device appearance.</Text> : null}</View>{mode === value ? <Ionicons name="checkmark-circle" size={22} color={colors.onPrimary} /> : null}</Pressable>)}</View>
  </ScrollView>;
}
function createStyles(colors: ThemeColors) { return StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, back: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 44 }, backText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' }, title: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' }, subtitle: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 }, options: { gap: 0 }, option: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 14, minHeight: 72, paddingHorizontal: 16 }, selected: { backgroundColor: colors.primary }, optionText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' }, selectedText: { color: colors.onPrimary }, hint: { color: colors.textSecondary, fontSize: 13 }, selectedHint: { color: colors.onPrimary } }); }
