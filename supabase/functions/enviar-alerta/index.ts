import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { CorreoSinEnviar, enviarCorreo, escaparHtml } from "../_shared/correoSmtp.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Alerta = {
  id: string;
  id_usuario: string;
  id_recorrido: string;
  tipo: string;
  modo: string;
  lat: number | null;
  lng: number | null;
  estado: string;
};

type Seguidor = {
  id_seguidor: string | null;
  nombre: string | null;
  email: string | null;
};

type Dispositivo = {
  id_usuario: string;
  expo_push_token: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function enviarCorreosEmergencia(
  admin: ReturnType<typeof crearClienteAdmin>, seguidores: Seguidor[], alerta: Alerta,
  nombreEstudiante: string, motivo: string | null,
) {
  if (!["manual", "sacudida", "notificacion_rapida", "pasiva"].includes(alerta.tipo)) return;
  const ubicacion = alerta.lat != null && alerta.lng != null
    ? `https://www.google.com/maps?q=${alerta.lat},${alerta.lng}` : "Ubicación pendiente de GPS";
  const descripcion = alerta.tipo === "pasiva" ? "Se escaló una alerta de seguridad" : "Se activó una alerta SOS";
  const mensaje = `${descripcion} de ${nombreEstudiante}. Modo: ${alerta.modo}.`;
  const detalle = motivo ? `Motivo: ${motivo}.` : "";
  const resultados = await Promise.allSettled(seguidores.filter(s => s.email && s.id_seguidor).map(async s => {
    const { data: correo, error: reserva } = await admin.rpc("reservar_correo_alerta", {
      p_alerta_id: alerta.id, p_seguidor: s.id_seguidor,
    });
    if (reserva) throw reserva;
    if (!correo) return;
    let estado = "enviado";
    try {
      await enviarCorreo(correo, "Emergencia en LleguéBien", [mensaje, detalle, ubicacion].join(" "),
        `<h2>Alerta de emergencia</h2><p>${escaparHtml(mensaje)}</p><p>${escaparHtml(detalle)}</p><p>${ubicacion}</p>`);
    } catch (error) {
      // Tras un corte durante DATA, Gmail pudo aceptar el correo aunque no llegase la respuesta.
      const fallo = error as { responseCode?: number; code?: string };
      estado = error instanceof CorreoSinEnviar || (fallo.responseCode ?? 0) >= 400 ||
          fallo.code === "EDNS" || fallo.code === "EAUTH" || fallo.code === "ECONNREFUSED"
        ? "reintentar" : "incierto";
    }
    const { error } = await admin.from("envios_alerta_correo").update({ estado })
      .eq("alerta_id", alerta.id).eq("id_seguidor", s.id_seguidor!);
    if (error || estado !== "enviado") throw new Error("Entrega de correo sin confirmar.");
  }));
  if (resultados.some(r => r.status === "rejected")) throw new Error("Falló el envío de correo.");
}

function crearClienteAdmin(url: string, clave: string) {
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function enviarPush(
  mensajes: Array<Record<string, unknown> & { to: string }>,
): Promise<string[]> {
  const aceptados: string[] = [];

  for (let i = 0; i < mensajes.length; i += 100) {
    const lote = mensajes.slice(i, i + 100);

    try {
      const respuesta = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(lote),
      });

      if (!respuesta.ok) {
        console.error("Expo push HTTP", respuesta.status, await respuesta.text());
        continue;
      }

      const payload = (await respuesta.json()) as {
        data?: Array<{ status?: string }>;
      };
      const tickets = payload.data ?? [];

      tickets.forEach((ticket, indice) => {
        if (ticket.status === "ok" && lote[indice]) aceptados.push(lote[indice].to);
      });
    } catch (error) {
      console.error("Error enviando push", error);
    }
  }

  return aceptados;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  try {
    const authHeader = request.headers.get("Authorization") ?? "";

    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "No autenticado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ error: "Faltan variables de entorno" }, 500);
    }

    const body = (await request.json()) as {
      alerta_id?: string;
      recorrido_id?: string;
      motivo?: string;
    };

    if (!body.alerta_id) {
      return jsonResponse({ error: "Falta alerta_id" }, 400);
    }

    const token = authHeader.replace("Bearer ", "");
    const admin = crearClienteAdmin(supabaseUrl, serviceKey);

    let alerta: Alerta | null = null;

    if (token === serviceKey) {
      // Invocación interna del monitor pasivo. El service_role no debe poder
      // cruzar usuarios: la alerta se valida contra el dueño de su recorrido.
      const { data, error } = await admin
        .from("alertas")
        .select("id, id_usuario, id_recorrido, tipo, modo, lat, lng, estado")
        .eq("id", body.alerta_id)
        .maybeSingle<Alerta>();

      if (error) {
        return jsonResponse({ error: error.message }, 400);
      }

      alerta = data ?? null;

      if (alerta) {
        const { data: recorrido } = await admin
          .from("recorridos")
          .select("id_usuario")
          .eq("id", alerta.id_recorrido)
          .maybeSingle<{ id_usuario: string }>();

        if (!recorrido || recorrido.id_usuario !== alerta.id_usuario) {
          return jsonResponse({ error: "Alerta inconsistente" }, 400);
        }
      }
    } else {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const {
        data: { user },
        error: authError,
      } = await userClient.auth.getUser(token);

      if (authError || !user) {
        return jsonResponse({ error: "Sesión inválida" }, 401);
      }

      const { data, error } = await userClient
        .from("alertas")
        .select("id, id_usuario, id_recorrido, tipo, modo, lat, lng, estado")
        .eq("id", body.alerta_id)
        .maybeSingle<Alerta>();

      if (error) {
        return jsonResponse({ error: error.message }, 400);
      }

      alerta = data ?? null;

      if (!alerta || alerta.id_usuario !== user.id) {
        return jsonResponse({ error: "Alerta no encontrada" }, 404);
      }
    }

    if (!alerta) {
      return jsonResponse({ error: "Alerta no encontrada" }, 404);
    }

    if (body.recorrido_id && body.recorrido_id !== alerta.id_recorrido) {
      return jsonResponse({ error: "La alerta no pertenece al recorrido" }, 400);
    }

    // Una alerta ya cerrada no debe disparar notificaciones tardías
    // (por ejemplo, si el recorrido se finalizó mientras estaba en cola).
    if (alerta.estado !== "activa") {
      return jsonResponse({
        notificados: 0,
        fallidos: 0,
        mensaje: "La alerta ya no está activa",
      });
    }

    const { data: perfil } = await admin
      .from("perfiles")
      .select("nombre_completo")
      .eq("id", alerta.id_usuario)
      .maybeSingle<{ nombre_completo: string | null }>();

    const nombreEstudiante = perfil?.nombre_completo ?? "Un estudiante";

    const { data: seguidores, error: seguidoresError } = await admin
      .from("seguidores")
      .select("id_seguidor, nombre, email")
      .eq("id_estudiante", alerta.id_usuario)
      .eq("estado", "activo")
      .not("id_seguidor", "is", null);

    if (seguidoresError) {
      return jsonResponse({ error: seguidoresError.message }, 500);
    }

    const listaSeguidores = (seguidores ?? []) as Seguidor[];
    const idsSeguidores = [
      ...new Set(
        listaSeguidores
          .map((seguidor) => seguidor.id_seguidor)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (idsSeguidores.length === 0) {
      await admin
        .from("alertas")
        .update({
          notificados: 0,
          fallidos: 0,
          notificacion_enviada_en: new Date().toISOString(),
        })
        .eq("id", alerta.id);

      return jsonResponse({
        notificados: 0,
        fallidos: 0,
        mensaje: "Sin seguidores activos",
      });
    }

    const motivo = typeof body.motivo === "string" ? body.motivo : null;
    const [push, correo] = await Promise.allSettled([
      notificarDispositivos(admin, idsSeguidores, alerta, nombreEstudiante, motivo),
      enviarCorreosEmergencia(admin, listaSeguidores, alerta, nombreEstudiante, motivo),
    ]);
    if (push.status === "rejected") throw push.reason;
    if (correo.status === "rejected" && push.value.ok) {
      // El monitor reintentará. En la app los contadores siguen describiendo los tickets de Expo.
      return jsonResponse({ ...(await push.value.json()), error_correo: "Correo sin confirmar" },
        token === serviceKey ? 503 : push.value.status);
    }
    return push.value;
  } catch (error) {
    console.error("enviar-alerta error", error);
    return jsonResponse({ error: "Error interno enviando alerta" }, 500);
  }
});


