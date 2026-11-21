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
