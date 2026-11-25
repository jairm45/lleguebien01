import { Accelerometer } from "expo-sensors";
import { useEffect, useRef } from "react";

import { crearDetectorSacudidas } from "../lib/shake";

type Opciones = {
  activo: boolean;
  sacudidasNecesarias?: number;
  onDetectar: () => void;
};

export function useDetectorSacudidas({
  activo,
  sacudidasNecesarias = 4,
  onDetectar,
}: Opciones) {
  const callbackRef = useRef(onDetectar);
  const disparadoRef = useRef(false);

  useEffect(() => {
    callbackRef.current = onDetectar;
  }, [onDetectar]);

  useEffect(() => {
    if (!activo) return;

    let montado = true;
    let suscripcion: { remove: () => void } | null = null;

    disparadoRef.current = false;
    const detector = crearDetectorSacudidas({ sacudidasNecesarias });

    const iniciar = async () => {
      const disponible = await Accelerometer.isAvailableAsync();

      if (!disponible || !montado) return;

      Accelerometer.setUpdateInterval(100);

      const nuevaSuscripcion = Accelerometer.addListener((muestra) => {
        if (!montado || disparadoRef.current) return;

        if (detector.agregarMuestra(muestra, Date.now())) {
          disparadoRef.current = true;
          callbackRef.current();
        }
      });

      if (!montado) {
        nuevaSuscripcion.remove();
        return;
      }

      suscripcion = nuevaSuscripcion;
    };

    void iniciar();

    return () => {
      montado = false;
      suscripcion?.remove();
    };
  }, [activo, sacudidasNecesarias]);
}
