import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useTheme } from "@/src/theme";

export type SelectOption = {
  id: number;
  label: string;
  secondary?: string;
  disabled?: boolean;
};

export function SelectField({ label, selectedId, options, onSelect, disabled = false }: { label: string; selectedId: number | null; options: SelectOption[]; onSelect: (id: number) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === selectedId);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? "Select an account"}`}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, disabled && styles.disabled, pressed && styles.pressed]}
      >
        <View style={styles.triggerCopy}>
          <Text style={selected ? styles.selectedText : styles.placeholder}>{selected?.label ?? "Select an account"}</Text>
          {selected?.secondary ? <Text style={styles.secondary}>{selected.secondary}</Text> : null}
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.primary} />
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close account selector" onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.optionList} keyboardShouldPersistTaps="handled">
              {options.map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.id === selectedId, disabled: option.disabled }}
                  disabled={option.disabled}
                  onPress={() => { onSelect(option.id); setOpen(false); }}
                  style={({ pressed }) => [styles.option, option.id === selectedId && styles.selectedOption, option.disabled && styles.disabled, pressed && styles.pressed]}
                >
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionLabel, option.id === selectedId && styles.selectedOptionText]}>{option.label}</Text>
                    {option.secondary ? <Text style={styles.secondary}>{option.secondary}</Text> : null}
                  </View>
                  {option.id === selectedId ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    field: { gap: 8 }, label: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" }, trigger: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 56, paddingHorizontal: 14, paddingVertical: 10 }, triggerCopy: { flex: 1, gap: 3 }, selectedText: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" }, placeholder: { color: colors.placeholder, fontSize: 16 }, secondary: { color: colors.textSecondary, fontSize: 12 }, pressed: { opacity: 0.7 }, disabled: { opacity: 0.5 }, backdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: "flex-end" }, sheet: { backgroundColor: colors.background, gap: 16, maxHeight: "75%", padding: 20, paddingBottom: 28 }, sheetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, sheetTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "800" }, close: { color: colors.primary, fontSize: 15, fontWeight: "700" }, optionList: { gap: 8 }, option: { alignItems: "center", backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 }, selectedOption: { backgroundColor: colors.primarySurface }, optionCopy: { flex: 1, gap: 3 }, optionLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" }, selectedOptionText: { color: colors.primary },
  });
}
