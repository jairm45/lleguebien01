import type { MotivoCheckin } from "./recorridos";
import { supabase } from "./supabase";

export type TipoAlerta =
  | "manual"
  | "sacudida"
  | "notificacion_rapida"
  | "pasiva";

export type ModoAlerta = "sonoro" | "silencioso";

export type Alerta = {
  id: string;
  id_recorrido: string;
  id_usuario: string;
  tipo: TipoAlerta;
  estado: "activa" | "cancelada" | "terminada";
  modo: ModoAlerta;
  lat: number | null;
  lng: number | null;
  notificados: number;
  fallidos: number;
  notificacion_enviada_en: string | null;
  iniciada_en: string;
  terminada_en: string | null;
  client_event_id: string | null;
};

export type ResultadoPush = {
  notificados: number;
  fallidos: number;
  mensaje?: string;
};

export type RespuestaCheckin = "estoy_bien" | "necesito_ayuda";

export type CheckinAbierto = {
  checkin_id: string;
  recorrido_id: string;
  creada_en: string;
  presentada_en: string | null;
  motivo: MotivoCheckin;
};

function normalizarAlerta(data: unknown): Alerta | null {
  const fila = Array.isArray(data) ? data[0] : data;

  if (!fila) return null;

  return fila as Alerta;
}

export async function activarEmergenciaRecorrido(input: {
  recorridoId: string;
  tipo: TipoAlerta;
  modo: ModoAlerta;
  lat?: number | null;
  lng?: number | null;
  clientEventId?: string | null;
}): Promise<Alerta> {
  const { data, error } = await supabase.rpc("activar_emergencia_recorrido", {
    p_recorrido_id: input.recorridoId,
    p_tipo: input.tipo,
    p_modo: input.modo,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
    p_client_event_id: input.clientEventId ?? null,
  });

  if (error) {
    throw new Error(`No se pudo activar la emergencia: ${error.message}`);
  }

  const alerta = normalizarAlerta(data);

  if (!alerta) {
    throw new Error("El servidor no devolvió la alerta creada.");
  }

  return alerta;
}

export async function terminarEmergenciaRecorrido(
  alertaId: string,
  recorridoId: string,
): Promise<{ recorrido_estado: string | null }> {
  const { data, error } = await supabase.rpc(
    "terminar_emergencia_recorrido",
    {
      p_alerta_id: alertaId,
      p_recorrido_id: recorridoId,
    },
  );

  if (error) {
    throw new Error(`No se pudo terminar la emergencia: ${error.message}`);
  }

  return (data as { recorrido_estado: string | null }) ?? {
    recorrido_estado: null,
  };
}

export async function obtenerAlertaActiva(
  recorridoId: string,
): Promise<Alerta | null> {
  const { data, error } = await supabase
    .from("alertas")
    .select("*")
    .eq("id_recorrido", recorridoId)
    .eq("estado", "activa")
    .order("iniciada_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo consultar la alerta activa: ${error.message}`);
  }

  return (data as Alerta | null) ?? null;
}

export async function obtenerAlertaIdPorClientEventId(
  clientEventId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("alertas")
    .select("id")
    .eq("client_event_id", clientEventId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo resolver la alerta offline: ${error.message}`);
  }

  return (data as { id: string } | null)?.id ?? null;
}

export async function invocarEnviarAlerta(
  alertaId: string,
  recorridoId: string,
): Promise<ResultadoPush> {
  const { data, error } = await supabase.functions.invoke("enviar-alerta", {
    body: {
      alerta_id: alertaId,
      recorrido_id: recorridoId,
    },
  });

  if (error) {
    throw new Error(`No se pudieron enviar las notificaciones: ${error.message}`);
  }

  return (data as ResultadoPush) ?? { notificados: 0, fallidos: 0 };
}

export async function obtenerCheckinAbierto(recorridoId: string) {
  const { data, error } = await supabase.from("checkins_pasivos")
    .select("checkin_id, recorrido_id, creada_en, presentada_en, motivo")
    .eq("recorrido_id", recorridoId).in("estado", ["pendiente_entrega", "presentada"])
    .maybeSingle<CheckinAbierto>();
  if (error) throw error;
  return data;
}

export async function marcarCheckinPresentado(checkinId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("marcar_checkin_presentado", { p_checkin_id: checkinId });
  if (error) throw error;
  return data;
}

export async function confirmarCheckin(checkinId: string, recorridoId: string, eventoId: string) {
  const { error } = await supabase.rpc("responder_checkin_pasivo", {
    p_checkin_id: checkinId, p_recorrido_id: recorridoId, p_client_event_id: eventoId,
  });
  if (error) throw error;
}
