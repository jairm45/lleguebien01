import type { Feature, LineString } from "geojson";

import type { Coordenada } from "../lib/recorrido";
import { supabase } from "./supabase";

export type EstadoRecorrido =
  | "activo"
  | "finalizado"
  | "cancelado"
  | "emergencia";

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
};

type OpcionesUbicacion = {
  precision?: number | null;
  velocidad?: number | null;
  heading?: number | null;
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

export async function obtenerRecorridoActivo(): Promise<RecorridoActivo | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("recorridos")
    .select(
      "id, id_usuario, estado, destino_nombre, origen_lat, origen_lng, destino_lat, destino_lng, ruta_geojson, distancia_metros, duracion_segundos, iniciado_en",
    )
    .eq("id_usuario", user.id)
    .eq("estado", "activo")
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo consultar el recorrido activo: ${error.message}`);
  }

  return (data as RecorridoActivo | null) ?? null;
}

export async function crearRecorrido({
  origen,
  destino,
  destinoNombre,
  ruta = null,
}: CrearRecorridoInput): Promise<string> {
  // Evita recorridos duplicados si la app se reabre o se pierde la navegación.
  const activo = await obtenerRecorridoActivo();
  if (activo) return activo.id;

  const idUsuario = await obtenerUsuarioId();

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
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`No se pudo crear el recorrido: ${error.message}`);
  }

  return (data as { id: string }).id;
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