async function notificarDispositivos(
  admin: ReturnType<typeof crearClienteAdmin>, idsSeguidores: string[], alerta: Alerta,
  nombreEstudiante: string, motivo: string | null,
) {
  const { data: dispositivos, error: dispositivosError } = await admin
    .from("dispositivos_push")
    .select("id_usuario, expo_push_token")
    .in("id_usuario", idsSeguidores);

  if (dispositivosError) {
    return jsonResponse({ error: dispositivosError.message }, 500);
  }

  const tokens = [
    ...new Set(
      ((dispositivos ?? []) as Dispositivo[]).map(
        (dispositivo) => dispositivo.expo_push_token,
      ),
    ),
  ];

  if (tokens.length === 0) {
    await admin
      .from("alertas")
      .update({
        notificados: 0,
        fallidos: 0,
        notificacion_enviada_en: null,
      })
      .eq("id", alerta.id);

    return jsonResponse({
      notificados: 0,
      fallidos: 0,
      mensaje: "Seguidores activos sin token push",
    }, 503);
  }

  const url = `lleguebien01://seguidor/emergencia?alertaId=${alerta.id}&recorridoId=${alerta.id_recorrido}`;
  const cuerpo =
    alerta.tipo === "pasiva"
      ? "Su recorrido se detuvo sin respuesta al check-in de seguridad. Abre para ver la ubicación en vivo."
      : alerta.modo === "silencioso"
        ? "Activó una alerta discreta. Abre para ver la ubicación en vivo."
        : "Activó una alerta SOS. Abre para ver la ubicación en vivo.";

  const intento = crypto.randomUUID();
  const { data: reservados, error: reserva } = await admin.rpc("reservar_destinos_alerta", {
    p_alerta_id: alerta.id, p_tokens: tokens, p_intento: intento,
  });
  if (reserva) throw reserva;
  const destinos = (reservados ?? []) as string[];
  const mensajes = destinos.map((token) => ({
    to: token,
    title: `Emergencia de ${nombreEstudiante}`,
    body: cuerpo,
    sound: "default",
    priority: "high",
    channelId: "emergencias",
    data: {
      url,
      alerta_id: alerta.id,
      recorrido_id: alerta.id_recorrido,
      tipo: alerta.tipo,
      modo: alerta.modo,
      motivo,
      lat: alerta.lat,
      lng: alerta.lng,
    },
  }));

  const aceptados = await enviarPush(mensajes);
  if (aceptados.length) {
    const { error } = await admin.from("envios_alerta_push").update({ aceptado: true, reservado_hasta: null })
      .eq("alerta_id", alerta.id).eq("intento_id", intento).in("token", aceptados);
    if (error) throw error;
  }
  const { error: liberar } = await admin.from("envios_alerta_push").update({ reservado_hasta: null })
    .eq("alerta_id", alerta.id).eq("intento_id", intento).eq("aceptado", false);
  if (liberar) throw liberar;
  const { count, error: conteo } = await admin.from("envios_alerta_push").select("token", { count: "exact", head: true })
    .eq("alerta_id", alerta.id).eq("aceptado", true).in("token", tokens);
  if (conteo) throw conteo;
  const push = { notificados: count ?? 0, fallidos: tokens.length - (count ?? 0) };

  await admin
    .from("alertas")
    .update({
      notificados: push.notificados,
      fallidos: push.fallidos,
      notificacion_enviada_en: push.fallidos ? null : new Date().toISOString(),
    })
    .eq("id", alerta.id);

  return jsonResponse(push, push.fallidos ? 503 : 200);
}
