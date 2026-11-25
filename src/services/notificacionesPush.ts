import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { obtenerRecorridoActivoLocal } from "./colaOffline";
import { marcarCheckinPresentado, type CheckinAbierto } from "./emergencias";
import { supabase } from "./supabase";

const TOKEN_KEY = "lleguebien:expoPushToken";
const CANALES_VERSION_KEY = "lleguebien:canalesVersion";
const CANALES_VERSION = "2";
const ACCESO_RAPIDO_ID = "lleguebien:recorrido-rapido";

export const CATEGORIA_CHECKIN = "CHECKIN_SEGURIDAD";
export const CATEGORIA_RECORRIDO_RAPIDO = "RECORRIDO_RAPIDO";

export const ACCION_ESTOY_BIEN = "CHECKIN_ESTOY_BIEN";
export const ACCION_NECESITO_AYUDA = "CHECKIN_NECESITO_AYUDA";
export const ACCION_SOS_SILENCIOSO = "SOS_SILENCIOSO";

/**
 * Categorías de acciones interactivas. Se registran en el sistema operativo
 * para que los botones aparezcan incluso en la pantalla de bloqueo.
 */
export async function registrarCategoriasNotificaciones(): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    await Notifications.setNotificationCategoryAsync(
      CATEGORIA_CHECKIN,
      [
        {
          identifier: ACCION_ESTOY_BIEN,
          buttonTitle: "Sí, estoy bien",
          options: { opensAppToForeground: true },
        },
        {
          identifier: ACCION_NECESITO_AYUDA,
          buttonTitle: "Pedir ayuda (SOS)",
          options: { isDestructive: true, opensAppToForeground: true },
        },
      ],
      { previewPlaceholder: "Check-in de seguridad" },
    );

    await Notifications.setNotificationCategoryAsync(
      CATEGORIA_RECORRIDO_RAPIDO,
      [
        {
          identifier: ACCION_SOS_SILENCIOSO,
          buttonTitle: "SOS Silencioso",
          options: { isDestructive: true, opensAppToForeground: true },
        },
      ],
    );
  } catch (error) {
    console.warn("[push] No se pudieron registrar las categorías", error);
  }
}

export async function crearCanalesNotificaciones(): Promise<void> {
  if (Platform.OS !== "android") return;

  // Android no permite cambiar el sonido de un canal ya creado. Si la app se
  // actualizó desde una versión con configuración inválida, se recrean una vez.
  const version = await AsyncStorage.getItem(CANALES_VERSION_KEY).catch(
    () => null,
  );

  if (version !== CANALES_VERSION) {
    await Notifications.deleteNotificationChannelAsync(
      "emergencias",
    ).catch(() => undefined);
    await Notifications.deleteNotificationChannelAsync(
      "recorrido",
    ).catch(() => undefined);
  }

  await Notifications.setNotificationChannelAsync("emergencias", {
    name: "Emergencias",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await Notifications.setNotificationChannelAsync("recorrido", {
    name: "Recorrido en vivo",
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: false,
  });

  await AsyncStorage.setItem(CANALES_VERSION_KEY, CANALES_VERSION).catch(
    () => undefined,
  );
}

export async function registrarTokenPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    await registrarCategoriasNotificaciones();
    await crearCanalesNotificaciones();

    const permisos = await Notifications.getPermissionsAsync();
    const concedido =
      permisos.granted ||
      permisos.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!concedido) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn("[push] Falta el projectId de EAS.");
      return null;
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({ projectId })
    ).data;

    const { error } = await supabase.rpc("registrar_token_push", {
      p_expo_push_token: token,
      p_plataforma: Platform.OS === "ios" ? "ios" : "android",
    });

    if (error) {
      console.warn("[push] No se pudo registrar el token", error.message);
      return null;
    }

    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (error) {
    console.warn("[push] Error registrando token", error);
    return null;
  }
}

export async function eliminarTokenPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);

    if (token) {
      const { error } = await supabase.rpc("eliminar_token_push", {
        p_expo_push_token: token,
      });

      if (error) {
        console.warn("[push] No se pudo eliminar el token", error.message);
      }
    }

    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.warn("[push] Error eliminando token", error);
  }
}

/**
 * Notificación de acceso rápido con el botón "SOS Silencioso". No activa nada
 * por sí sola: abre E12, donde el estudiante debe mantener presionado 3 s para
 * evitar activaciones accidentales dentro del bolsillo.
 */
