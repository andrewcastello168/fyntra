import { StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";

const icons = {
  index: "home-outline",
  accounts: "wallet-outline",
  transactions: "list-outline",
  create: "add",
  profile: "person-outline",
} as const;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    createIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.background,
    },
  });

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
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
      <Tabs.Screen name="transactions" options={{ title: "Transactions" }} />
      <Tabs.Screen
        name="create"
        options={{
          title: "+",
          tabBarAccessibilityLabel: "Create transaction",
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View style={styles.createIcon}>
              <Ionicons name="add" size={26} color={colors.onPrimary} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="accounts" options={{ title: "Accounts" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
