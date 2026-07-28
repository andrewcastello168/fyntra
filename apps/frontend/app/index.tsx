import { Redirect } from "expo-router";
import { LoadingState } from "@/src/components/LoadingState";
import { useAuth } from "@/src/auth/AuthProvider";

export default function Index() {
  const { isLoading, user } = useAuth();
  if (isLoading) return <LoadingState label="Memulihkan sesi Anda..." />;
  return (
    <Redirect href={user ? ("/(app)/(tabs)" as never) : ("/login" as never)} />
  );
}
