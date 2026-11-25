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
import { useAccionesNotificacion } from "../hooks/useAccionesNotificacion";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { cargando } = useSesion();

  useEffect(() => {
    if (!cargando) {
      SplashScreen.hideAsync();
    }
  }, [cargando]);

  useAccionesNotificacion();

  if (cargando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1ABC9C" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="registro" />
        <Stack.Screen name="datos-personales" />
        <Stack.Screen name="datos-usuario" />
        <Stack.Screen name="recorrido" />
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
        <Stack.Screen name="rol" />
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
