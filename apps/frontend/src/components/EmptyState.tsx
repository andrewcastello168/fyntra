import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/theme";
export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}
function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { paddingVertical: 24, gap: 6 },
    title: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
    message: {
      color: colors.textSecondary,
      fontSize: 15,
      textAlign: "left",
      lineHeight: 22,
    },
  });
}
