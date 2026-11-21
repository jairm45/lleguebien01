import { Stack } from "expo-router/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RecorridoLayout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#1A1E3C" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="llegada" />
      </Stack>
    </SafeAreaProvider>
  );
}
