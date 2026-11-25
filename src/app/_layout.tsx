import "../tasks/backgroundLocationTask";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DestinoSeleccionProvider } from "../context/DestinoSeleccionContext";
import { SesionProvider, useSesion } from "../context/SesionContext";
import {
  iniciarSincronizacionAutomatica,
} from "../services/colaOffline";
import { useGuardiaRecorrido } from "../hooks/useGuardiaRecorrido";
import { useAccionesNotificacion } from "../hooks/useAccionesNotificacion";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { cargando, session } = useSesion();
  const { bloqueo, leyendoCache, esperarParaNotificaciones } = useGuardiaRecorrido(session?.user.id);

  useEffect(() => {
    if (!cargando && !leyendoCache) {
      SplashScreen.hideAsync();
    }
  }, [cargando, leyendoCache]);

  useAccionesNotificacion(esperarParaNotificaciones);

  if (cargando || leyendoCache) {
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
          <Stack.Screen name="auth" />
          <Stack.Screen name="registro" />
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
          <Stack.Screen name="rol/recuperar/exito" />
          <Stack.Screen name="rol/recuperar/nuevo-pin" />
          <Stack.Screen name="rol/recuperar/revisa-correo" />
          <Stack.Screen name="rol/recuperar/solicitar" />
        </Stack.Protected>
        <Stack.Screen name="recorrido" options={{ gestureEnabled: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  useEffect(() => iniciarSincronizacionAutomatica(), []);

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
