import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { isAuthenticated, isReady, isCourier } = useAuth();

  if (!isReady) return null;

  if (isAuthenticated) {
    if (isCourier) return <Redirect href="/(courier-tabs)/workspace" />;
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
