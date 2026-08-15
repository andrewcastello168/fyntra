import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet } from "react-native";
import { useBalanceVisibility } from "@/src/privacy/BalanceVisibilityProvider";
import { useTheme } from "@/src/theme";

export function BalanceVisibilityButton() {
  const { colors } = useTheme();
  const { isBalanceVisible, showBalances, lockBalances } =
    useBalanceVisibility();

  async function handlePress() {
    if (isBalanceVisible) {
      return lockBalances();
    } else {
      return showBalances();
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isBalanceVisible ? "Hide balances" : "Show balances"}
      accessibilityState={{ checked: isBalanceVisible }}
      onPress={() => void handlePress()}
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
