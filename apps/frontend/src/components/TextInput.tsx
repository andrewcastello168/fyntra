import {
  TextInput as NativeTextInput,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTheme } from "@/src/theme";

export function TextInput({
  label,
  error,
  prefix,
  secureTextEntry = false,
  ...props
}: React.ComponentProps<typeof NativeTextInput> & {
  label: string;
  error?: string;
  prefix?: string;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const hasPasswordToggle = Boolean(secureTextEntry);
  const hasAccessory = hasPasswordToggle || Boolean(prefix);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={hasAccessory ? styles.inputRow : undefined}>
        {prefix ? (
          <Text pointerEvents="none" style={styles.prefix}>
            {prefix}
          </Text>
        ) : null}
        <NativeTextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={
            hasPasswordToggle ? !passwordVisible : secureTextEntry
          }
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            styles.input,
            prefix && styles.inputWithPrefix,
            hasPasswordToggle && styles.inputWithIcon,
            focused && styles.inputFocused,
            error && styles.inputError,
            props.style,
          ]}
        />
        {hasPasswordToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              passwordVisible ? `Hide ${label}` : `Show ${label}`
            }
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={styles.passwordButton}
            hitSlop={4}
          >
            <Ionicons
              name={passwordVisible ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    wrap: { gap: 7 },
    label: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 16,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      fontSize: 16,
    },
    inputWithIcon: { paddingRight: 54 },
    inputWithPrefix: { paddingLeft: 52 },
    inputRow: { position: "relative" },
    prefix: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: "700",
      left: 16,
      position: "absolute",
      top: 16,
      zIndex: 1,
    },
    passwordButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      position: "absolute",
      right: 6,
      top: 5,
      width: 44,
    },
    inputError: { borderColor: colors.danger, borderWidth: 1.5 },
    inputFocused: { borderColor: colors.focus, borderWidth: 1.5 },
    error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  });
}
