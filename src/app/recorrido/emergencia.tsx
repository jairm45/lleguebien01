import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRecorrido } from "../../context/RecorridoContext";
import { useAlarmaEmergencia } from "../../hooks/useAlarmaEmergencia";
import { formatearDistancia } from "../../lib/recorrido";
import { styles } from "../../styles/EmergenciaStyles";

function formatearHora(iso: string): string {
  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) return "--:--";

  return `${String(fecha.getHours()).padStart(2, "0")}:${String(
    fecha.getMinutes(),
  ).padStart(2, "0")}`;
}

export default function EmergenciaActivaScreen() {
  const insets = useSafeAreaInsets();
  const {
    recuperando,
    alertaActiva,
    modoAlarma,
    ubicacionActual,
    distanciaRecorridaM,
    pendientesOffline,
    segundoPlanoActivo,
    terminarEmergencia,
    finalizarRecorridoActual,
  } = useRecorrido();

  const [silenciada, setSilenciada] = useState(false);
  const [emergenciaTerminada, setEmergenciaTerminada] = useState(false);
  const [terminando, setTerminando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  const entrada = useLocalSearchParams<{ modo?: string }>();
  const discreta = entrada.modo === "silencioso" || modoAlarma === "silencioso" ||
    alertaActiva?.tipo === "pasiva" || alertaActiva?.tipo === "notificacion_rapida";
  const modo = discreta ? "silencioso" : alertaActiva?.modo ?? modoAlarma;

  const alarmaActiva =
    Boolean(alertaActiva) && !recuperando && !silenciada && !emergenciaTerminada;

  useAlarmaEmergencia(alarmaActiva, modo);

  useEffect(() => {
    if (!alertaActiva && !emergenciaTerminada) return;

    const suscripcion = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );

    return () => suscripcion.remove();
  }, [alertaActiva, emergenciaTerminada]);

  const terminar = async () => {
    if (terminando) return;

    setTerminando(true);
    setSilenciada(true);

    await terminarEmergencia();

    setTerminando(false);
    setEmergenciaTerminada(true);
  };

  const finalizarAhora = async () => {
    if (finalizando) return;

    setFinalizando(true);

    try {
      const resumen = await finalizarRecorridoActual();

      router.replace({
        pathname: "/recorrido/llegada",
        params: { resumen: JSON.stringify(resumen) },
      });
    } catch (error) {
      setFinalizando(false);
      Alert.alert(
        "No se pudo finalizar",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    }
  };

  if (recuperando) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#E5484D" size="large" />
        <Text style={styles.loadingText}>Recuperando emergencia...</Text>
      </View>
    );
  }

  if (!alertaActiva && !emergenciaTerminada) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <StatusBar style="light" />
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={64}
            color="#1ABC9C"
          />
          <Text style={styles.emergencyTitle}>No hay emergencia activa</Text>
          <Pressable
            onPress={() => router.replace("/recorrido")}
            style={({ pressed }) => [
              styles.actionPrimary,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.actionPrimaryText}>Volver al recorrido</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const notificados = alertaActiva?.notificados ?? 0;
  const notificacionEnviada = Boolean(
    alertaActiva?.notificacion_enviada_en,
  );

  const estadoNotificacion = notificacionEnviada
    ? notificados > 0
      ? `Enviada a ${notificados} seguidor(es)`
      : "Sin seguidores vinculados"
    : `Pendiente de red${
        pendientesOffline > 0 ? ` · ${pendientesOffline} en cola` : ""
      }`;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emergencyHeader}>
          <View style={styles.emergencyIconCircle}>
            <MaterialCommunityIcons
              name={emergenciaTerminada ? "shield-check" : "alert"}
              size={44}
              color="#FFFFFF"
            />
          </View>
          <Text style={styles.emergencyTitle}>
            {emergenciaTerminada ? "Emergencia terminada" : "Emergencia activa"}
          </Text>
          <Text style={styles.emergencySubtitle}>
            {emergenciaTerminada
              ? "Tu alerta fue cerrada."
              : modo === "sonoro"
                ? "Alarma y seguimiento en vivo activos."
                : "Modo discreto: seguimiento y aviso activos, sin sonido fuerte."}
          </Text>
        </View>

        {!emergenciaTerminada ? (
          <>
            {modo === "sonoro" ? (
              <View style={styles.alarmCard}>
                <Text style={styles.alarmTitle}>
                  {silenciada ? "Alarma silenciada" : "Alarma sonando"}
                </Text>
                <Text style={styles.alarmText}>
                  {silenciada
                    ? "La emergencia sigue activa. Puedes reactivar la alarma si lo necesitas."
                    : "Alarma en bucle a volumen alto y vibración continua."}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    silenciada ? "Reactivar alarma" : "Silenciar alarma"
                  }
                  onPress={() => setSilenciada((valor) => !valor)}
                  style={({ pressed }) => [
                    styles.silenceButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.silenceButtonText}>
                    {silenciada ? "Reactivar alarma" : "Silenciar alarma"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.alarmCard}>
                <Text style={styles.alarmTitle}>Modo discreto activo</Text>
                <Text style={styles.alarmText}>
                  No se reproduce audio fuerte ni vibración estridente. El
                  seguimiento y el aviso a seguidores continúan.
                </Text>
              </View>
            )}

            {pendientesOffline > 0 ? (
              <View style={styles.offlineBadge}>
                <MaterialCommunityIcons
                  name="cloud-off-outline"
                  size={18}
                  color="#D98700"
                />
                <Text style={styles.offlineText}>
                  Sin señal · {pendientesOffline} evento(s) en cola. Se
                  enviarán al recuperar red.
                </Text>
              </View>
            ) : null}

            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Ubicación compartida</Text>
                <Text style={styles.statusValue}>
                  {ubicacionActual
                    ? `${ubicacionActual.latitude.toFixed(5)}, ${ubicacionActual.longitude.toFixed(5)}`
                    : "Esperando GPS..."}
                </Text>
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Distancia recorrida</Text>
                <Text style={styles.statusValue}>
                  {formatearDistancia(distanciaRecorridaM)}
                </Text>
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Aviso a seguidores</Text>
                <Text style={styles.statusValue}>{estadoNotificacion}</Text>
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Segundo plano</Text>
                <Text style={styles.statusValue}>
                  {segundoPlanoActivo
                    ? "Activo · puedes apagar la pantalla"
                    : "Solo primer plano"}
                </Text>
              </View>

              <View style={[styles.statusRow, styles.statusRowLast]}>
                <Text style={styles.statusLabel}>Inicio</Text>
                <Text style={styles.statusValue}>
                  {alertaActiva ? formatearHora(alertaActiva.iniciada_en) : "--:--"}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Terminar emergencia"
              disabled={terminando}
              onPress={() => void terminar()}
              style={({ pressed }) => [
                styles.terminateButton,
                (pressed || terminando) && styles.pressed,
              ]}
            >
              {terminando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <MaterialCommunityIcons
                  name="stop-circle-outline"
                  size={22}
                  color="#FFFFFF"
                />
              )}
              <Text style={styles.terminateText}>
                {terminando ? "Terminando..." : "Terminar emergencia"}
              </Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.actionsColumn}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver al recorrido"
              onPress={() => router.replace("/recorrido")}
              style={({ pressed }) => [
                styles.actionPrimary,
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons
                name="map-marker-path"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.actionPrimaryText}>
                Volver al recorrido (mapa)
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finalizar recorrido ahora"
              disabled={finalizando}
              onPress={() => void finalizarAhora()}
              style={({ pressed }) => [
                styles.actionSecondary,
                (pressed || finalizando) && styles.pressed,
              ]}
            >
              {finalizando ? (
                <ActivityIndicator color="#1A1E3C" size="small" />
              ) : (
                <MaterialCommunityIcons
                  name="flag-checkered"
                  size={20}
                  color="#1A1E3C"
                />
              )}
              <Text style={styles.actionSecondaryText}>
                {finalizando
                  ? "Finalizando..."
                  : "Finalizar recorrido ahora"}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
