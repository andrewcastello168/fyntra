export function dateOnlyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() + 1 !== Number(match[2]) ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function dateFromDateOnly(value: string) {
  const normalized = normalizeDateOnly(value) ?? dateOnlyFromDate(new Date());
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day);
}
