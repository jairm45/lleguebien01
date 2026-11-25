import * as Network from "expo-network";
import { router, usePathname, useRootNavigationState } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, AppState } from "react-native";
import {
  leerAlertaLocal, leerRecorridoVerificado, observarRecorridoVerificado,
  obtenerRecorridoActivo, type RecorridoVerificado,
} from "../services/recorridos";

export function avisarSalidaBloqueada() {
  Alert.alert("Recorrido activo", "Tienes un recorrido en curso. Para salir, debes finalizarlo pulsando 'Ya llegué'.");
}

// La misma guardia cubre inicio, enlaces externos y el selector de destinos.
export function useGuardiaRecorrido(usuario?: string) {
  const ruta = usePathname();
  const raiz = useRootNavigationState()?.key;
  const [activo, setActivo] = useState<RecorridoVerificado | null>(null);
  const [usuarioLeido, setUsuarioLeido] = useState<string | null>(null);
  useEffect(() => {
    if (!usuario) { setActivo(null); setUsuarioLeido(null); return; }
    let vigente = true;
    let lectura = 0;
    let consultando = false;
    const local = async () => {
      const turno = ++lectura;
      const recorrido = await leerRecorridoVerificado(usuario).catch(() => null);
      if (vigente && turno === lectura) {
        setActivo(recorrido);
        setUsuarioLeido(usuario);
      }
    };
    const contrastar = async () => {
      if (consultando) return;
      consultando = true;
      try {
        await local();
        const red = await Network.getNetworkStateAsync();
        if (vigente && red.isConnected !== false && red.isInternetReachable !== false) {
          await obtenerRecorridoActivo();
        }
      } catch {
        // Una consulta fallida conserva el último recorrido verificado del usuario.
      } finally { consultando = false; }
    };
    const quitar = observarRecorridoVerificado(() => { void local().catch(console.warn); });
    void contrastar();
    const app = AppState.addEventListener("change", estado => { if (estado === "active") void contrastar(); });
    const red = Network.addNetworkStateListener(estado => { if (estado.isConnected) void contrastar(); });
    return () => { vigente = false; quitar(); app.remove(); red.remove(); };
  }, [usuario]);

  const enFlujo = ruta === "/recorrido" || (ruta.startsWith("/recorrido/") && ruta !== "/recorrido/llegada");
  useEffect(() => {
    if (!raiz || !activo || activo.id_usuario !== usuario || enFlujo) return;
    let vigente = true;
    void Promise.all([
      leerRecorridoVerificado(usuario),
      leerAlertaLocal(activo.id),
    ]).then(([actual, alerta]) => {
      if (!vigente || actual?.id !== activo.id) return;
      router.replace(alerta || actual.estado === "emergencia" ? "/recorrido/emergencia" : "/recorrido");
    }).catch(console.warn);
    return () => { vigente = false; };
  }, [activo, enFlujo, raiz, ruta, usuario]);
  const tieneRecorrido = Boolean(usuario && activo?.id_usuario === usuario);
  const leyendoCache = Boolean(usuario && usuarioLeido !== usuario);
  return {
    leyendoCache,
    bloqueo: tieneRecorrido && enFlujo,
    esperarParaNotificaciones: leyendoCache || (tieneRecorrido && !enFlujo),
  };
}
