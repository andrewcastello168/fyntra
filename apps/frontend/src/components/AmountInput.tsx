import { useRef, useState } from "react";
import {
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
} from "react-native";
import { TextInput } from "@/src/components/TextInput";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeDigits(value: string) {
  return value.replace(/^0+(?=\d)/, "");
}

export function formatAmount(value: string) {
  const digits = normalizeDigits(digitsOnly(value));
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function caretAfterDigits(value: string, digitCount: number) {
  if (digitCount <= 0) return 0;
  let digitsSeen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) digitsSeen += 1;
    if (digitsSeen === digitCount) return index + 1;
  }
  return value.length;
}

export function AmountInput({
  value,
  onChangeText,
  style,
  ...props
}: {
  value: string;
  onChangeText: (value: string) => void;
  style?: React.ComponentProps<typeof TextInput>["style"];
} & Omit<
  React.ComponentProps<typeof TextInput>,
  "label" | "onChangeText" | "prefix" | "style" | "value"
>) {
  const [selection, setSelection] = useState({
    start: formatAmount(value).length,
    end: formatAmount(value).length,
  });
  const selectionRef = useRef(selection);
  const displayValue = formatAmount(value);

  function handleSelectionChange(
    event: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) {
    const nextSelection = event.nativeEvent.selection;
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
  }

  function handleChange(nextDisplayValue: string) {
    const previousDisplayValue = formatAmount(value);
    const previousDigits = normalizeDigits(digitsOnly(previousDisplayValue));
    const nextDigits = normalizeDigits(digitsOnly(nextDisplayValue));
    const previousCursor = selectionRef.current.start;
    const previousDigitsBeforeCursor = digitsOnly(
      previousDisplayValue.slice(0, previousCursor),
    ).length;
    const digitDelta = nextDigits.length - previousDigits.length;
    const nextDigitsBeforeCursor = Math.max(
      0,
      Math.min(nextDigits.length, previousDigitsBeforeCursor + digitDelta),
    );
    const nextFormattedValue = formatAmount(nextDigits);
    const nextCursor = caretAfterDigits(
      nextFormattedValue,
      nextDigitsBeforeCursor,
    );
    const nextSelection = { start: nextCursor, end: nextCursor };
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
    onChangeText(nextDigits);
  }

  return (
    <TextInput
      {...props}
      label="Amount"
      prefix="Rp"
      value={displayValue}
      onChangeText={handleChange}
      onSelectionChange={handleSelectionChange}
      keyboardType="number-pad"
      returnKeyType="next"
      placeholder="0"
      style={style}
    />
  );
}
