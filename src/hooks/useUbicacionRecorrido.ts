import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import type { PosicionRecorrido } from "../lib/recorrido";
import {
  encolarEventoOffline,
  generarClientEventId,
  leerPosicionFondo,
} from "../services/colaOffline";
import {
  registrarUbicacionRecorrido,
  type ZonaRiesgoActiva,
} from "../services/recorridos";
import { hayConectividad } from "../services/red";

type Opciones = {
  recorridoId: string | null;
  listo: boolean;
  red: boolean;
  intervaloMs?: number;
};

export function useUbicacionRecorrido({
  recorridoId,
  listo,
  red,
  intervaloMs = 5000,
}: Opciones) {
  const [ubicacionActual, setUbicacionActual] = useState<PosicionRecorrido | null>(
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

  const conectado = useRef(red);
  useEffect(() => { conectado.current = red; }, [red]);
  useEffect(() => { setUbicacionActual(null); }, [recorridoId]);

  useEffect(() => {
    if (!recorridoId || !listo) return;

    let montado = true;
    let enviandoLocal = false;
    let suscripcion: { remove: () => void } | null = null;

    ultimoEnvioRef.current = 0;
    setEnviando(false);

    const enviarUbicacion = async (posicion: Location.LocationObject) => {
      if (!montado) return;

      const ahora = Date.now();
      const ventanaMinima = Math.max(1000, intervaloMs - 500);

      if (ahora - ultimoEnvioRef.current < ventanaMinima) return;

      ultimoEnvioRef.current = ahora;

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

      if (!conectado.current || enviandoLocal) {
        await encolarEventoOffline("ubicacion", 2, payload);
        return;
      }
      enviandoLocal = true;
      setEnviando(true);

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
        if (montado) setUltimoError(
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

    const actualizar = (punto: PosicionRecorrido) => {
      if (!montado) return;
      setUbicacionActual(anterior =>
        anterior && anterior.capturedAt >= punto.capturedAt ? anterior : punto
      );
    };

    const recuperar = async () => {
      const punto = await leerPosicionFondo(recorridoId).catch(() => null);
      if (punto) actualizar(punto);
    };
    void recuperar();
    const cambios = AppState.addEventListener("change", estado => {
      if (estado === "active") void recuperar();
    });
    const iniciar = async () => {
      try {
        const nuevaSuscripcion = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2500,
            // El monitor necesita muestras frescas incluso si el estudiante está detenido.
            distanceInterval: 0,
          },
          (posicion) => {
            if (!montado) return;

            actualizar({
              heading: posicion.coords.heading,
              precisionM: posicion.coords.accuracy,
              capturedAt: posicion.timestamp,
              latitude: posicion.coords.latitude,
              longitude: posicion.coords.longitude,
            });

            void enviarUbicacion(posicion).catch(error => {
              if (montado) setUltimoError(String(error));
            });
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
      cambios.remove();
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