export async function mostrarAccesoRapidoRecorrido(
  recorridoId: string,
  destinoNombre?: string | null,
  renovar = false,
): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const permisos = await Notifications.getPermissionsAsync();
    const concedido =
      permisos.granted ||
      permisos.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!concedido) return;

    const presentes = await Notifications.getPresentedNotificationsAsync();
    for (const notificacion of presentes) {
      const datos = notificacion.request.content.data;
      if (datos?.recorrido_id === recorridoId) await confirmarRecepcion(datos);
    }
    if (!renovar && presentes.some(n => n.request.identifier === ACCESO_RAPIDO_ID &&
      n.request.content.data?.recorrido_id === recorridoId && n.request.content.data.publicacion)) return;
    if (await obtenerRecorridoActivoLocal() !== recorridoId) return;
    await registrarCategoriasNotificaciones();
    await Notifications.scheduleNotificationAsync({
      identifier: ACCESO_RAPIDO_ID,
      content: {
        title: "Recorrido protegido",
        body: destinoNombre
          ? `Hacia ${destinoNombre}. Usa "SOS Silencioso" si necesitas ayuda discreta.`
          : 'Usa "SOS Silencioso" si necesitas ayuda discreta.',
        categoryIdentifier: CATEGORIA_RECORRIDO_RAPIDO,
        data: {
          recorrido_id: recorridoId,
          tipo: "acceso_rapido",
          publicacion: Date.now(),
          screen: "recorrido",
        },
        sound: false,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        autoDismiss: false,
        sticky: true,
      },
      trigger: { channelId: "recorrido" },
    });
    if (await obtenerRecorridoActivoLocal() === null) await ocultarAccesoRapidoRecorrido();
  } catch (error) {
    console.warn("[push] No se pudo mostrar el acceso rápido", error);
  }
}

export async function ocultarAccesoRapidoRecorrido(): Promise<void> {
  if (Platform.OS === "web") return;

  await Notifications.dismissNotificationAsync(ACCESO_RAPIDO_ID).catch(
    () => undefined,
  );
  await Notifications.cancelScheduledNotificationAsync(ACCESO_RAPIDO_ID).catch(
    () => undefined,
  );
}

const recibidas = new Set<string>();
const clavePregunta = (recorridoId: string) => "lleguebien:checkin:" + recorridoId;

export async function leerPreguntaLocal(recorridoId: string): Promise<CheckinAbierto | null> {
  const texto = await AsyncStorage.getItem(clavePregunta(recorridoId));
  if (!texto) return null;
  const pregunta: CheckinAbierto = JSON.parse(texto);
  const vence = pregunta.presentada_en ? Date.parse(pregunta.presentada_en) + 60000 :
    Date.parse(pregunta.creada_en) + 90000;
  return Date.now() < vence ? pregunta : null;
}

export async function guardarPreguntaLocal(recorridoId: string, pregunta: CheckinAbierto | null) {
  if (pregunta) await AsyncStorage.setItem(clavePregunta(recorridoId), JSON.stringify(pregunta));
  else await AsyncStorage.removeItem(clavePregunta(recorridoId));
}

export async function confirmarRecepcion(datos: Record<string, unknown> | null | undefined) {
  const id = datos?.checkin_id;
  if (datos?.checkin !== true || typeof id !== "string" || recibidas.has(id)) return;
  const { motivo, creada_en, recorrido_id } = datos;
  if (typeof recorrido_id !== "string" || typeof creada_en !== "string" ||
      !["sin_senal", "parada_zona_riesgo", "retraso_eta"].includes(String(motivo))) return;
  if (await obtenerRecorridoActivoLocal() !== recorrido_id) return;
  const previa = await leerPreguntaLocal(recorrido_id);
  if (previa && Date.parse(previa.creada_en) > Date.parse(creada_en)) return;
  const pregunta: CheckinAbierto = { checkin_id: id, recorrido_id, creada_en,
    motivo: motivo as CheckinAbierto["motivo"], presentada_en: previa?.checkin_id === id ? previa.presentada_en : null };
  if (Date.parse(creada_en) + 90000 > Date.now()) await guardarPreguntaLocal(recorrido_id, pregunta);
  try {
    const presentada = await marcarCheckinPresentado(id);
    recibidas.add(id);
    if (presentada) await guardarPreguntaLocal(recorrido_id, { ...pregunta, presentada_en: presentada });
  } catch {
    // El modal y la siguiente lectura de notificaciones pueden confirmar la entrega.
  }
}
