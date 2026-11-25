import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRecorrido } from "../../context/RecorridoContext";
import type { ModoAlerta } from "../../services/emergencias";
import {
  obtenerSeguidoresActivos,
  type Seguidor,
} from "../../services/seguidores";
import { styles } from "../../styles/EmergenciaStyles";

const RADIO = 88;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
const DURACION_PRESION_MS = 3000;

export default function SosScreen() {
  const insets = useSafeAreaInsets();
  const { iniciarEmergencia } = useRecorrido();
  const parametros = useLocalSearchParams<{
    modo?: string;
    origen?: string;
  }>();

  const [modoElegido, setModo] = useState<ModoAlerta>(
    parametros.modo === "silencioso" ? "silencioso" : "sonoro",
  );
  const rapido = parametros.origen === "notificacion";
  const modo = rapido ? "silencioso" : modoElegido;
  const [seguidores, setSeguidores] = useState<Seguidor[]>([]);
  const [cargandoSeguidores, setCargandoSeguidores] = useState(true);
  const [progreso, setProgreso] = useState(0);
  const [presionando, setPresionando] = useState(false);

  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const disparadoRef = useRef(false);

  useEffect(() => {
    let activo = true;

    const cargarSeguidores = async () => {
      try {
        const datos = await obtenerSeguidoresActivos();
        if (activo) setSeguidores(datos);
      } catch {
        if (activo) setSeguidores([]);
      } finally {
        if (activo) setCargandoSeguidores(false);
      }
    };

    void cargarSeguidores();

    return () => {
      activo = false;

      if (intervaloRef.current) {
        clearInterval(intervaloRef.current);
        intervaloRef.current = null;
      }
    };
  }, []);

  const detenerPresion = () => {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }

    if (!disparadoRef.current) {
      setPresionando(false);
      setProgreso(0);
    }
  };

  const disparar = async () => {
    if (disparadoRef.current) return;

    disparadoRef.current = true;
    detenerPresion();

    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    );

    try {
      await iniciarEmergencia(
        parametros.origen === "notificacion" ? "notificacion_rapida" : "manual",
        modo,
      );
      router.replace({ pathname: "/recorrido/emergencia", params: { modo } });
    } catch (error) {
      disparadoRef.current = false;
      setPresionando(false);
      setProgreso(0);

      Alert.alert(
        "No se pudo activar el SOS",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    }
  };

  const iniciarPresion = () => {
    if (disparadoRef.current || intervaloRef.current) return;

    setPresionando(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const inicio = Date.now();

    intervaloRef.current = setInterval(() => {
      const avance = Math.min(
        1,
        (Date.now() - inicio) / DURACION_PRESION_MS,
      );

      setProgreso(avance);

      if (avance >= 1) {
        if (intervaloRef.current) {
          clearInterval(intervaloRef.current);
          intervaloRef.current = null;
        }
        setPresionando(false);
        void disparar();
      }
    }, 50);
  };

  const progresoOffset = CIRCUNFERENCIA * (1 - progreso);

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
        <View style={styles.sosHeader}>
          <Text style={styles.sosTitle}>Emergencia SOS</Text>
          <Text style={styles.sosSubtitle}>
            Activa una alerta manual. Tus seguidores recibirán tu ubicación.
          </Text>
        </View>

        <View style={styles.modeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Modo sonoro"
            disabled={rapido}
            onPress={() => setModo("sonoro")}
            style={[
              styles.modeCard,
              modo === "sonoro" && styles.modeCardActive,
            ]}
          >
            <MaterialCommunityIcons
              name="volume-high"
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.modeTitle}>Modo sonoro</Text>
            <Text style={styles.modeText}>Alarma disuasiva</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Modo silencioso"
            onPress={() => setModo("silencioso")}
            style={[
              styles.modeCard,
              modo === "silencioso" && styles.modeCardActive,
            ]}
          >
            <MaterialCommunityIcons
              name="volume-off"
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.modeTitle}>Modo silencioso</Text>
            <Text style={styles.modeText}>Discreto, sin sonido fuerte</Text>
          </Pressable>
        </View>

        <View style={styles.followersCard}>
          <Text style={styles.followersTitle}>
            {cargandoSeguidores
              ? "Cargando seguidores..."
              : seguidores.length > 0
                ? `Se avisará a ${seguidores.length} seguidor(es):`
                : "Aún no tienes seguidores vinculados"}
          </Text>

          {!cargandoSeguidores && seguidores.length === 0 ? (
            <Text style={styles.followersEmpty}>
              La emergencia se registrará igualmente. Cuando vincules
              seguidores, recibirán el aviso.
            </Text>
          ) : (
            seguidores.slice(0, 4).map((seguidor) => (
              <View key={seguidor.id} style={styles.followerRow}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarSmallText}>
                    {seguidor.nombre.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.followerName} numberOfLines={1}>
                  {seguidor.nombre}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.sosWrap}>
          <Svg
            width={190}
            height={190}
            style={{ position: "absolute" }}
            pointerEvents="none"
          >
            <Circle
              cx={95}
              cy={95}
              r={RADIO}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={8}
              fill="none"
            />
            <Circle
              cx={95}
              cy={95}
              r={RADIO}
              stroke="#FFFFFF"
              strokeWidth={8}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRCUNFERENCIA} ${CIRCUNFERENCIA}`}
              strokeDashoffset={progresoOffset}
              transform="rotate(-90 95 95)"
            />
          </Svg>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Botón SOS, mantener presionado"
            onPressIn={iniciarPresion}
            onPressOut={detenerPresion}
            style={({ pressed }) => [
              styles.sosButton,
              (pressed || presionando) && styles.sosButtonPressed,
            ]}
          >
            <Text style={styles.sosText}>SOS</Text>
          </Pressable>
        </View>

        <Text style={styles.sosHint}>
          Mantén presionado 3 segundos para activar la emergencia.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancelar SOS"
          onPress={() => router.back()}
          style={styles.cancelLink}
        >
          <Text style={styles.cancelLinkText}>Cancelar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
