import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { correoValido, enviarCorreo, escaparHtml } from "../_shared/correoSmtp.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respuesta(datos: unknown, status: number) {
  return Response.json(datos, { status, headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return respuesta({ error: "Método no permitido." }, 405);

  const autorizacion = req.headers.get("Authorization") ?? "";
  if (!autorizacion.startsWith("Bearer ")) return respuesta({ error: "Inicia sesión." }, 401);
  try {
    const cliente = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: autorizacion } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: sesion } = await cliente.auth.getUser(autorizacion.slice(7));
    if (sesion || !user) return respuesta({ error: "Sesión inválida." }, 401);

    const cuerpo = await req.json().catch(() => null);
    if (typeof cuerpo?.vinculo_id !== "string") return respuesta({ error: "Falta el vínculo." }, 400);
    const { data: fila, error } = await cliente.from("seguidores")
      .select("email,codigo_invitacion,codigo_expira_en").eq("id", cuerpo.vinculo_id)
      .eq("id_estudiante", user.id).eq("estado", "pendiente")
      .gt("codigo_expira_en", new Date().toISOString()).maybeSingle();
    if (error) throw error;
    if (!fila) return respuesta({ error: "La invitación ya no está disponible." }, 404);
    if (!correoValido(fila.email) || !/^[A-Z0-9]{6}$/.test(fila.codigo_invitacion ?? "")) {
      return respuesta({ error: "La invitación requiere un correo y un código válidos." }, 422);
    }
    const { data: perfil, error: lectura } = await cliente.from("perfiles")
      .select("nombre_completo").eq("id", user.id).eq("rol", "estudiante").maybeSingle();
    if (lectura) throw lectura;
    if (!perfil) return respuesta({ error: "Se requiere una cuenta de estudiante." }, 403);

    const nombre = perfil.nombre_completo || "Un estudiante";
    const codigo = fila.codigo_invitacion;
    const enlace = `lleguebien01://seguir?codigo=${codigo}`;
    const vence = new Date(fila.codigo_expira_en).toLocaleString("es-CO", { timeZone: "America/Bogota" });
    const vigencia = `El código dura 24 horas desde su creación. Vence el ${vence} (hora de Colombia).`;
    await enviarCorreo(fila.email, "Invitación para acompañar un recorrido en LleguéBien",
      `${nombre} te invita a seguir sus recorridos. Código: ${codigo}. ${vigencia} ${enlace}`,
      `<div style="color:#1A1E3C;font-family:sans-serif;border-top:5px solid #1ABC9C;padding:20px">
      <h2>Invitación a LleguéBien</h2><p>${escaparHtml(nombre)} te invita a acompañar sus recorridos.</p>
      <p>Tu código es <strong>${codigo}</strong>.</p><p>${vigencia}</p>
      <a href="${enlace}">Abrir invitación en LleguéBien</a></div>`);
    return respuesta({ enviado: true }, 200);
  } catch {
    return respuesta({ error: "No se pudo enviar el correo. Puedes compartir el código o reintentar." }, 502);
  }
});
