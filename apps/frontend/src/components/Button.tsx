import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "@/src/theme";

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "destructive";
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading || disabled }}
      disabled={loading || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "secondary"
          ? styles.secondary
          : variant === "destructive"
            ? styles.destructive
            : styles.primary,
        pressed && styles.pressed,
        (loading || disabled) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "secondary" ? colors.primary : colors.onPrimary}
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "secondary" && styles.secondaryLabel,
            variant === "destructive" && styles.destructiveLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    base: {
      minHeight: 52,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    primary: { backgroundColor: colors.primary },
    secondary: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    destructive: { backgroundColor: colors.danger },
    pressed: { opacity: 0.82 },
    disabled: { opacity: 0.55 },
    label: { color: colors.onPrimary, fontSize: 16, fontWeight: "600", letterSpacing: 0.1 },
    secondaryLabel: { color: colors.primary },
    destructiveLabel: { color: colors.onPrimary },
  });
}
