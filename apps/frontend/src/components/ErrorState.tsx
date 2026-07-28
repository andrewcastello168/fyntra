import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/src/theme";
export function ErrorState({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.errorSurface,
    gap: 4,
  },
  title: { color: colors.error, fontSize: 15, fontWeight: "700" },
  message: { color: colors.error, fontSize: 14, lineHeight: 20 },
});
