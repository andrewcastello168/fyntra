import * as SecureStore from "expo-secure-store";
import * as SystemUI from "expo-system-ui";
import * as NavigationBar from "expo-navigation-bar";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform, useColorScheme } from "react-native";

export type ThemeMode = "system" | "light" | "dark";

export type ThemeColors = {
  background: string;
  surface: string;
  elevatedSurface: string;
  surfaceElevated: string;
  inputBackground: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  primary: string;
  primaryDark: string;
  success: string;
  warning: string;
  danger: string;
  dangerSurface: string;
  primarySurface: string;
  onPrimary: string;
  placeholder: string;
  textMuted: string;
  focus: string;
  transfer: string;
  transferSurface: string;
  scrim: string;
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  sheet: 18,
  round: 999,
} as const;

export const typography = {
  screenTitle: 26,
  sectionTitle: 18,
  body: 16,
  supporting: 14,
  label: 13,
  caption: 12,
} as const;

type ThemeValue = {
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  colors: ThemeColors;
  shadow: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
  setMode: (mode: ThemeMode) => void;
};

export type ThemeShadow = ThemeValue["shadow"];

const lightColors: ThemeColors = {
  background: "#F7F7F3",
  surface: "#FFFFFF",
  elevatedSurface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  inputBackground: "#FFFFFF",
  textPrimary: "#20231F",
  textSecondary: "#6B7268",
  border: "#D9DDD4",
  primary: "#2563A8",
  primaryDark: "#174A82",
  success: "#2F6B4F",
  warning: "#9A681E",
  danger: "#A8473D",
  dangerSurface: "#F8ECE9",
  primarySurface: "#E8F1FB",
  onPrimary: "#FFFFFF",
  placeholder: "#9AA198",
  textMuted: "#858D82",
  focus: "#2563A8",
  transfer: "#4C6F9E",
  transferSurface: "#EAF0F8",
  scrim: "rgba(32, 35, 31, 0.5)",
};

const darkColors: ThemeColors = {
  background: "#171A17",
  surface: "#202520",
  elevatedSurface: "#272D27",
  surfaceElevated: "#2B322D",
  inputBackground: "#1D221E",
  textPrimary: "#F1F2EC",
  textSecondary: "#AEB6A8",
  border: "#343C34",
  primary: "#8DB9E5",
  primaryDark: "#B4D4F3",
  success: "#8DC39B",
  warning: "#E0B66F",
  danger: "#E28E83",
  dangerSurface: "#3A2523",
  primarySurface: "#20354C",
  onPrimary: "#101A27",
  placeholder: "#7E897D",
  textMuted: "#899487",
  focus: "#8DB9E5",
  transfer: "#A8C6E6",
  transferSurface: "#2B3D53",
  scrim: "rgba(0, 0, 0, 0.68)",
};

const ThemeContext = createContext<ThemeValue | null>(null);
const THEME_STORAGE_KEY = "themePreference";

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [isPreferenceLoaded, setPreferenceLoaded] = useState(false);

  const resolvedMode =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;
  const colors = resolvedMode === "dark" ? darkColors : lightColors;
  const shadow = useMemo(
    () => ({
      shadowColor: resolvedMode === "dark" ? "#000000" : "#20231F",
      shadowOpacity: resolvedMode === "dark" ? 0.12 : 0.03,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    }),
    [resolvedMode],
  );

  useEffect(() => {
    void SecureStore.getItemAsync(THEME_STORAGE_KEY).then((storedMode) => {
      if (
        storedMode === "system" ||
        storedMode === "light" ||
        storedMode === "dark"
      ) {
        setModeState(storedMode);
      }
      setPreferenceLoaded(true);
    });
  }, []);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);

    if (Platform.OS === "android") {
      NavigationBar.setStyle(resolvedMode === "dark" ? "dark" : "light");
      void NavigationBar.setButtonStyleAsync(
        resolvedMode === "dark" ? "light" : "dark",
      );
      void NavigationBar.setBackgroundColorAsync(colors.background);
      void NavigationBar.setBorderColorAsync(colors.border);
    }
  }, [colors.background, colors.border, resolvedMode]);

  function setMode(nextMode: ThemeMode) {
    setModeState(nextMode);
    void SecureStore.setItemAsync(THEME_STORAGE_KEY, nextMode);
  }

  const value = useMemo<ThemeValue>(
    () => ({ mode, resolvedMode, colors, shadow, setMode }),
    [mode, resolvedMode, colors, shadow],
  );

  if (!isPreferenceLoaded) return null;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context)
    throw new Error("useTheme harus digunakan di dalam ThemeProvider");
  return context;
}
