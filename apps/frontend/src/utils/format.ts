import type { ThemeColors } from "@/src/theme";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string) {
  return value.slice(0, 10);
}

export function transactionLabel(type: string) {
  switch (type) {
    case "INCOME":
      return "Income";
    case "EXPENSE":
      return "Expense";
    case "TRANSFER":
      return "Transfer";
    default:
      return type;
  }
}

export function transactionColor(type: string, colors: ThemeColors) {
  return type === "EXPENSE"
    ? colors.danger
    : type === "INCOME"
      ? colors.success
      : colors.primary;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
