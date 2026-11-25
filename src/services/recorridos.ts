import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Feature, LineString } from "geojson";

import type { Coordenada } from "../lib/recorrido";
import { supabase } from "./supabase";

export type EstadoRecorrido =
  | "activo"
  | "finalizado"
  | "cancelado"
  | "emergencia";

export type MotivoCheckin =
  | "sin_senal"
  | "retraso_eta"
  | "parada_zona_riesgo";

export type RecorridoActivo = {
  id: string;
  id_usuario: string;
  estado: EstadoRecorrido;
  destino_nombre: string | null;
  origen_lat: number | null;
  origen_lng: number | null;
  destino_lat: number | null;
  destino_lng: number | null;
  ruta_geojson: Feature<LineString> | null;
  distancia_metros: number | null;
  duracion_segundos: number | null;
  iniciado_en: string;
  eta_estimado_en: string | null;
  ultima_ubicacion_en: string | null;
  parada_riesgo_desde: string | null;
};

export type ZonaRiesgoActiva = {
  id: string;
  nombre: string;
  nivel: string;
};

export type ResultadoUbicacion = {
  ubicacion_id: number;
  es_valido: boolean;
  distancia_acumulada_metros: number;
  en_zona_riesgo: boolean;
  zonas_riesgo_activas: ZonaRiesgoActiva[];
  parada_riesgo?: boolean;
};

export type ResumenRecorrido = {
  recorrido_id: string;
  destino_nombre: string | null;
  distancia_metros: number;
  duracion_segundos: number;
  iniciado_en: string;
  finalizado_en: string;
  seguidores_notificados: number;
};

type CrearRecorridoInput = {
  origen: Coordenada;
  destino: Coordenada;
  destinoNombre: string;
  ruta?: Feature<LineString> | null;
  duracionEstimadaSegundos?: number | null;
};

type OpcionesUbicacion = {
  precision?: number | null;
  velocidad?: number | null;
  heading?: number | null;
  capturedAt?: string | null;
  clientEventId?: string | null;
};

async function obtenerUsuarioId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No hay una sesión activa.");
  }

  return user.id;
}

const CLAVE_ACTIVO = "lleguebien:recorridoVerificado";
export type RecorridoVerificado = Pick<RecorridoActivo, "id" | "id_usuario" | "destino_lat" | "destino_lng" | "destino_nombre">;

export async function leerRecorridoVerificado(usuarioId: string): Promise<RecorridoVerificado | null> {
  const texto = await AsyncStorage.getItem(CLAVE_ACTIVO);
  if (!texto) return null;
  const activo: RecorridoVerificado = JSON.parse(texto);
  return activo.id_usuario === usuarioId ? activo : null;
}

export function olvidarRecorridoVerificado() {
  return AsyncStorage.removeItem(CLAVE_ACTIVO);
}

async function recordarRecorrido(activo: RecorridoVerificado | null) {
  if (!activo) return olvidarRecorridoVerificado();
  const { id, id_usuario, destino_lat, destino_lng, destino_nombre } = activo;
  await AsyncStorage.setItem(CLAVE_ACTIVO, JSON.stringify({ id, id_usuario, destino_lat, destino_lng, destino_nombre }));
}

export async function obtenerRecorridoActivo(): Promise<RecorridoActivo | null> {
  const {
    data: { user }, error: errorUsuario,
  } = await supabase.auth.getUser();

  if (errorUsuario) throw errorUsuario;
  if (!user) return null;

  const { data, error } = await supabase
    .from("recorridos")
    .select(
      "id, id_usuario, estado, destino_nombre, origen_lat, origen_lng, destino_lat, destino_lng, ruta_geojson, distancia_metros, duracion_segundos, iniciado_en, eta_estimado_en, ultima_ubicacion_en, parada_riesgo_desde",
    )
    .eq("id_usuario", user.id)
    .in("estado", ["activo", "emergencia"])
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo consultar el recorrido activo: ${error.message}`);
  }

  await recordarRecorrido(data).catch(() => undefined);
  return (data as RecorridoActivo | null) ?? null;
}

export async function crearRecorrido({
  origen,
  destino,
  destinoNombre,
  ruta = null,
  duracionEstimadaSegundos = null,
}: CrearRecorridoInput): Promise<string> {
  // Evita recorridos duplicados si la app se reabre o se pierde la navegación.
  const activo = await obtenerRecorridoActivo();
  if (activo) return activo.id;

  const idUsuario = await obtenerUsuarioId();

  const etaEstimadoEn =
    duracionEstimadaSegundos && duracionEstimadaSegundos > 0
      ? new Date(Date.now() + duracionEstimadaSegundos * 1000).toISOString()
      : null;

  const { data, error } = await supabase
    .from("recorridos")
    .insert({
      id_usuario: idUsuario,
      estado: "activo",
      origen_lat: origen.latitude,
      origen_lng: origen.longitude,
      destino_lat: destino.latitude,
      destino_lng: destino.longitude,
      destino_nombre: destinoNombre,
      ruta_geojson: ruta,
      eta_estimado_en: etaEstimadoEn,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`No se pudo crear el recorrido: ${error.message}`);
  }

  await recordarRecorrido({ id: data.id, id_usuario: idUsuario, destino_lat: destino.latitude,
    destino_lng: destino.longitude, destino_nombre: destinoNombre }).catch(() => undefined);
  return data.id;
}

export async function registrarUbicacionRecorrido(
  recorridoId: string,
  ubicacion: Coordenada,
  opciones: OpcionesUbicacion = {},
): Promise<ResultadoUbicacion> {
  const { data, error } = await supabase.rpc("registrar_ubicacion_recorrido", {
    p_recorrido_id: recorridoId,
    p_lat: ubicacion.latitude,
    p_lng: ubicacion.longitude,
    p_precision_m: opciones.precision ?? null,
    p_velocidad_mps: opciones.velocidad ?? null,
    p_heading: opciones.heading ?? null,
    p_captured_at: opciones.capturedAt ?? null,
    p_client_event_id: opciones.clientEventId ?? null,
  });

  if (error) {
    throw new Error(`No se pudo registrar la ubicación: ${error.message}`);
  }

  if (!data) {
    throw new Error("El servidor no devolvió el resultado de la ubicación.");
  }

  return data as ResultadoUbicacion;
}

export async function finalizarRecorrido(
  recorridoId: string,
): Promise<ResumenRecorrido> {
  const { data, error } = await supabase.rpc("finalizar_recorrido", {
    p_recorrido_id: recorridoId,
  });

  if (error) {
    throw new Error(`No se pudo finalizar el recorrido: ${error.message}`);
  }

  if (!data) {
    throw new Error("El servidor no devolvió el resumen del recorrido.");
  }

  return data as ResumenRecorrido;
}
