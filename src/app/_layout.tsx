import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="registro" />
      <Stack.Screen name="datos-personales" />
      <Stack.Screen name="datos-usuario" />
      <Stack.Screen name="recorrido" />
      <Stack.Screen name="permisos" />
      <Stack.Screen name="editar-perfil" />
      <Stack.Screen name="estudiante" />
      <Stack.Screen name="rol" />
    </Stack>
  );
}
