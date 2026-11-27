import * as Notifications from "expo-notifications";
import { destinoPushSeguidor } from "../lib/navegacionSeguidor";
import { obtenerDb } from "./colaOffline";

export type Intencion = {
  clave: string;
  accion: string;
  datos: Record<string, unknown>;
};

function datosRespuesta({ notification }: Notifications.NotificationResponse): Record<string, unknown> | null {
  const contenido = notification.request.content;
  if (contenido.data) return contenido.data;
  // En Android la tarea en segundo plano recibe el bundle nativo sin el mapeo del listener de Expo.
  if ("dataString" in contenido && typeof contenido.dataString === "string") {
    const datos = JSON.parse(contenido.dataString);
    if (datos && typeof datos === "object" && !Array.isArray(datos)) return datos;
  }
  return null;
}

function claveRespuesta(respuesta: Notifications.NotificationResponse, datos = datosRespuesta(respuesta)) {
  const { request, date } = respuesta.notification;
  return JSON.stringify([request.identifier, datos?.publicacion ?? date, respuesta.actionIdentifier]);
}

export async function guardarIntencion(respuesta: Notifications.NotificationResponse | null) {
  if (!respuesta) return;
  const datos = datosRespuesta(respuesta);
  if (!datos || (typeof datos.recorrido_id !== "string" &&
    !destinoPushSeguidor(datos, respuesta.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER))) return;
  const clave = claveRespuesta(respuesta, datos);
  const intencion: Intencion = { clave, accion: respuesta.actionIdentifier, datos };
  const db = await obtenerDb();
  await db.runAsync("insert or ignore into intenciones_notificacion(clave,datos,creada_en) values(?,?,?)",
    clave, JSON.stringify(intencion), Date.now());
  return datos;
}

export async function siguienteIntencion(): Promise<Intencion | null> {
  const db = await obtenerDb();
  const fila = await db.getFirstAsync<{ datos: string }>(
    "select datos from intenciones_notificacion where atendida=0 order by creada_en,rowid limit 1");
  return fila ? JSON.parse(fila.datos) : null;
}

export async function completarIntencion(clave: string) {
  const db = await obtenerDb();
  await db.runAsync("update intenciones_notificacion set atendida=1 where clave=?", clave);
  const ultima = await Notifications.getLastNotificationResponseAsync().catch(() => null);
  if (ultima && claveRespuesta(ultima) === clave) await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  await db.runAsync("delete from intenciones_notificacion where atendida=1 and creada_en < ?",
    Date.now() - 7 * 86400000);
}
