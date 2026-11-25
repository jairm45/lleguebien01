import * as Notifications from "expo-notifications";
import { obtenerDb } from "./colaOffline";

export type Intencion = {
  clave: string;
  accion: string;
  datos: Record<string, unknown>;
};

function claveRespuesta(respuesta: Notifications.NotificationResponse) {
  const { request, date } = respuesta.notification;
  return JSON.stringify([request.identifier, request.content.data?.publicacion ?? date, respuesta.actionIdentifier]);
}

export async function guardarIntencion(respuesta: Notifications.NotificationResponse | null) {
  if (!respuesta) return;
  const { request } = respuesta.notification;
  const datos = request.content.data;
  if (typeof datos?.recorrido_id !== "string") return;
  const clave = claveRespuesta(respuesta);
  const intencion: Intencion = { clave, accion: respuesta.actionIdentifier, datos };
  const db = await obtenerDb();
  await db.runAsync("insert or ignore into intenciones_notificacion(clave,datos,creada_en) values(?,?,?)",
    clave, JSON.stringify(intencion), Date.now());
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
