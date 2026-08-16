import type { ChangeEvent } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/theme";

export function DateField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <input
        aria-label={label}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          boxSizing: "border-box",
          color: colors.textPrimary,
          fontFamily: "inherit",
          fontSize: 16,
          minHeight: 56,
          opacity: disabled ? 0.5 : 1,
          padding: "0 14px",
          width: "100%",
        }}
        type="date"
        value={value}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    field: { gap: 8 },
    label: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  });
}
