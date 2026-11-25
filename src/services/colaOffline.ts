import type { PosicionRecorrido } from "../lib/recorrido";
import * as Network from "expo-network";
import * as SQLite from "expo-sqlite";
import { AppState } from "react-native";

import {
  activarEmergenciaRecorrido,
  invocarEnviarAlerta,
  obtenerAlertaIdPorClientEventId,
  confirmarCheckin,
  terminarEmergenciaRecorrido,
  type TipoAlerta,
} from "./emergencias";
import { registrarUbicacionRecorrido } from "./recorridos";
import { hayConectividad } from "./red";
import { supabase } from "./supabase";

export type TipoEventoOffline =
  | "activar_emergencia"
  | "enviar_alerta_push"
  | "terminar_emergencia"
  | "responder_checkin"
  | "ubicacion";

export type ResultadoProcesamientoCola = {
  procesados: number;
  pendientes: number;
  error?: string;
};

type FilaCola = {
  id: number;
  client_event_id: string;
  prioridad: number;
  tipo: TipoEventoOffline;
  payload_json: string;
  creado_en: string;
  intentos: number;
};

const NOMBRE_DB = "lleguebien.db";
const MAX_EVENTOS_POR_VACIADO = 100;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let procesamientoActual: Promise<ResultadoProcesamientoCola> | null = null;
let limpiezaSincronizacion: (() => void) | null = null;

export function generarClientEventId(): string {
  const cryptoObj = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined;

  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (caracter) => {
      const aleatorio = (Math.random() * 16) | 0;
      const valor = caracter === "x" ? aleatorio : (aleatorio & 0x3) | 0x8;
      return valor.toString(16);
    },
  );
}

