import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

import type { Coordenada } from "../lib/recorrido";
import {
  encolarEventoOffline,
  generarClientEventId,
} from "../services/colaOffline";
import {
  registrarUbicacionRecorrido,
  type ZonaRiesgoActiva,
} from "../services/recorridos";
import { hayConectividad } from "../services/red";

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

      const clientEventId = generarClientEventId();
      const capturedAt = new Date(
        posicion.timestamp || Date.now(),
      ).toISOString();

      const coordenada = {
        latitude: posicion.coords.latitude,
        longitude: posicion.coords.longitude,
      };

      const payload = {
        recorridoId,
        lat: coordenada.latitude,
        lng: coordenada.longitude,
        precision: posicion.coords.accuracy,
        velocidad: posicion.coords.speed,
        heading: posicion.coords.heading,
        capturedAt,
        clientEventId,
      };

      try {
        const resultado = await registrarUbicacionRecorrido(
          recorridoId,
          coordenada,
          {
            precision: posicion.coords.accuracy,
            velocidad: posicion.coords.speed,
            heading: posicion.coords.heading,
            capturedAt,
            clientEventId,
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

        // Solo se encola si el fallo es por falta de red. Un rechazo del
        // servidor (recorrido cerrado, coordenada inválida) no debe bloquear
        // la cola FIFO con un evento imposible de procesar.
        const conectado = await hayConectividad();

        if (!conectado) {
          await encolarEventoOffline("ubicacion", 2, payload);
        }
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
