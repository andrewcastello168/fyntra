import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
const icons = {
  index: "home-outline",
  accounts: "wallet-outline",
  transactions: "list-outline",
  settings: "settings-outline",
} as const;
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={icons[route.name as keyof typeof icons]}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="accounts" options={{ title: "Akun" }} />
      <Tabs.Screen name="transactions" options={{ title: "Transaksi" }} />
      <Tabs.Screen name="settings" options={{ title: "Pengaturan" }} />
    </Tabs>
  );
}
