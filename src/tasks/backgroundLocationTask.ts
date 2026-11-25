import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { confirmarRecepcion, mostrarAccesoRapidoRecorrido, ocultarAccesoRapidoRecorrido } from "../services/notificacionesPush";
import * as Location from "expo-location";
import { supabase } from "../services/supabase";
import { guardarIntencion } from "../services/intencionesNotificacion";
import * as TaskManager from "expo-task-manager";

import {
  encolarEventoOffline,
  limpiarRecorridoActivoLocal,
  generarClientEventId,
  obtenerRecorridoActivoLocal,
} from "../services/colaOffline";
import { olvidarRecorridoVerificado, registrarUbicacionRecorrido } from "../services/recorridos";

export const BACKGROUND_LOCATION_TASK = "LLEGUEBIEN_BACKGROUND_LOCATION";

type DatosTareaUbicacion = {
  locations?: Location.LocationObject[];
};

TaskManager.defineTask<DatosTareaUbicacion>(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    const recorridoId = await obtenerRecorridoActivoLocal();
    if (!recorridoId) return;
    const accesoRapido = mostrarAccesoRapidoRecorrido(recorridoId);
    const locations = data?.locations ?? [];
    if (error || locations.length === 0) {
      if (error) console.warn("[background-location] Error de tarea", error.message);
      await accesoRapido;
      return;
    }

    for (const location of locations) {
      const clientEventId = generarClientEventId();
      const capturedAt = new Date(
        location.timestamp || Date.now(),
      ).toISOString();

      const coordenada = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      const payload = {
        recorridoId,
        lat: coordenada.latitude,
        lng: coordenada.longitude,
        precision: location.coords.accuracy,
        velocidad: location.coords.speed,
        heading: location.coords.heading,
        capturedAt,
        clientEventId,
      };

      try {
        await registrarUbicacionRecorrido(recorridoId, coordenada, {
          precision: location.coords.accuracy,
          velocidad: location.coords.speed,
          heading: location.coords.heading,
          capturedAt,
          clientEventId,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("no activo")) {
          const { data: fila } = await supabase.from("recorridos").select("estado").eq("id", recorridoId).maybeSingle();
          if (["finalizado", "cancelado"].includes(fila?.estado) && await obtenerRecorridoActivoLocal() === recorridoId) {
            await limpiarRecorridoActivoLocal();
            await olvidarRecorridoVerificado();
            await ocultarAccesoRapidoRecorrido();
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            return;
          }
        }
        await encolarEventoOffline("ubicacion", 2, payload);
      }
    }
    await accesoRapido;
  },
);

const TAREA_RECEPCION = "LLEGUEBIEN_RECEPCION_CHECKIN";
TaskManager.defineTask<Notifications.NotificationTaskPayload>(TAREA_RECEPCION, async ({ data, error }) => {
  if (error || !data) return;
  if ("actionIdentifier" in data) {
    await guardarIntencion(data);
    await confirmarRecepcion(data.notification.request.content.data);
    return;
  }
  const carga = data.data;
  if (carga) {
    const datos = typeof carga.dataString === "string" ? JSON.parse(carga.dataString) : carga;
    await confirmarRecepcion(datos);
  }
});

export async function registrarTareaRecepcion() {
  if (Platform.OS !== "web" && !(await TaskManager.isTaskRegisteredAsync(TAREA_RECEPCION))) {
    await Notifications.registerTaskAsync(TAREA_RECEPCION);
  }
}
