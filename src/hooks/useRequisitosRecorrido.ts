import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Linking } from "react-native";

import { hayConectividad } from "../services/red";

export type RequisitosRecorrido = {
  gps: boolean;
  permisos: boolean;
  red: boolean;
};

type Opciones = {
  monitorear?: boolean;
  intervaloMs?: number;
};

const ESTADO_INICIAL: RequisitosRecorrido = {
  gps: false,
  permisos: false,
  red: false,
};

export function useRequisitosRecorrido({
  monitorear = true,
  intervaloMs = 7000,
}: Opciones = {}) {
  const [estado, setEstado] = useState<RequisitosRecorrido>(ESTADO_INICIAL);
  const [verificando, setVerificando] = useState(true);
  const [haVerificado, setHaVerificado] = useState(false);
  const [puedeSolicitarPermiso, setPuedeSolicitarPermiso] = useState(false);
  const promesaRef = useRef<Promise<RequisitosRecorrido> | null>(null);

  const verificar = useCallback((): Promise<RequisitosRecorrido> => {
    if (promesaRef.current) return promesaRef.current;

    setVerificando(true);

    const promesa = (async () => {
      let gps = false;
      let permisos = false;
      let red = false;
      let solicitable = false;

      const conectividad = hayConectividad().catch(() => false);
      const [servicios, permiso] = await Promise.all([
        Location.hasServicesEnabledAsync().catch(() => false),
        Location.getForegroundPermissionsAsync().catch(() => null),
      ]);

      let proveedor: Awaited<
        ReturnType<typeof Location.getProviderStatusAsync>
      > | null = null;

      try {
        proveedor = await Location.getProviderStatusAsync();
      } catch {
        proveedor = null;
      }

      gps = Boolean(
        servicios && (proveedor?.locationServicesEnabled ?? true),
      );
      permisos = permiso?.status === "granted";
      solicitable = Boolean(
        permiso && !permisos && permiso.canAskAgain,
      );
      setEstado(anterior => ({ ...anterior, gps, permisos }));
      red = await conectividad;

      const siguiente: RequisitosRecorrido = { gps, permisos, red };
      setEstado(siguiente);
      setPuedeSolicitarPermiso(solicitable);

      return siguiente;
    })().finally(() => {
      promesaRef.current = null;
      setVerificando(false);
      setHaVerificado(true);
    });

    promesaRef.current = promesa;
    return promesa;
  }, []);

  useEffect(() => {
    let activo = true;

    const ejecutar = () => {
      if (activo) void verificar();
    };

    void verificar();

    const suscripcion = AppState.addEventListener("change", (siguiente) => {
      if (siguiente === "active") ejecutar();
    });

    const intervalo = monitorear
      ? setInterval(ejecutar, intervaloMs)
      : null;

    return () => {
      activo = false;
      suscripcion.remove();
      if (intervalo) clearInterval(intervalo);
    };
  }, [intervaloMs, monitorear, verificar]);

  const solicitarPermiso = useCallback(async () => {
    const respuesta = await Location.requestForegroundPermissionsAsync();
    await verificar();
    return respuesta.status === "granted";
  }, [verificar]);

  const abrirAjustes = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      // El sistema puede no soportar abrir ajustes en algunos entornos.
    }
  }, []);

  const faltantes = useMemo(() => {
    const mensajes: string[] = [];

    if (!estado.gps) {
      mensajes.push("Activa la ubicación (GPS) del teléfono.");
    }
    if (!estado.permisos) {
      mensajes.push("Concede el permiso de ubicación a LlegueBien.");
    }
    if (!estado.red) {
      mensajes.push("Conéctate a Wi-Fi o activa tus datos móviles.");
    }

    return mensajes;
  }, [estado]);

  return {
    ...estado,
    requisitosOk: estado.gps && estado.permisos && estado.red,
    faltantes,
    verificando,
    haVerificado,
    puedeSolicitarPermiso,
    verificar,
    revalidar: verificar,
    solicitarPermiso,
    abrirAjustes,
  };
}
