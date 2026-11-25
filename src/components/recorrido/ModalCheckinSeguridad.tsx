import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";

import type { MotivoCheckin } from "../../services/recorridos";
import { styles } from "../../styles/CheckinStyles";

const SEGUNDOS_RESPUESTA = 60;

type Props = {
  visible: boolean;
  motivo: MotivoCheckin | null;
  desde: string | null;
  creadaEn: string;
  enviando: boolean;
  onPresentado: () => void;
  onEstoyBien: () => void;
  onNecesitoAyuda: () => void;
};

const TEXTOS: Record<MotivoCheckin, { titulo: string; detalle: string }> = {
  sin_senal: {
    titulo: "Dejamos de recibir tu ubicación",
    detalle:
      "Puede ser una zona sin cobertura o que el teléfono se apagó. Si estás bien, confírmalo.",
  },
  retraso_eta: {
    titulo: "Llevas más tiempo del estimado",
    detalle:
      "La hora de llegada calculada ya pasó por más de 15 minutos.",
  },
  parada_zona_riesgo: {
    titulo: "Detención en una zona de riesgo alto",
    detalle:
      "Tu recorrido lleva varios minutos sin avanzar dentro de una zona marcada como de riesgo alto.",
  },
};

export function ModalCheckinSeguridad({
  visible,
  motivo,
  desde,
  creadaEn,
  enviando,
  onPresentado,
  onEstoyBien,
  onNecesitoAyuda,
}: Props) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!visible) return;

    setAhora(Date.now());
    const intervalo = setInterval(() => setAhora(Date.now()), 1000);

    return () => clearInterval(intervalo);
  }, [visible]);

  // Solo el acuse del servidor inicia los 60 s. Mientras falta, sigue vigente el respaldo de 90 s.
  const plazo = desde ? SEGUNDOS_RESPUESTA : 90;
  useEffect(() => {
    if (!visible || desde) return;
    const intervalo = setInterval(onPresentado, 3000);
    return () => clearInterval(intervalo);
  }, [visible, desde, onPresentado]);
  const restantes = useMemo(() => {
    const inicio = Date.parse(desde ?? creadaEn);

    if (!Number.isFinite(inicio)) return SEGUNDOS_RESPUESTA;

    return Math.min(
      plazo,
      Math.max(0, plazo - Math.floor((ahora - inicio) / 1000)),
    );
  }, [ahora, desde, creadaEn, plazo]);

  const texto = motivo ? TEXTOS[motivo] : TEXTOS.sin_senal;
  const progreso = Math.max(0, Math.min(1, restantes / plazo));
  const anchoProgreso = `${Math.round(progreso * 100)}%` as `${number}%`;

  return (
    <Modal
      onShow={onPresentado}
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons
              name="shield-alert-outline"
              size={34}
              color="#F5A623"
            />
          </View>

          <Text style={styles.title}>¿Estás bien?</Text>

          <Text style={styles.subtitle}>
            {!desde && restantes > 0
              ? "Puedes responder ahora. Esperando que el servidor confirme la entrega."
              : restantes > 0
              ? `Confirma en los próximos ${restantes} s o avisaremos a tus seguidores.`
              : "El plazo de respuesta terminó."}
          </Text>

          <View style={styles.motivoCard}>
            <Text style={styles.motivoTitle}>{texto.titulo}</Text>
            <Text style={styles.motivoText}>{texto.detalle}</Text>
          </View>

          <View style={styles.countdownRow}>
            <Text style={styles.countdownNumber}>{restantes}</Text>
            <Text style={styles.countdownUnit}>{desde ? "segundos para responder" : "segundos hasta el respaldo"}</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: anchoProgreso }]} />
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sí, estoy bien"
              disabled={enviando}
              onPress={onEstoyBien}
              style={({ pressed }) => [
                styles.buttonBien,
                (pressed || enviando) && styles.pressed,
              ]}
            >
              {enviando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={22}
                  color="#FFFFFF"
                />
              )}
              <Text style={styles.buttonText}>Sí, estoy bien</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Necesito ayuda, activar SOS silencioso"
              disabled={enviando}
              onPress={onNecesitoAyuda}
              style={({ pressed }) => [
                styles.buttonAyuda,
                (pressed || enviando) && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons
                name="alert-octagon-outline"
                size={22}
                color="#FFFFFF"
              />
              <View style={styles.buttonAyudaWrap}>
                <Text style={styles.buttonText}>Necesito ayuda</Text>
                <Text style={styles.buttonSubtext}>
                  Activa SOS silencioso
                </Text>
              </View>
            </Pressable>
          </View>

          <Text style={styles.footer}>
            Si no puedes responder, tus seguidores recibirán tu última
            ubicación registrada.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
