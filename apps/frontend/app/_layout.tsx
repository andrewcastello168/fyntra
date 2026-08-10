import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/src/auth/AuthProvider";
import { ThemeProvider, useTheme } from "@/src/theme";
import { BalanceVisibilityProvider } from "@/src/privacy/BalanceVisibilityProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <BalanceVisibilityProvider>
          <AuthProvider>
            <ThemedRoot />
          </AuthProvider>
        </BalanceVisibilityProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedRoot() {
  const { colors, resolvedMode } = useTheme();

  return (
    <>
      <StatusBar
        animated
        style={resolvedMode === "dark" ? "light" : "dark"}
        backgroundColor={colors.background}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      />
    </>
  );
}
