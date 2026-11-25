import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from "expo-keep-awake";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";

import { useRequisitosRecorrido, type RequisitosRecorrido } from "../hooks/useRequisitosRecorrido";
import { useUbicacionRecorrido } from "../hooks/useUbicacionRecorrido";
import type { Coordenada, PosicionRecorrido } from "../lib/recorrido";
import {
  activarEmergenciaRecorrido,
  invocarEnviarAlerta,
  obtenerAlertaActiva,
  obtenerCheckinAbierto,
  marcarCheckinPresentado,
  type CheckinAbierto,
  terminarEmergenciaRecorrido,
  type Alerta,
  type ModoAlerta,
  type RespuestaCheckin,
  type TipoAlerta,
} from "../services/emergencias";
import {
  confirmarCheckinConCola,
  encolarActivacionConAviso,
  contarPendientesOffline,
  descartarUbicacionesPendientes,
  encolarEventoOffline,
  generarClientEventId,
  guardarRecorridoActivoLocal,
  limpiarRecorridoActivoLocal,
  procesarColaOffline,
} from "../services/colaOffline";
import {
  guardarAlertaLocal, leerAlertaLocal, leerRecorridoVerificado,
  finalizarRecorrido,
  obtenerRecorridoActivo,
  olvidarRecorridoVerificado,
  type ResumenRecorrido,
  type ZonaRiesgoActiva,
} from "../services/recorridos";
import {
  leerPreguntaLocal,
  guardarPreguntaLocal,
  mostrarAccesoRapidoRecorrido,
  ocultarAccesoRapidoRecorrido,
} from "../services/notificacionesPush";
import { supabase } from "../services/supabase";
import { useSesion } from "./SesionContext";
import { BACKGROUND_LOCATION_TASK } from "../tasks/backgroundLocationTask";

const KEEP_AWAKE_TAG = "lleguebien-recorrido";
const AVISO_SEGUNDO_PLANO =
  "Activa la ubicación 'Permitir todo el tiempo' para seguir con la pantalla apagada.";

export type DestinoRecorrido = Coordenada & {
  nombre: string;
};

type EstadoRecorrido = {
  recorridoId: string | null;
  destino: DestinoRecorrido | null;
  recuperando: boolean;
  resumenFinal: ResumenRecorrido | null;

  red: boolean;
  requisitosOk: boolean;
  faltantes: string[];
  verificando: boolean;
  puedeSolicitarPermiso: boolean;
  revalidar: () => Promise<RequisitosRecorrido>;
  solicitarPermiso: () => Promise<boolean>;
  abrirAjustes: () => Promise<void>;

  ubicacionActual: PosicionRecorrido | null;
  distanciaRecorridaM: number;
  enZonaRiesgo: boolean;
  zonasRiesgoActuales: ZonaRiesgoActiva[];
  enviando: boolean;
  ultimoError: string | null;

  pendientesOffline: number;
  alertaActiva: Alerta | null;
  modoAlarma: ModoAlerta | null;
  segundoPlanoActivo: boolean;
  avisoSegundoPlano: string | null;
  sacudidasNecesarias: number;
  tiempoCancelacion: number;

  checkin: CheckinAbierto | null;
  presentarCheckin: (id: string) => Promise<void>;
  respondiendoCheckin: boolean;

  iniciarEmergencia: (
    tipo: TipoAlerta,
    modo: ModoAlerta,
  ) => Promise<Alerta>;
  responderCheckin: (respuesta: RespuestaCheckin, id: string) => Promise<void>;
  terminarEmergencia: () => Promise<void>;
  finalizarRecorridoActual: () => Promise<ResumenRecorrido>;
  recargarPendientes: () => Promise<void>;
};

const RecorridoContext = createContext<EstadoRecorrido | undefined>(undefined);

