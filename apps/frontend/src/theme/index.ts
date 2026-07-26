import { Platform } from "react-native";

export const colors = {
  primary: "#1E40AF",
  primaryDark: "#1D4ED8",
  accent: "#059669",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#475569",
  border: "#CBD5E1",
  error: "#B91C1C",
  errorSurface: "#FEF2F2",
};

export const shadow = Platform.select({
  ios: { shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 3 },
  default: {},
});
