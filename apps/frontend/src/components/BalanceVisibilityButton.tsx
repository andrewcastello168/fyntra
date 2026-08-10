import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { useBalanceVisibility } from "@/src/privacy/BalanceVisibilityProvider";
import { useTheme } from "@/src/theme";

export function BalanceVisibilityButton() {
  const { colors } = useTheme();
  const { isBalanceVisible, toggleBalanceVisibility } = useBalanceVisibility();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isBalanceVisible ? "Hide balances" : "Show balances"}
      accessibilityState={{ checked: isBalanceVisible }}
      onPress={toggleBalanceVisibility}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.65 }]}
    >
      <Ionicons
        name={isBalanceVisible ? "eye-outline" : "eye-off-outline"}
        size={20}
        color={colors.primary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
});
