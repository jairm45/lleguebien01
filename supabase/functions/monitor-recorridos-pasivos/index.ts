import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function autorizado(
  request: Request,
  serviceKey: string,
  cronSecret: string | null,
): boolean {
  const authorization = request.headers.get("Authorization") ?? "";

  // pg_net puede enviar el service_role; el cron usa el secreto compartido.
  if (authorization === `Bearer ${serviceKey}`) return true;

  const secreto = request.headers.get("x-cron-secret") ?? "";
  return Boolean(cronSecret) && secreto === cronSecret;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET") ?? null;

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Faltan variables de entorno" }, 500);
  }

  if (!autorizado(request, serviceKey, cronSecret)) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // PostgreSQL conserva la alerta y el envío pendiente en la misma transacción.
  const { error: evaluacion } = await admin.rpc("evaluar_checkins_pasivos");
  if (evaluacion) return jsonResponse({ error: evaluacion.message }, 500);
  const { data: lote, error } = await admin.rpc("reservar_envios_checkin");
  if (error) return jsonResponse({ error: error.message }, 500);

  let fallidos = 0;
  await Promise.all((lote ?? []).map(async (pregunta: {
    checkin_id: string; recorrido_id: string; motivo: string; creada_en: string;
    alerta_id: string | null; intento_id: string;
  }) => {
    let fallo: string | null = null;
    try {
      if (pregunta.alerta_id) {
        const respuesta = await fetch(supabaseUrl + "/functions/v1/enviar-alerta", {
          method: "POST",
          headers: { Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            alerta_id: pregunta.alerta_id, recorrido_id: pregunta.recorrido_id, motivo: pregunta.motivo,
          }),
        });
        if (!respuesta.ok) throw new Error("enviar-alerta HTTP " + respuesta.status);
      } else {
        const { data: recorrido, error: lectura } = await admin.from("recorridos")
          .select("id_usuario").eq("id", pregunta.recorrido_id).single();
        if (lectura) throw lectura;
        const { data: dispositivos, error: consulta } = await admin.from("dispositivos_push")
          .select("expo_push_token").eq("id_usuario", recorrido.id_usuario);
        if (consulta) throw consulta;
        if (!dispositivos?.length) throw new Error("Sin dispositivo registrado");

        const mensajes = dispositivos.map(({ expo_push_token }) => ({
          to: expo_push_token, title: "¿Estás bien?", sound: "default",
          body: "Tienes 60 segundos para responder desde que se presenta la pregunta.",
          channelId: "emergencias", categoryId: "CHECKIN_SEGURIDAD", priority: "high",
          _contentAvailable: true,
          expiration: Math.ceil(Date.parse(pregunta.creada_en) / 1000) + 90,
          data: { checkin: true, checkin_id: pregunta.checkin_id, recorrido_id: pregunta.recorrido_id,
            motivo: pregunta.motivo, creada_en: pregunta.creada_en },
        }));
        for (let inicio = 0; inicio < mensajes.length; inicio += 100) {
          const respuesta = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mensajes.slice(inicio, inicio + 100)),
          });
          if (!respuesta.ok) throw new Error("Expo HTTP " + respuesta.status);
          const tickets = (await respuesta.json()).data;
          if (!Array.isArray(tickets) || !tickets.some(t => t.status === "ok")) {
            throw new Error("Expo rechazó la pregunta");
          }
        }
      }
    } catch (error) {
      fallo = error instanceof Error ? error.message : "Falló el envío";
      fallidos++;
    }
    const { error: registro } = await admin.from("checkins_pasivos").update({
      ultimo_error: fallo, intento_id: null,
      proximo_envio: fallo ? new Date(Date.now() + 10000).toISOString() : null,
    }).eq("checkin_id", pregunta.checkin_id).eq("intento_id", pregunta.intento_id);
    if (registro) { console.error(registro.message); fallidos++; }
  }));
  return jsonResponse({ reservados: lote?.length ?? 0, fallidos }, fallidos ? 503 : 200);
});
