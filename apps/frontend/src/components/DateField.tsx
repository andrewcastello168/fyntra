import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "@/src/components/Button";
import { useTheme } from "@/src/theme";
import { dateFromDateOnly, dateOnlyFromDate } from "@/src/utils/date";

const friendlyDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function friendlyDate(value: string) {
  return friendlyDateFormatter.format(dateFromDateOnly(value));
}

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
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(() => dateFromDateOnly(value));
  const displayDate = friendlyDate(value);

  function openPicker() {
    setDraftDate(dateFromDateOnly(value));
    setOpen(true);
  }

  function handleChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "dismissed" || !selectedDate) return;
    setDraftDate(selectedDate);
    if (Platform.OS === "android") onChange(dateOnlyFromDate(selectedDate));
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayDate}`}
        accessibilityHint="Opens the date picker"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={openPicker}
        style={({ pressed }) => [
          styles.trigger,
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.value}>{displayDate}</Text>
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
      </Pressable>

      {Platform.OS === "android" && open ? (
        <DateTimePicker mode="date" value={draftDate} onChange={handleChange} />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          animationType="slide"
          transparent
          visible={open}
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{label}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close date picker"
                  hitSlop={8}
                  onPress={() => setOpen(false)}
                >
                  <Text style={styles.close}>Cancel</Text>
                </Pressable>
              </View>
              <DateTimePicker
                display="spinner"
                mode="date"
                value={draftDate}
                onChange={handleChange}
              />
              <Button
                label="Use this date"
                onPress={() => {
                  onChange(dateOnlyFromDate(draftDate));
                  setOpen(false);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    field: { gap: 8 },
    label: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
    trigger: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 56,
      paddingHorizontal: 14,
    },
    value: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
    pressed: { opacity: 0.75 },
    disabled: { opacity: 0.5 },
    backdrop: {
      backgroundColor: colors.scrim,
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.background,
      gap: 16,
      padding: 20,
      paddingBottom: 32,
    },
    sheetHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    sheetTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "800" },
    close: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  });
}
