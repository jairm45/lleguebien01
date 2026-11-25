import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  formatearDistancia,
  formatearDuracion,
} from "../../lib/recorrido";
import type { ResumenRecorrido } from "../../services/recorridos";
import { styles } from "../../styles/LlegadaStyles";

function formatearHora(iso: string): string {
  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) return "--:--";

  const horas = String(fecha.getHours()).padStart(2, "0");
  const minutos = String(fecha.getMinutes()).padStart(2, "0");

  return `${horas}:${minutos}`;
}

export default function LlegadaScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ resumen?: string }>();
  const resumenParam = Array.isArray(params.resumen)
    ? params.resumen[0]
    : params.resumen;

  const resumen = useMemo<ResumenRecorrido | null>(() => {
    if (!resumenParam) return null;

    try {
      return JSON.parse(resumenParam) as ResumenRecorrido;
    } catch {
      return null;
    }
  }, [resumenParam]);

  const volverAlInicio = () => {
    router.replace("/estudiante/inicio");
  };

  if (!resumen) {
    return (
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <StatusBar style="dark" />
        <View style={styles.content}>
          <View style={styles.hero}>
            <View style={styles.checkCircle}>
              <MaterialCommunityIcons
                name="check"
                size={44}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.title}>Recorrido finalizado</Text>
            <Text style={styles.subtitle}>
              No encontramos el resumen del recorrido. Puedes volver al inicio.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver al inicio"
            onPress={volverAlInicio}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText}>Volver al inicio</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const seguidores = resumen.seguidores_notificados;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.checkCircle}>
            <MaterialCommunityIcons name="check" size={44} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>¡Llegaste bien!</Text>
          <Text style={styles.subtitle}>
            Llegaste a {resumen.destino_nombre ?? "tu destino"}.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {formatearDuracion(resumen.duracion_segundos)}
              </Text>
              <Text style={styles.metricLabel}>Tiempo total</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {formatearDistancia(resumen.distancia_metros)}
              </Text>
              <Text style={styles.metricLabel}>Distancia real</Text>
            </View>
          </View>

          <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Text style={styles.infoLabel}>Hora de llegada</Text>
            <Text style={styles.infoValue}>
              {formatearHora(resumen.finalizado_en)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Seguidores avisados</Text>
            <Text style={styles.infoValue}>
              {seguidores}{" "}
              {seguidores === 1 ? "seguidor" : "seguidores"}
            </Text>
          </View>

          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Text style={styles.infoLabel}>Destino</Text>
            <Text style={styles.infoValue}>
              {resumen.destino_nombre ?? "Destino no registrado"}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver al inicio"
          onPress={volverAlInicio}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons name="home" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Volver al inicio</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