export function RecorridoProvider({ children }: { children: ReactNode }) {
  const { session } = useSesion();
  const usuarioId = session?.user.id;
  const [recorridoId, setRecorridoId] = useState<string | null>(null);
  const [destino, setDestino] = useState<DestinoRecorrido | null>(null);
  const [recuperando, setRecuperando] = useState(true);
  const [resumenFinal, setResumenFinal] = useState<ResumenRecorrido | null>(null);
  const [cierreRemoto, setCierreRemoto] = useState<string | null>(null);
  const [trackingActivo, setTrackingActivo] = useState(true);
  const [alertaActiva, setAlertaActiva] = useState<Alerta | null>(null);
  const [modoAlarma, setModoAlarma] = useState<ModoAlerta | null>(null);
  const [pendientesOffline, setPendientesOffline] = useState(0);
  const [segundoPlanoActivo, setSegundoPlanoActivo] = useState(false);
  const [avisoSegundoPlano, setAvisoSegundoPlano] = useState<string | null>(
    null,
  );
  const [sacudidasNecesarias, setSacudidasNecesarias] = useState(4);
  const [tiempoCancelacion, setTiempoCancelacion] = useState(8);
  const [checkin, setCheckin] = useState<CheckinAbierto | null>(null);
  const contestados = useRef(new Set<string>());
  const [respondiendoCheckin, setRespondiendoCheckin] = useState(false);

  const alertaActualRef = useRef<Alerta | null>(null);
  const noRecuperarAlertaRef = useRef(false);
  const cerradas = useRef(new Set<string>());
  const montadoRef = useRef(true);
  const arranqueGps = useRef<Promise<void> | null>(null);
  const segundoPlanoIniciadoRef = useRef(false);
  const respondiendoCheckinRef = useRef(false);

  const {
    gps, permisos, red, requisitosOk,
    faltantes,
    verificando,
    puedeSolicitarPermiso,
    revalidar,
    solicitarPermiso,
    abrirAjustes,
  } = useRequisitosRecorrido({ intervaloMs: 7000 });

  const {
    ubicacionActual,
    distanciaRecorridaM,
    enZonaRiesgo,
    zonasRiesgoActuales,
    enviando,
    ultimoError,
  } = useUbicacionRecorrido({
    recorridoId,
    listo: gps && permisos && trackingActivo,
    red,
  });

  const recargarPendientes = useCallback(async () => {
    try {
      const total = await contarPendientesOffline();
      if (montadoRef.current) setPendientesOffline(total);
    } catch {
      // SQLite aún no está disponible; se reintenta en el siguiente ciclo.
    }
  }, []);

  useEffect(() => {
    montadoRef.current = true;

    return () => {
      montadoRef.current = false;
    };
  }, []);

  useEffect(() => {
    noRecuperarAlertaRef.current = false;
    if (!recorridoId || Platform.OS === "web") return;
    let vigente = true;
    const revisar = async () => {
      if (vigente) await mostrarAccesoRapidoRecorrido(recorridoId, destino?.nombre);
    };
    void guardarRecorridoActivoLocal(recorridoId).then(revisar);
    const intervalo = setInterval(revisar, 10000);
    const cambios = AppState.addEventListener("change", estado => {
      if (estado === "active") void revisar();
    });
    return () => { vigente = false; clearInterval(intervalo); cambios.remove(); };
  }, [destino?.nombre, recorridoId]);

  useEffect(() => {
    let activo = true;

    const cargarConfiguracion = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) return;

        const { data } = await supabase
          .from("configuracion_sensores")
          .select("sacudidas_necesarias, tiempo_cancelacion")
          .eq("id_usuario", session.user.id)
          .maybeSingle();

        if (!activo || !data) return;

        setSacudidasNecesarias(Number(data.sacudidas_necesarias ?? 4));
        setTiempoCancelacion(Number(data.tiempo_cancelacion ?? 8));
      } catch {
        // Se mantienen los valores por defecto.
      }
    };

    void cargarConfiguracion();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    let activo = true;

    const actualizar = async () => {
      if (!activo) return;
      await recargarPendientes();
    };

    void actualizar();
    const intervalo = setInterval(actualizar, 3000);

    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [recargarPendientes]);

  const versionConsulta = useRef(0);
  const consultarCheckin = useCallback(async () => {
    if (!recorridoId) return;

    const version = ++versionConsulta.current;
    try {
      const [pregunta, alerta, recorrido] = await Promise.all([
        obtenerCheckinAbierto(recorridoId),
        obtenerAlertaActiva(recorridoId).catch(() => null),
        supabase.from("recorridos").select("estado").eq("id", recorridoId).maybeSingle(),
      ]);

      if (version !== versionConsulta.current) return;
      if (recorrido.data?.estado === "cancelado" || recorrido.data?.estado === "finalizado") {
        setCierreRemoto(recorridoId);
        return;
      }
      // El monitor puede escalar a emergencia sin intervención de la app.
      if (
        alerta &&
        !alertaActualRef.current &&
        !cerradas.current.has(alerta.client_event_id ?? alerta.id)
      ) {
        alertaActualRef.current = alerta;
        setAlertaActiva(alerta);
        setModoAlarma(alerta.modo);
      }

      const pendiente = pregunta && !contestados.current.has(pregunta.checkin_id) ? pregunta : null;
      setCheckin(pendiente);
      await guardarPreguntaLocal(recorridoId, pendiente);
    } catch {
      const local = await leerPreguntaLocal(recorridoId).catch(() => null);
      if (version === versionConsulta.current && local && !contestados.current.has(local.checkin_id)) setCheckin(local);
    }
  }, [recorridoId]);

  // Respaldo por sondeo: Realtime puede no estar disponible en todos los
  // entornos, pero el check-in debe aparecer aunque falle el websocket.
  useEffect(() => {
    if (!recorridoId) {
      setCheckin(null);
      return;
    }

    void consultarCheckin();
    const intervalo = setInterval(() => void consultarCheckin(), 10000);

    return () => { versionConsulta.current++; clearInterval(intervalo); };
  }, [consultarCheckin, recorridoId]);

  // Realtime: reacciona al instante cuando el monitor marca el check-in.
  useEffect(() => {
    if (!recorridoId) return;

    let activo = true;

    const canal = supabase
      .channel(`recorrido-checkin-${recorridoId}`)
      .on(
        "postgres_changes",
        {
          event: "*", schema: "public", table: "checkins_pasivos",
          filter: `recorrido_id=eq.${recorridoId}`,
        },
        () => { if (activo) void consultarCheckin(); },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alertas",
          filter: `id_recorrido=eq.${recorridoId}`,
        },
        (payload) => {
          if (!activo) return;

          const alerta = payload.new as Alerta;

          if (!alerta?.id || cerradas.current.has(alerta.client_event_id ?? alerta.id)) return;

          alertaActualRef.current = alerta;
          setAlertaActiva(alerta);
          setModoAlarma(alerta.modo);
          setCheckin(null);
        },
      )
      .subscribe();

    return () => {
      activo = false;
      void supabase.removeChannel(canal);
    };
  }, [consultarCheckin, recorridoId]);

  // Si la app está abierta cuando llega el push, refresca de inmediato.
  useEffect(() => {
    if (Platform.OS === "web" || !recorridoId) return;

    const suscripcion = Notifications.addNotificationReceivedListener(
      (notificacion) => {
        const data = notificacion.request.content.data as
          | Record<string, unknown>
          | null;

        if (data?.checkin === true && data?.recorrido_id === recorridoId) {
          void consultarCheckin();
        }
      },
    );

    return () => suscripcion.remove();
  }, [consultarCheckin, recorridoId]);

  // Si se reabre E10/E13 con un recorrido en emergencia, recupera la alerta.
  useEffect(() => {
    if (!recorridoId || alertaActiva || noRecuperarAlertaRef.current) return;

    let activo = true;

    const recuperarAlerta = async () => {
      const local = await leerAlertaLocal(recorridoId);
      if (local && local.id_usuario === usuarioId && activo && !alertaActualRef.current &&
          !cerradas.current.has(local.client_event_id ?? local.id)) {
        alertaActualRef.current = local;
        setAlertaActiva(local);
        setModoAlarma(local.modo);
      }
      return obtenerAlertaActiva(recorridoId);
    };
    recuperarAlerta()
      .then((alerta) => {
        if (!activo || !alerta) return;
        alertaActualRef.current = alerta;
        setAlertaActiva(alerta);
        setModoAlarma(alerta.modo);
      })
      .catch(() => undefined);

    return () => {
      activo = false;
    };
  }, [alertaActiva, recorridoId, usuarioId]);

  // Refresca la alerta provisional cuando la cola offline termina de sincronizar.
  useEffect(() => {
    if (!recorridoId || !alertaActiva) return;

    let activo = true;

    const consultar = async () => {
      try {
        const actual = await obtenerAlertaActiva(recorridoId);

        if (!activo || noRecuperarAlertaRef.current || alertaActualRef.current !== alertaActiva) return;
        if (!actual) {
          // Un ID provisional puede estar esperando su activación en SQLite.
          if (alertaActiva.id !== alertaActiva.client_event_id) {
            cerradas.current.add(alertaActiva.client_event_id ?? alertaActiva.id);
            alertaActualRef.current = null;
            setAlertaActiva(null);
            setModoAlarma(null);
            await guardarAlertaLocal(null).catch(console.warn);
          }
          return;
        }

        alertaActualRef.current = actual;
        setAlertaActiva(actual);
        setModoAlarma(actual.modo);
      } catch {
        // Se reintenta en el siguiente ciclo.
      }
    };

    const intervalo = setInterval(consultar, 5000);

    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [alertaActiva, recorridoId]);

  // Recupera el recorrido del usuario incluso si la ruta llegó sin parámetros o por enlace.
  useEffect(() => {
    if (!usuarioId || !trackingActivo) {
      setRecuperando(false);
      return;
    }

    let vigente = true;
    const recuperar = async () => {
      const local = await leerRecorridoVerificado(usuarioId);
      const recorrido = local ?? await obtenerRecorridoActivo();
      if (!vigente || recorrido?.id_usuario !== usuarioId) return;

      setRecorridoId(recorrido.id);
      if (recorrido.destino_lat != null && recorrido.destino_lng != null) {
        setDestino({
          nombre: recorrido.destino_nombre ?? "Destino",
          latitude: recorrido.destino_lat,
          longitude: recorrido.destino_lng,
        });
      }
    };

    void recuperar().catch(console.warn).finally(() => {
      if (vigente) setRecuperando(false);
    });
    return () => { vigente = false; };
  }, [trackingActivo, usuarioId]);

  const detenerSegundoPlano = useCallback(async () => {
    await arranqueGps.current;
    try {
      const iniciado = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK,
      ).catch(() => false);

      if (iniciado) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch {
      // La tarea pudo no estar registrada en este entorno.
    }

    await deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    segundoPlanoIniciadoRef.current = false;

    if (montadoRef.current) {
      setSegundoPlanoActivo(false);
    }
  }, []);

  const iniciarSegundoPlano = useCallback(async () => {
    try {
      const foreground = await Location.getForegroundPermissionsAsync();

      if (foreground.status !== "granted") {
        if (montadoRef.current) setAvisoSegundoPlano(AVISO_SEGUNDO_PLANO);
        return;
      }

      let background = await Location.getBackgroundPermissionsAsync();

      if (background.status !== "granted" && background.canAskAgain) {
        background = await Location.requestBackgroundPermissionsAsync();
      }

      const disponible = await TaskManager.isAvailableAsync().catch(
        () => false,
      );

      if (background.status === "granted" && disponible) {
        const yaIniciada = await Location.hasStartedLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK,
        ).catch(() => false);

        if (!yaIniciada) {
          await Location.startLocationUpdatesAsync(
            BACKGROUND_LOCATION_TASK,
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 0,
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: "LlegueBien",
                notificationBody: "Compartiendo recorrido en vivo",
                notificationColor: "#1ABC9C",
              },
            },
          );
        }

        segundoPlanoIniciadoRef.current = true;

        if (montadoRef.current) {
          setSegundoPlanoActivo(true);
          setAvisoSegundoPlano(null);
        }

        await deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
      } else {
        await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
        segundoPlanoIniciadoRef.current = false;

        if (montadoRef.current) {
          setSegundoPlanoActivo(false);
          setAvisoSegundoPlano(AVISO_SEGUNDO_PLANO);
        }
      }
    } catch (error) {
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);

      if (montadoRef.current) {
        setSegundoPlanoActivo(false);
        setAvisoSegundoPlano(AVISO_SEGUNDO_PLANO);
      }

      console.warn("[background-location] No se pudo iniciar", error);
    }
  }, []);

  useEffect(() => {
    if (!recorridoId || !trackingActivo) {
      return;
    }

    arranqueGps.current = iniciarSegundoPlano();

    // La tarea continúa si se desmonta la navegación durante un recorrido.
  }, [
    detenerSegundoPlano,
    iniciarSegundoPlano,
    recorridoId,
    trackingActivo,
  ]);

  useEffect(() => {
    if (alertaActiva) void guardarAlertaLocal(alertaActiva).catch(console.warn);
  }, [alertaActiva]);

  const iniciarEmergencia = useCallback(
    async (tipo: TipoAlerta, modo: ModoAlerta, evento?: string): Promise<Alerta> => {
      if (!recorridoId) {
        throw new Error("No hay un recorrido activo.");
      }

      if (alertaActualRef.current) return alertaActualRef.current;

      // Cualquier emergencia manual o pasiva sustituye el check-in pendiente.
      setCheckin(null);

      noRecuperarAlertaRef.current = false;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const clientEventId = evento ?? generarClientEventId();
      const ahora = new Date().toISOString();

      const provisional: Alerta = {
        id: clientEventId,
        id_recorrido: recorridoId,
        id_usuario: session?.user.id ?? "",
        tipo,
        estado: "activa",
        modo,
        lat: ubicacionActual?.latitude ?? null,
        lng: ubicacionActual?.longitude ?? null,
        notificados: 0,
        fallidos: 0,
        notificacion_enviada_en: null,
        iniciada_en: ahora,
        terminada_en: null,
        client_event_id: clientEventId,
      };

      if (evento && Platform.OS !== "web") {
        // La activación y el aviso sobreviven juntos a un cierre del proceso.
        await encolarActivacionConAviso({ recorridoId, tipo, modo, lat: provisional.lat,
          lng: provisional.lng, clientEventId });
      }
      alertaActualRef.current = provisional;
      setAlertaActiva(provisional);
      setModoAlarma(modo);
      if (evento && Platform.OS !== "web") return provisional;

      void (async () => {
        try {
          const servidor = await activarEmergenciaRecorrido({
            recorridoId,
            tipo,
            modo,
            lat: provisional.lat,
            lng: provisional.lng,
            clientEventId,
          });

          if (cerradas.current.has(clientEventId)) {
            // El usuario terminó la emergencia mientras el servidor aún
            // confirmaba la activación: se cierra en segundo plano.
            await terminarEmergenciaRecorrido(servidor.id, recorridoId).catch(
              () => undefined,
            );
            return;
          }

          alertaActualRef.current = servidor;
          if (montadoRef.current) { setAlertaActiva(servidor); setModoAlarma(servidor.modo); }

          try {
            const push = await invocarEnviarAlerta(
              servidor.id,
              recorridoId,
            );

            if (alertaActualRef.current?.client_event_id !== clientEventId) {
              return;
            }

            const actualizada: Alerta = {
              ...servidor,
              notificados: push.notificados,
              fallidos: push.fallidos,
              notificacion_enviada_en: new Date().toISOString(),
            };

            alertaActualRef.current = actualizada;
            if (montadoRef.current) setAlertaActiva(actualizada);
          } catch {
            await encolarEventoOffline("enviar_alerta_push", 1, {
              alertaId: servidor.id,
              recorridoId,
              clientEventId,
            });
          }
        } catch {
          await encolarEventoOffline("activar_emergencia", 1, {
            recorridoId,
            tipo,
            modo,
            lat: provisional.lat,
            lng: provisional.lng,
            clientEventId,
          });
          await encolarEventoOffline("enviar_alerta_push", 1, {
            recorridoId,
            clientEventId,
          });
        } finally {
          await recargarPendientes();
        }
      })();

      return provisional;
    },
    [recargarPendientes, recorridoId, ubicacionActual],
  );

  const presentarCheckin = useCallback(async (id: string) => {
    if (AppState.currentState !== "active") return;
    try {
      const fecha = await marcarCheckinPresentado(id);
      setCheckin(actual => actual?.checkin_id === id && fecha ? { ...actual, presentada_en: fecha } : actual);
    } catch {
      // Al recuperar red, el sondeo y la lectura de la bandeja reintentan.
    }
  }, []);

  const responderCheckin = useCallback(async (respuesta: RespuestaCheckin, id: string) => {
    if (!recorridoId || respondiendoCheckinRef.current) throw new Error("Respuesta pendiente.");
    respondiendoCheckinRef.current = true;
    setRespondiendoCheckin(true);
    try {
      if (respuesta === "necesito_ayuda") {
        await iniciarEmergencia("pasiva", "silencioso", id);
      } else {
        await confirmarCheckinConCola(id, recorridoId);
      }
      contestados.current.add(id);
      await guardarPreguntaLocal(recorridoId, null);
      setCheckin(actual => actual?.checkin_id === id ? null : actual);
    } finally {
      respondiendoCheckinRef.current = false;
      setRespondiendoCheckin(false);
    }
  }, [iniciarEmergencia, recorridoId]);

  const terminarEmergencia = useCallback(async () => {
    const alerta = alertaActualRef.current;

    if (!alerta || !recorridoId) return;

    await guardarAlertaLocal(null).catch(console.warn);
    cerradas.current.add(alerta.client_event_id ?? alerta.id);
    alertaActualRef.current = null;
    noRecuperarAlertaRef.current = true;
    setAlertaActiva(null);
    setModoAlarma(null);
    setCheckin(null);

    try {
      await terminarEmergenciaRecorrido(alerta.id, recorridoId);
    } catch {
      await encolarEventoOffline("terminar_emergencia", 1, {
        alertaId: alerta.id,
        clientEventId: alerta.client_event_id,
        recorridoId,
      });
    } finally {
      await recargarPendientes();
    }
  }, [recargarPendientes, recorridoId]);

  const limpiarRecorrido = useCallback(async () => {
    setTrackingActivo(false);
    setAlertaActiva(null);
    alertaActualRef.current = null;
    noRecuperarAlertaRef.current = true;
    setModoAlarma(null);
    setCheckin(null);
    setRecorridoId(null);
    setDestino(null);

    await detenerSegundoPlano();
    await limpiarRecorridoActivoLocal();
    await olvidarRecorridoVerificado();
    await ocultarAccesoRapidoRecorrido();
  }, [detenerSegundoPlano]);

  useEffect(() => {
    if (cierreRemoto && cierreRemoto === recorridoId) void limpiarRecorrido();
  }, [cierreRemoto, recorridoId, limpiarRecorrido]);

  const finalizarRecorridoActual = useCallback(async () => {
    if (!recorridoId) {
      throw new Error("No hay un recorrido activo.");
    }

    // Último intento de vaciar la cola antes de cerrar el recorrido.
    await procesarColaOffline();

    const resumen = await finalizarRecorrido(recorridoId);

    // Los puntos que no llegaron a subir ya no son aceptados por la RPC.
    await descartarUbicacionesPendientes(recorridoId);

    await limpiarRecorrido();
    setResumenFinal(resumen);
    return resumen;
  }, [limpiarRecorrido, recorridoId]);

  const value = useMemo<EstadoRecorrido>(
    () => ({
      recorridoId,
      destino,
      recuperando,
      resumenFinal,
      red,
      requisitosOk,
      faltantes,
      verificando,
      puedeSolicitarPermiso,
      revalidar,
      solicitarPermiso,
      abrirAjustes,
      ubicacionActual,
      distanciaRecorridaM,
      enZonaRiesgo,
      zonasRiesgoActuales,
      enviando,
      ultimoError,
      pendientesOffline,
      alertaActiva,
      modoAlarma,
      segundoPlanoActivo,
      avisoSegundoPlano,
      sacudidasNecesarias,
      tiempoCancelacion,
      checkin,
      presentarCheckin,
      respondiendoCheckin,
      iniciarEmergencia,
      responderCheckin,
      terminarEmergencia,
      finalizarRecorridoActual,
      recargarPendientes,
    }),
    [
      abrirAjustes,
      alertaActiva,
      avisoSegundoPlano,
      checkin,
      presentarCheckin,
      destino,
      distanciaRecorridaM,
      enZonaRiesgo,
      enviando,
      faltantes,
      finalizarRecorridoActual,
      iniciarEmergencia,
      modoAlarma,
      pendientesOffline,
      puedeSolicitarPermiso,
      recargarPendientes,
      recorridoId,
      recuperando,
      resumenFinal,
      responderCheckin,
      respondiendoCheckin,
      revalidar,
      red,
      requisitosOk,
      sacudidasNecesarias,
      segundoPlanoActivo,
      solicitarPermiso,
      terminarEmergencia,
      tiempoCancelacion,
      ubicacionActual,
      ultimoError,
      verificando,
      zonasRiesgoActuales,
    ],
  );

  return (
    <RecorridoContext.Provider value={value}>
      {children}
    </RecorridoContext.Provider>
  );
}

export function useRecorrido(): EstadoRecorrido {
  const contexto = useContext(RecorridoContext);

  if (!contexto) {
    throw new Error("useRecorrido debe usarse dentro de RecorridoProvider.");
  }

  return contexto;
}
