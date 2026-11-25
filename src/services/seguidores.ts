import { supabase } from "./supabase";

export type EstadoSeguidor = "pendiente" | "activo" | "rechazado";

export type Seguidor = {
  id: string;
  id_seguidor: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  estado: EstadoSeguidor;
};

export async function obtenerSeguidoresActivos(): Promise<Seguidor[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("seguidores")
    .select("id, id_seguidor, nombre, email, telefono, estado")
    .eq("id_estudiante", user.id)
    .eq("estado", "activo")
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(`No se pudieron cargar los seguidores: ${error.message}`);
  }

  return (data ?? []) as Seguidor[];
}

export type Vinculo = Seguidor & {
  id_estudiante: string;
  codigo_invitacion: string | null;
  codigo_expira_en: string | null;
};

export async function obtenerVinculosEstudiante(idEstudiante: string): Promise<Vinculo[]> {
  const { data, error } = await supabase.from("seguidores")
    .select("id,id_estudiante,id_seguidor,nombre,email,telefono,estado,codigo_invitacion,codigo_expira_en")
    .eq("id_estudiante", idEstudiante).in("estado", ["activo", "pendiente"])
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar tus seguidores.");
  return data as Vinculo[];
}

export async function crearInvitacion(nombre: string, email: string, telefono: string): Promise<Vinculo> {
  const { data, error } = await supabase.rpc("crear_invitacion_seguidor", {
    p_nombre: nombre.trim(), p_email: email.trim() || null, p_telefono: telefono.trim() || null,
  }).single<Vinculo>();
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear la invitación.");
  return data;
}

export async function enviarInvitacion(id: string) {
  const { error } = await supabase.functions.invoke("enviar-invitacion-seguidor", {
    body: { vinculo_id: id },
  });
  if (error) throw new Error("No se pudo enviar el correo. Puedes compartir el código o volver a enviarlo.");
}

export async function revocarSeguidor(id: string) {
  const { error } = await supabase.rpc("revocar_seguidor", { p_vinculo_id: id });
  if (error) throw new Error(error.message);
}

export type Tramo = { id: string; estado: "activo" | "emergencia"; iniciado_en: string; destino_nombre: string | null };
export type EstudianteSeguido = {
  id: string; nombre_completo: string; telefono: string | null; universidad: string | null;
  recorrido_actual: Tramo | null;
  ultimo_recorrido_finalizado: { id: string; finalizado_en: string | null; destino_nombre: string | null } | null;
};
export async function estudiantesSeguidos(): Promise<EstudianteSeguido[]> {
  const { data, error } = await supabase.rpc("listar_estudiantes_seguidos");
  if (error) throw new Error("No se pudieron cargar tus estudiantes.");
  return ((data ?? []) as EstudianteSeguido[]).map(e => ({ ...e, nombre_completo: e.nombre_completo?.trim() || "Estudiante" }));
}

type VistaInvitacion = { id: string; nombre_completo: string; universidad: string | null; codigo_expira_en: string };
export async function consultarInvitacion(codigo: string) {
  const { data, error } = await supabase.rpc("obtener_invitacion_por_codigo", { p_codigo: codigo }).maybeSingle<VistaInvitacion>();
  if (error) throw new Error("No se pudo consultar la invitación. Revisa tu conexión.");
  if (!data) throw new Error("El código venció, fue cancelado o ya se utilizó.");
  return { ...data, nombre_completo: data.nombre_completo?.trim() || "Estudiante" };
}
export async function aceptarInvitacion(codigo: string) {
  const { data, error } = await supabase.rpc("aceptar_invitacion_seguidor", { p_codigo: codigo }).single<{ id: string; nombre_completo: string }>();
  if (error || !data) throw new Error(error?.message ?? "No se pudo aceptar la invitación.");
  return { ...data, nombre_completo: data.nombre_completo?.trim() || "Estudiante" };
}
export async function rechazarInvitacion(codigo: string) {
  const { error } = await supabase.rpc("rechazar_invitacion_seguidor", { p_codigo: codigo });
  if (error) throw new Error(error.message);
}
