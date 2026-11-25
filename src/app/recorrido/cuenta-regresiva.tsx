import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Platform,
  Pressable,
  Switch,
  Text,
  Vibration,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRecorrido } from "../../context/RecorridoContext";
import { styles } from "../../styles/EmergenciaStyles";

const RADIO = 104;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function CuentaRegresivaScreen() {
  const insets = useSafeAreaInsets();
  const { tiempoCancelacion, iniciarEmergencia } = useRecorrido();

  const segundos = Math.max(1, Number(tiempoCancelacion || 8));
  const [restante, setRestante] = useState(segundos);
  const [modoSilencioso, setModoSilencioso] = useState(false);
  const progreso = useSharedValue(1);

  const disparadoRef = useRef(false);
  const intervaloVibracionRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const detenerVibracion = useCallback(() => {
    Vibration.cancel();

    if (intervaloVibracionRef.current) {
      clearInterval(intervaloVibracionRef.current);
      intervaloVibracionRef.current = null;
    }
  }, []);

  const disparar = useCallback(async () => {
    if (disparadoRef.current) return;

    disparadoRef.current = true;
    detenerVibracion();

    try {
      await iniciarEmergencia(
        "sacudida",
        modoSilencioso ? "silencioso" : "sonoro",
      );
      router.replace("/recorrido/emergencia");
    } catch (error) {
      Alert.alert(
        "No se pudo activar la emergencia",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
      router.back();
    }
  }, [detenerVibracion, iniciarEmergencia, modoSilencioso]);

  const dispararRef = useRef(disparar);

  useEffect(() => {
    dispararRef.current = disparar;
  }, [disparar]);

  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => true);

    if (Platform.OS === "android") {
      Vibration.vibrate([0, 500, 500], true);
    } else {
      Vibration.vibrate(500);
      intervaloVibracionRef.current = setInterval(() => {
        Vibration.vibrate(500);
      }, 1000);
    }

    progreso.value = withTiming(0, {
      duration: segundos * 1000,
      easing: Easing.linear,
    });

    const temporizador = setInterval(() => {
      setRestante((actual) => {
        if (actual <= 1) {
          clearInterval(temporizador);
          void dispararRef.current();
          return 0;
        }

        return actual - 1;
      });
    }, 1000);

    return () => {
      back.remove();
      clearInterval(temporizador);
      detenerVibracion();
    };
  }, [detenerVibracion, progreso, segundos]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUNFERENCIA * (1 - progreso.value),
  }));

  const cancelar = () => {
    disparadoRef.current = true;
    detenerVibracion();
    router.back();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.countdownHeader}>
          <Text style={styles.countdownTitle}>¿Sigues bien?</Text>
          <Text style={styles.countdownSubtitle}>
            Si no cancelas, avisaremos a tus seguidores y compartiremos tu
            ubicación.
          </Text>
        </View>

        <View style={styles.ringWrap}>
          <Svg width={230} height={230}>
            <Circle
              cx={115}
              cy={115}
              r={RADIO}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={12}
              fill="none"
            />
            <AnimatedCircle
              cx={115}
              cy={115}
              r={RADIO}
              stroke="#E5484D"
              strokeWidth={12}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRCUNFERENCIA} ${CIRCUNFERENCIA}`}
              animatedProps={animatedProps}
              transform="rotate(-90 115 115)"
            />
          </Svg>

          <View style={styles.ringCenter}>
            <Text style={styles.countdownNumber}>{restante}</Text>
            <Text style={styles.countdownLabel}>segundos para cancelar</Text>
          </View>
        </View>

        <View style={styles.silentRow}>
          <Text style={styles.silentLabel}>Activar en silencio</Text>
          <Switch
            value={modoSilencioso}
            onValueChange={setModoSilencioso}
            trackColor={{ false: "#45445A", true: "#F5A623" }}
            thumbColor="#FFF"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancelar, fue un error"
          onPress={cancelar}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons
            name="close-circle-outline"
            size={22}
            color="#1A1E3C"
          />
          <Text style={styles.cancelButtonText}>Cancelar, fue un error</Text>
        </Pressable>
      </View>
    </View>
  );
}
