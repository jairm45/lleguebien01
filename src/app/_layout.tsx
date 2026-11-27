import "../tasks/backgroundLocationTask";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DestinoSeleccionProvider } from "../context/DestinoSeleccionContext";
import { SesionProvider, useSesion } from "../context/SesionContext";
import { useGuardiaRecorrido } from "../hooks/useGuardiaRecorrido";
import { useAccionesNotificacion } from "../hooks/useAccionesNotificacion";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const reducirMovimiento = useReducedMotion();
  const transicionAcceso = reducirMovimiento ? "none" : "fade_from_bottom";
  const { cargando, session, perfil } = useSesion();
  const { bloqueo, leyendoCache, esperarParaNotificaciones } = useGuardiaRecorrido(perfil?.rol === "seguidor" ? undefined : session?.user.id);

  const [navegacionIniciada, iniciarNavegacion] = useState(false);
  useEffect(() => {
    if (!cargando && !leyendoCache) {
      void SplashScreen.hideAsync().finally(() => iniciarNavegacion(true));
    }
  }, [cargando, leyendoCache]);

  useAccionesNotificacion(esperarParaNotificaciones);

  if (!navegacionIniciada) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1ABC9C" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!bloqueo}>
          <Stack.Screen name="index" />
          <Stack.Screen name="seguir" />
          <Stack.Screen name="familiar" options={{ animation: transicionAcceso }} />
          <Stack.Screen name="seguidor" />
          <Stack.Protected guard={perfil?.rol !== "seguidor"}>
            <Stack.Screen name="auth" options={{ animation: transicionAcceso }} />
            <Stack.Screen name="registro" options={{ animation: transicionAcceso }} />
            <Stack.Screen name="datos-personales" />
            <Stack.Screen name="datos-usuario" />
            <Stack.Screen name="permisos" />
            <Stack.Screen name="proteccion" />
            <Stack.Screen name="configuracion" />
            <Stack.Screen name="iniciar-recorrido" />
            <Stack.Screen
              name="seleccionar-destino"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="editar-perfil" />
            <Stack.Screen name="estudiante" />
          </Stack.Protected>
          <Stack.Screen name="rol/recuperar/exito" />
          <Stack.Screen name="rol/recuperar/nuevo-pin" />
          <Stack.Screen name="rol/recuperar/revisa-correo" />
          <Stack.Screen name="rol/recuperar/solicitar" />
        </Stack.Protected>
        <Stack.Protected guard={perfil?.rol !== "seguidor"}>
          <Stack.Screen name="recorrido" options={{ gestureEnabled: false }} />
        </Stack.Protected>
      </Stack>
      {(leyendoCache || cargando) && <View style={[StyleSheet.absoluteFill, styles.loading]}>
        <ActivityIndicator color="#1ABC9C" />
      </View>}
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <SesionProvider>
      <DestinoSeleccionProvider>
        <RootNavigator />
      </DestinoSeleccionProvider>
    </SesionProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1E3C",
  },
});
