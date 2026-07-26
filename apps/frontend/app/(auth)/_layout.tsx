import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/src/auth/AuthProvider";
import { LoadingState } from "@/src/components/LoadingState";

export default function AuthLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingState />;
  if (user) return <Redirect href={"/(app)/(tabs)" as never} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
