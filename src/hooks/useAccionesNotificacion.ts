import * as Network from "expo-network";
import * as Notifications from "expo-notifications";
import { router, useGlobalSearchParams, useNavigationContainerRef, useRootNavigationState, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { destinoPushSeguidor } from "../lib/navegacionSeguidor";
import { useSesion } from "../context/SesionContext";
import { confirmarCheckinConCola, obtenerRecorridoActivoLocal } from "../services/colaOffline";
import { obtenerCheckinAbierto } from "../services/emergencias";
import { completarIntencion, guardarIntencion, siguienteIntencion } from "../services/intencionesNotificacion";
import { ACCION_ESTOY_BIEN, ACCION_NECESITO_AYUDA, ACCION_SOS_SILENCIOSO,
  confirmarRecepcion, mostrarAccesoRapidoRecorrido, registrarCategoriasNotificaciones } from "../services/notificacionesPush";
import { leerRecorridoVerificado, obtenerRecorridoActivo } from "../services/recorridos";
import { registrarTareaRecepcion } from "../tasks/backgroundLocationTask";

export function useAccionesNotificacion(esperarRecorrido: boolean) {
  const { session, cargando, perfil, leyendoPerfil, errorPerfil } = useSesion();
  const familiar = perfil?.rol === "seguidor";
  const navegador = useNavigationContainerRef();
  const ruta = usePathname();
  const { recorridoId: recorridoVisible, alertaId: alertaVisible } = useGlobalSearchParams();
  const pantalla = useRef({ ruta, recorridoVisible, alertaVisible });
  const raiz = useRootNavigationState()?.key;
  const usuarioId = session?.user.id;
  const despertar = useRef<() => void>(() => {});

  useEffect(() => {
    if (Platform.OS === "web" || !familiar) return;
    Notifications.setNotificationHandler({
      handleNotification: async n => {
        const mostrar = !!destinoPushSeguidor(n.request.content.data ?? {}, true);
        return { shouldShowBanner: mostrar, shouldShowList: mostrar, shouldPlaySound: mostrar, shouldSetBadge: false };
      },
    });
    return () => Notifications.setNotificationHandler(null);
  }, [familiar]);

  useEffect(() => {
    pantalla.current = { ruta, recorridoVisible, alertaVisible };
    despertar.current();
  }, [ruta, recorridoVisible, alertaVisible]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    void registrarCategoriasNotificaciones();
    void registrarTareaRecepcion().catch(console.warn);
    const guardar = (r: Notifications.NotificationResponse | null) => {
      void guardarIntencion(r).then(() => despertar.current()).catch(console.warn);
    };
    const acciones = Notifications.addNotificationResponseReceivedListener(guardar);
    const llegadas = Notifications.addNotificationReceivedListener(n => {
      void confirmarRecepcion(n.request.content.data);
    });
    void Notifications.getLastNotificationResponseAsync().then(guardar).catch(console.warn);
    return () => { acciones.remove(); llegadas.remove(); };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || cargando || esperarRecorrido || !usuarioId || !raiz) return;
    let vigente = true;
    let ocupado = false;
    let enPantalla: { clave: string; hasta: number } | null = null;
    const procesar = async () => {
      if (ocupado || !vigente || !navegador.isReady() || pantalla.current.ruta === "/") return;
      ocupado = true;
      try {
        const i = await siguienteIntencion();
        if (!i || !vigente || (enPantalla?.clave === i.clave && enPantalla.hasta > Date.now())) return;
        const { datos, accion } = i;
        const recorridoId = String(datos.recorrido_id);
        const destino = destinoPushSeguidor(datos, accion === Notifications.DEFAULT_ACTION_IDENTIFIER);
        if (destino && (leyendoPerfil || errorPerfil || !perfil)) return;
        if (familiar) {
          if (destino) {
            if (!perfil?.ciudad || !perfil.pais || !perfil.identificacion || !perfil.nombre_completo || !perfil.telefono) return;
            const actual = pantalla.current;
            if (actual.ruta !== destino.pathname || actual.recorridoVisible !== destino.params.recorridoId ||
              actual.alertaVisible !== destino.params.alertaId) {
              router.navigate(destino);
              return; // El cambio de ruta despierta la cola y confirma el toque con sus dos identificadores.
            }
          }
          await completarIntencion(i.clave);
          return;
        }
        if (typeof datos.alerta_id === "string" && accion === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          const propio = await leerRecorridoVerificado(usuarioId);
          if (!vigente) return;
          if (propio?.id === recorridoId && propio.estado === "emergencia")
            router.navigate({ pathname: "/recorrido/emergencia", params: { recorridoId, modo: String(datos.modo ?? "") } });
          await completarIntencion(i.clave);
          return;
        }
        const red = await Network.getNetworkStateAsync().catch(() => null);
        let enLinea = red?.isConnected !== false && red?.isInternetReachable !== false;
        let activo;
        if (enLinea) {
          try {
            activo = await obtenerRecorridoActivo();
          } catch {
            enLinea = false;
          }
        }
        if (!enLinea) {
          activo = await leerRecorridoVerificado(usuarioId);
          if (!activo || activo.id !== await obtenerRecorridoActivoLocal()) return;
        }
        if (!vigente) return;
        if (activo?.id === recorridoId && activo.id_usuario === usuarioId) {
          const params = {
            recorridoId, destinoNombre: activo.destino_nombre ?? "Destino",
            destinoLat: String(activo.destino_lat ?? ""), destinoLng: String(activo.destino_lng ?? ""),
          };
          const id = datos.checkin_id;
          if (accion === ACCION_SOS_SILENCIOSO) {
            router.push({ pathname: "/recorrido/sos", params: { ...params, modo: "silencioso", origen: "notificacion" } });
            void mostrarAccesoRapidoRecorrido(recorridoId, activo.destino_nombre, true);
          } else if (accion === ACCION_ESTOY_BIEN && typeof id === "string") {
            await confirmarCheckinConCola(id, recorridoId);
            if (vigente) router.navigate({ pathname: "/recorrido", params });
          } else if (accion === ACCION_NECESITO_AYUDA && typeof id === "string") {
            const abierta = !enLinea || (await obtenerCheckinAbierto(recorridoId))?.checkin_id === id;
            if (!vigente) return;
            if (abierta) {
              router.navigate({ pathname: "/recorrido", params: { ...params, ayudaCheckin: id, intencion: i.clave } });
              enPantalla = { clave: i.clave, hasta: Date.now() + 15000 };
              return; // E10 confirma la intención tras guardar la activación y el aviso.
            }
            if ("estado" in activo && activo.estado === "emergencia") {
              router.navigate({ pathname: "/recorrido/emergencia", params: { ...params, modo: "silencioso" } });
            }
          } else {
            router.navigate({ pathname: "/recorrido", params });
          }
        }
        if (vigente) await completarIntencion(i.clave);
      } catch (error) {
        console.warn("[notificaciones] Se reintentará la acción", error);
      } finally {
        ocupado = false;
      }
    };
    despertar.current = () => void procesar();
    void procesar();
    const intervalo = setInterval(procesar, 2000);
    return () => { vigente = false; clearInterval(intervalo); despertar.current = () => {}; };
  }, [cargando, esperarRecorrido, navegador, raiz, usuarioId, familiar, leyendoPerfil, errorPerfil, perfil]);
}
