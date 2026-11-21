import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

import type { Coordenada } from "../lib/recorrido";
import {
  registrarUbicacionRecorrido,
  type ZonaRiesgoActiva,
} from "../services/recorridos";

type Opciones = {
  recorridoId: string | null;
  listo: boolean;
  intervaloMs?: number;
};

export function useUbicacionRecorrido({
  recorridoId,
  listo,
  intervaloMs = 5000,
}: Opciones) {
  const [ubicacionActual, setUbicacionActual] = useState<Coordenada | null>(
    null,
  );
  const [distanciaRecorridaM, setDistanciaRecorridaM] = useState(0);
  const [enZonaRiesgo, setEnZonaRiesgo] = useState(false);
  const [zonasRiesgoActuales, setZonasRiesgoActuales] = useState<
    ZonaRiesgoActiva[]
  >([]);
  const [enviando, setEnviando] = useState(false);
  const [ultimoError, setUltimoError] = useState<string | null>(null);
  const ultimoEnvioRef = useRef(0);

  useEffect(() => {
    if (!recorridoId || !listo) return;

    let montado = true;
    let enviandoLocal = false;
    let suscripcion: { remove: () => void } | null = null;

    ultimoEnvioRef.current = 0;
    setEnviando(false);

    const enviarUbicacion = async (posicion: Location.LocationObject) => {
      if (!montado || enviandoLocal) return;

      const ahora = Date.now();
      const ventanaMinima = Math.max(1000, intervaloMs - 500);

      if (ahora - ultimoEnvioRef.current < ventanaMinima) return;

      ultimoEnvioRef.current = ahora;
      enviandoLocal = true;
      setEnviando(true);

      try {
        const resultado = await registrarUbicacionRecorrido(
          recorridoId,
          {
            latitude: posicion.coords.latitude,
            longitude: posicion.coords.longitude,
          },
          {
            precision: posicion.coords.accuracy,
            velocidad: posicion.coords.speed,
            heading: posicion.coords.heading,
          },
        );

        if (!montado) return;

        setDistanciaRecorridaM(resultado.distancia_acumulada_metros);
        setEnZonaRiesgo(resultado.en_zona_riesgo);
        setZonasRiesgoActuales(resultado.zonas_riesgo_activas);
        setUltimoError(null);
      } catch (error) {
        if (!montado) return;

        setUltimoError(
          error instanceof Error
            ? error.message
            : "No se pudo enviar la ubicación.",
        );
      } finally {
        enviandoLocal = false;
        if (montado) setEnviando(false);
      }
    };

    const iniciar = async () => {
      try {
        const nuevaSuscripcion = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: intervaloMs,
            distanceInterval: 0,
          },
          (posicion) => {
            if (!montado) return;

            setUbicacionActual({
              latitude: posicion.coords.latitude,
              longitude: posicion.coords.longitude,
            });

            void enviarUbicacion(posicion);
          },
          (motivo) => {
            if (montado) setUltimoError(motivo);
          },
        );

        if (!montado) {
          nuevaSuscripcion.remove();
          return;
        }

        suscripcion = nuevaSuscripcion;
      } catch (error) {
        if (montado) {
          setUltimoError(
            error instanceof Error
              ? error.message
              : "No se pudo iniciar el tracking de ubicación.",
          );
        }
      }
    };

    void iniciar();

    return () => {
      montado = false;
      suscripcion?.remove();
    };
  }, [intervaloMs, listo, recorridoId]);

  return {
    ubicacionActual,
    distanciaRecorridaM,
    enZonaRiesgo,
    zonasRiesgoActuales,
    enviando,
    ultimoError,
  };
}
