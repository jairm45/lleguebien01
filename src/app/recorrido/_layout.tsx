import { Stack } from "expo-router/stack";

import { RecorridoProvider } from "../../context/RecorridoContext";

export default function RecorridoLayout() {
  return (
    <RecorridoProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#1A1E3C" },
        }}
      >
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="cuenta-regresiva"
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="sos" />
        <Stack.Screen name="emergencia" options={{ gestureEnabled: false }} />
        <Stack.Screen name="llegada" />
      </Stack>
    </RecorridoProvider>
  );
}
