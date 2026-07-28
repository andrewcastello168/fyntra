import {
  TextInput as NativeTextInput,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "@/src/theme";

export function TextInput({
  label,
  error,
  ...props
}: React.ComponentProps<typeof NativeTextInput> & {
  label: string;
  error?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <NativeTextInput
        accessibilityLabel={label}
        placeholderTextColor="#64748B"
        {...props}
        style={[styles.input, error && styles.inputError, props.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: colors.text, fontSize: 15, fontWeight: "600" },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16,
  },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontSize: 13 },
});
