import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/theme";
export function ErrorState({ message }: { message: string }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View accessibilityRole="alert" style={styles.container}>
      <Text style={styles.title}>Terjadi kendala</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}
function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      borderLeftWidth: 3,
      paddingLeft: 12,
      paddingVertical: 8,
      backgroundColor: colors.dangerSurface,
      gap: 4,
    },
    title: { color: colors.danger, fontSize: 14, fontWeight: "700" },
    message: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  });
}
