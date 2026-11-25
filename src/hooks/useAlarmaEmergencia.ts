import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useEffect } from "react";
import { Platform, Vibration } from "react-native";

const ALARMA = require("../../assets/audio/alarma.m4a");

export function useAlarmaEmergencia(activa: boolean, modo: "sonoro" | "silencioso" | null) {
  const player = useAudioPlayer(ALARMA);

  useEffect(() => {
    let intervaloVibracion: ReturnType<typeof setInterval> | null = null;

    const detener = () => {
      Vibration.cancel();
      if (intervaloVibracion) {
        clearInterval(intervaloVibracion);
        intervaloVibracion = null;
      }
      player.pause();
    };

    if (!activa || modo !== "sonoro") {
      detener();
      return detener;
    }

    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch((error) => {
      console.warn("[alarma] No se pudo configurar el audio", error);
    });

    player.loop = true;
    player.volume = 1;
    void player.seekTo(0);
    player.play();

    if (Platform.OS === "android") {
      Vibration.vibrate([0, 500, 500], true);
    } else {
      intervaloVibracion = setInterval(() => {
        Vibration.vibrate(500);
      }, 1000);
    }

    return detener;
  }, [activa, modo, player]);

  return {
    silenciar: () => {
      player.pause();
      Vibration.cancel();
    },
  };
}