export async function obtenerDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(NOMBRE_DB)
      .then(async (db) => {
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          PRAGMA foreign_keys = ON;

          create table if not exists cola_sincronizacion (
            id integer primary key autoincrement,
            client_event_id text unique not null,
            prioridad integer not null,
            tipo text not null,
            payload_json text not null,
            creado_en text not null,
            intentos integer not null default 0
          );

          create index if not exists idx_cola_prioridad_id
            on cola_sincronizacion (prioridad asc, id asc);

          create table if not exists alertas_reconciliadas (
            evento_id text primary key, alerta_id text not null
          );

          create table if not exists intenciones_notificacion (
            clave text primary key, datos text not null, atendida integer not null default 0,
            creada_en integer not null
          );

          create table if not exists ultima_posicion_fondo (
            id integer primary key check (id=1), recorrido_id text not null,
            captured_at integer not null, posicion text not null
          );

          create table if not exists estado_recorrido_local (
            id integer primary key check (id = 1),
            recorrido_id text,
            actualizado_en text not null
          );

          create trigger if not exists borrar_posicion_fondo
          after delete on estado_recorrido_local
          begin
            delete from ultima_posicion_fondo where recorrido_id = old.recorrido_id;
          end;
        `);
        return db;
      })
      .catch((error) => {
        dbPromise = null;
        throw error;
      });
  }

  return dbPromise;
}

export async function encolarEventoOffline(
  tipo: TipoEventoOffline,
  prioridad: number,
  payload: Record<string, unknown>,
): Promise<{ id: number; clientEventId: string }> {
  // El id de idempotencia del evento (payload) puede compartirse entre un
  // evento de activación y su push; la fila de la cola necesita uno propio
  // porque su columna es UNIQUE.
  const clientEventId =
    typeof payload.clientEventId === "string" && payload.clientEventId
      ? payload.clientEventId
      : generarClientEventId();
  const idFila = generarClientEventId();

  try {
    const db = await obtenerDb();
    const payloadConId = { ...payload, clientEventId };
    const creadoEn = new Date().toISOString();

    const resultado = await db.runAsync(
      `insert into cola_sincronizacion
        (client_event_id, prioridad, tipo, payload_json, creado_en)
       values (?, ?, ?, ?, ?)`,
      idFila,
      prioridad,
      tipo,
      JSON.stringify(payloadConId),
      creadoEn,
    );

    void procesarColaOffline();

    return {
      id: Number(resultado.lastInsertRowId),
      clientEventId,
    };
  } catch (error) {
    // Plataformas sin SQLite (por ejemplo web) no deben romper la pantalla.
    console.warn("[cola-offline] No se pudo encolar el evento", error);
    return { id: 0, clientEventId };
  }
}

export async function encolarActivacionConAviso(payload: Record<string, unknown> & { clientEventId: string }) {
  const db = await obtenerDb();
  // Un solo INSERT constituye una transacción. Los identificadores por tipo permiten reintentos.
  await db.runAsync(
    `insert or ignore into cola_sincronizacion (client_event_id,prioridad,tipo,payload_json,creado_en)
     values (?,1,'activar_emergencia',?,?), (?,1,'enviar_alerta_push',?,?)`,
    "activar:" + payload.clientEventId, JSON.stringify(payload), new Date().toISOString(),
    "push:" + payload.clientEventId, JSON.stringify(payload), new Date().toISOString(),
  );
  void procesarColaOffline();
}

export async function contarPendientesOffline(): Promise<number> {
  try {
    const db = await obtenerDb();
    const fila = await db.getFirstAsync<{ total: number }>(
      "select count(*) as total from cola_sincronizacion",
    );

    return Number(fila?.total ?? 0);
  } catch {
    return 0;
  }
}

export async function guardarRecorridoActivoLocal(
  recorridoId: string | null,
): Promise<void> {
  try {
    const db = await obtenerDb();

    if (!recorridoId) {
      await db.runAsync("delete from estado_recorrido_local where id = 1");
      return;
    }

    await db.runAsync(
      `insert into estado_recorrido_local (id, recorrido_id, actualizado_en)
       values (1, ?, ?)
       on conflict(id) do update set
         recorrido_id = excluded.recorrido_id,
         actualizado_en = excluded.actualizado_en`,
      recorridoId,
      new Date().toISOString(),
    );
  } catch (error) {
    console.warn("[cola-offline] No se pudo guardar el recorrido local", error);
  }
}

export async function obtenerRecorridoActivoLocal(): Promise<string | null> {
  try {
    const db = await obtenerDb();
    const fila = await db.getFirstAsync<{ recorrido_id: string | null }>(
      "select recorrido_id from estado_recorrido_local where id = 1 limit 1",
    );

    return fila?.recorrido_id ?? null;
  } catch {
    return null;
  }
}

export async function guardarPosicionFondo(id: string, punto: PosicionRecorrido) {
  const db = await obtenerDb();
  await db.runAsync(
    `insert into ultima_posicion_fondo select 1,?,?,?
     where exists(select 1 from estado_recorrido_local where recorrido_id=?)
     on conflict(id) do update set recorrido_id=excluded.recorrido_id,
       captured_at=excluded.captured_at,posicion=excluded.posicion
     where recorrido_id<>excluded.recorrido_id or captured_at<excluded.captured_at`,
    id, punto.capturedAt, JSON.stringify(punto), id,
  );
}

export async function leerPosicionFondo(id: string): Promise<PosicionRecorrido | null> {
  const db = await obtenerDb();
  const fila = await db.getFirstAsync<{ posicion: string }>(
    "select posicion from ultima_posicion_fondo where recorrido_id=?", id);
  return fila ? JSON.parse(fila.posicion) : null;
}

export async function limpiarRecorridoActivoLocal(): Promise<void> {
  await guardarRecorridoActivoLocal(null);
}

/** Se usa al cerrar sesión: los eventos pendientes pertenecen al usuario saliente. */
export async function limpiarColaOffline(): Promise<void> {
  try {
    const db = await obtenerDb();
    await db.runAsync("delete from cola_sincronizacion");
  } catch (error) {
    console.warn("[cola-offline] No se pudo limpiar la cola", error);
  }
}

/**
 * Al finalizar un recorrido, los puntos que sigan en la cola ya no pueden
 * insertarse (la RPC los rechaza). Se descartan para no gastar reintentos.
 */
export async function descartarUbicacionesPendientes(
  recorridoId: string,
): Promise<void> {
  try {
    const db = await obtenerDb();

    await db.runAsync(
      `delete from cola_sincronizacion
       where tipo = 'ubicacion' and payload_json like ?`,
      `%"recorridoId":"${recorridoId}"%`,
    );
  } catch (error) {
    console.warn(
      "[cola-offline] No se pudieron descartar ubicaciones pendientes",
      error,
    );
  }
}

async function resolverAlertaOffline(evento: string) {
  const db = await obtenerDb();
  const fila = await db.getFirstAsync<{ alerta_id: string }>(
    "select alerta_id from alertas_reconciliadas where evento_id=?", evento);
  return fila?.alerta_id ?? await obtenerAlertaIdPorClientEventId(evento);
}

async function ejecutarEvento(
  tipo: TipoEventoOffline,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (tipo) {
    case "ubicacion": {
      const recorridoId = String(payload.recorridoId ?? "");

      if (!recorridoId) throw new Error("Evento de ubicación sin recorridoId.");

      await registrarUbicacionRecorrido(
        recorridoId,
        {
          latitude: Number(payload.lat),
          longitude: Number(payload.lng),
        },
        {
          precision:
            payload.precision === null || payload.precision === undefined
              ? null
              : Number(payload.precision),
          velocidad:
            payload.velocidad === null || payload.velocidad === undefined
              ? null
              : Number(payload.velocidad),
          heading:
            payload.heading === null || payload.heading === undefined
              ? null
              : Number(payload.heading),
          capturedAt:
            typeof payload.capturedAt === "string"
              ? payload.capturedAt
              : null,
          clientEventId:
            typeof payload.clientEventId === "string"
              ? payload.clientEventId
              : null,
        },
      );
      return;
    }

    case "activar_emergencia": {
      const recorridoId = String(payload.recorridoId ?? "");

      if (!recorridoId) {
        throw new Error("Evento de emergencia sin recorridoId.");
      }

      const alerta = await activarEmergenciaRecorrido({
        recorridoId,
        tipo: (payload.tipo as TipoAlerta) ?? "manual",
        modo: (payload.modo as "sonoro" | "silencioso") ?? "sonoro",
        lat:
          payload.lat === null || payload.lat === undefined
            ? null
            : Number(payload.lat),
        lng:
          payload.lng === null || payload.lng === undefined
            ? null
            : Number(payload.lng),
        clientEventId:
          typeof payload.clientEventId === "string"
            ? payload.clientEventId
            : null,
      });
      if (typeof payload.clientEventId === "string" && alerta.client_event_id !== payload.clientEventId) {
        const db = await obtenerDb();
        await db.runAsync("insert or replace into alertas_reconciliadas values(?,?)", payload.clientEventId, alerta.id);
      }
      return;
    }

    case "terminar_emergencia": {
      const recorridoId = String(payload.recorridoId ?? "");
      const clientEventId =
        typeof payload.clientEventId === "string"
          ? payload.clientEventId
          : null;

      const alertaId =
        (clientEventId
          ? await resolverAlertaOffline(clientEventId)
          : null) ?? (typeof payload.alertaId === "string" ? payload.alertaId : null);

      if (!recorridoId || !alertaId) {
        throw new Error("Evento de término de emergencia incompleto.");
      }

      await terminarEmergenciaRecorrido(alertaId, recorridoId);
      return;
    }

    case "enviar_alerta_push": {
      const recorridoId = String(payload.recorridoId ?? "");
      const clientEventId =
        typeof payload.clientEventId === "string"
          ? payload.clientEventId
          : null;

      const alertaId =
        (clientEventId
          ? await resolverAlertaOffline(clientEventId)
          : null) ?? (typeof payload.alertaId === "string" ? payload.alertaId : null);

      if (!recorridoId || !alertaId) {
        throw new Error("Evento de push sin alerta resuelta.");
      }

      await invocarEnviarAlerta(alertaId, recorridoId);
      return;
    }

    case "responder_checkin": {
      const recorridoId = String(payload.recorridoId ?? "");

      if (!recorridoId) {
        throw new Error("Evento de check-in sin recorridoId.");
      }

      // Las respuestas heredadas sin UUID jamás se aplican a una pregunta posterior.
      if (typeof payload.checkinId === "string") {
        await confirmarCheckin(payload.checkinId, recorridoId, String(payload.clientEventId));
      }

      return;
    }

    default:
      throw new Error(`Tipo de evento offline desconocido: ${tipo}`);
  }
}

async function vaciarCola(): Promise<ResultadoProcesamientoCola> {
  const db = await obtenerDb();
  const pendientesIniciales = await contarPendientesOffline();

  if (pendientesIniciales === 0) {
    return { procesados: 0, pendientes: 0 };
  }

  // Sin sesión restaurada, auth.uid() es null y las RPC fallarían. Se espera
  // al evento de autenticación para no gastar intentos de la cola.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { procesados: 0, pendientes: pendientesIniciales };
  }

  const conectado = await hayConectividad();
  if (!conectado) {
    return { procesados: 0, pendientes: pendientesIniciales };
  }

  let procesados = 0;

  for (let i = 0; i < MAX_EVENTOS_POR_VACIADO; i += 1) {
    const fila = await db.getFirstAsync<FilaCola>(
      `select *
       from cola_sincronizacion
       order by prioridad asc, id asc
       limit 1`,
    );

    if (!fila) break;

    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(fila.payload_json) as Record<string, unknown>;
    } catch {
      // Payload corrupto: no hay forma de recuperarlo, se descarta para no
      // bloquear el resto de la cola.
      await db.runAsync(
        "delete from cola_sincronizacion where id = ?",
        fila.id,
      );
      console.warn("[cola-offline] Evento descartado por payload inválido", fila.id);
      continue;
    }

    try {
      await ejecutarEvento(fila.tipo, payload);
      await db.runAsync(
        "delete from cola_sincronizacion where id = ?",
        fila.id,
      );
      procesados += 1;
    } catch (error) {
      const intentos = fila.intentos + 1;
      const maxIntentos = fila.prioridad === 1 ? 20 : 5;

      // Un evento que siempre falla (recorrido cerrado, alerta borrada) no
      // debe bloquear la cola indefinidamente: se descarta tras N intentos.
      if (intentos >= maxIntentos) {
        await db.runAsync(
          "delete from cola_sincronizacion where id = ?",
          fila.id,
        );
        console.warn(
          `[cola-offline] Evento ${fila.tipo} descartado tras ${intentos} intentos`,
        );
        continue;
      }

      await db.runAsync(
        "update cola_sincronizacion set intentos = ? where id = ?",
        intentos,
        fila.id,
      );

      console.warn(
        `[cola-offline] Falló ${fila.tipo} (intento ${intentos}/${maxIntentos}):`,
        error instanceof Error ? error.message : error,
      );

      return {
        procesados,
        pendientes: await contarPendientesOffline(),
        error:
          error instanceof Error
            ? error.message
            : "No se pudo procesar la cola offline.",
      };
    }
  }

  return {
    procesados,
    pendientes: await contarPendientesOffline(),
  };
}

export function procesarColaOffline(): Promise<ResultadoProcesamientoCola> {
  if (procesamientoActual) return procesamientoActual;

  procesamientoActual = vaciarCola()
    .catch((error) => ({
      procesados: 0,
      pendientes: 0,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo procesar la cola offline.",
    }))
    .finally(() => {
      procesamientoActual = null;
    });

  return procesamientoActual;
}

export function iniciarSincronizacionAutomatica(): () => void {
  if (limpiezaSincronizacion) return limpiezaSincronizacion;

  void procesarColaOffline();

  const suscripcionRed = Network.addNetworkStateListener((estado) => {
    if (estado.isConnected && estado.isInternetReachable !== false) {
      void procesarColaOffline();
    }
  });

  const suscripcionApp = AppState.addEventListener("change", (estado) => {
    if (estado === "active") {
      void procesarColaOffline();
    }
  });

  const intervalo = setInterval(() => {
    void contarPendientesOffline()
      .then((pendientes) => {
        if (pendientes > 0) void procesarColaOffline();
      })
      .catch(() => undefined);
  }, 10000);

  limpiezaSincronizacion = () => {
    suscripcionRed.remove();
    suscripcionApp.remove();
    clearInterval(intervalo);
    limpiezaSincronizacion = null;
  };

  return limpiezaSincronizacion;
}


export async function confirmarCheckinConCola(checkinId: string, recorridoId: string) {
  const clientEventId = generarClientEventId();
  try {
    await confirmarCheckin(checkinId, recorridoId, clientEventId);
  } catch {
    const fila = await encolarEventoOffline("responder_checkin", 1, { checkinId, recorridoId, clientEventId });
    if (!fila.id) throw new Error("No se pudo guardar la confirmación.");
  }
}
